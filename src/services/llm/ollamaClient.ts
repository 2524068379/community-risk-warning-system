import { http } from '@/services/http'
import type { VlmAnalysis, DetectionBox } from '@/types'

const OLLAMA_PROXY_PATH = '/api/ollama/chat/completions'
const OLLAMA_MODEL = 'qwen3.5:4b-q4_K_M'

const SYSTEM_PROMPT = `你是一个社区安全监控视觉语言模型。你的任务是分析社区摄像头画面，识别潜在的安全风险。

你需要检测以下风险类型：
1. 消防风险：消防通道堵塞、电动车违规停放/充电、易燃物品堆放
2. 治安风险：可疑徘徊、异常聚集、非法闯入、财物安全隐患
3. 救助预警：人员摔倒、长时间倒地、求助信号、老人/儿童异常情况
4. 环境风险：积水、路面损坏、照明故障、设施损坏
5. 设备异常：摄像头遮挡、画面异常、信号丢失前兆

你必须严格按照以下JSON格式返回分析结果，不要添加任何其他文字说明：
{
  "hasRisk": true或false,
  "riskScore": 0到100的整数,
  "level": "A"或"B"或"C"，其中A为高危、B为中危、C为低危或正常,
  "confidence": 0.0到1.0的浮点数,
  "summary": "一句话风险摘要，不超过50字",
  "evidenceTimeline": ["HH:MM:SS 事件描述"],
  "breakdown": [{"label":"风险类别名","value":占比百分比整数}],
  "detectionBoxes": [{"x":0.0到1.0,"y":0.0到1.0,"width":0.0到1.0,"height":0.0到1.0,"label":"标注说明","confidence":0.0到1.0,"risk":true或false}]
}

注意：
- 如果画面正常无风险，riskScore应低于30，level为C，hasRisk为false
- breakdown的value总和应为100
- detectionBox坐标为归一化比例(0到1)，表示在画面中的相对位置
- 仅返回JSON，不要包含markdown代码块标记`

function buildUserPrompt(cameraId: string, scene: string): string {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  return `这是来自摄像头 ${cameraId}（场景：${scene}）的实时画面。请分析当前画面中存在的社区安全风险，并返回结构化JSON结果。当前时间：${now}`
}

interface OllamaResponse {
  hasRisk: boolean
  riskScore: number
  level: string
  confidence: number
  summary: string
  evidenceTimeline: string[]
  breakdown: { label: string; value: number }[]
  detectionBoxes: DetectionBox[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function parseVlmResponse(raw: string): { analysis: VlmAnalysis; boxes: DetectionBox[] } {
  let jsonStr = raw.trim()

  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  const braceStart = jsonStr.indexOf('{')
  const braceEnd = jsonStr.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1)
  }

  const fallback: VlmAnalysis = {
    riskScore: 0,
    level: 'C',
    hasRisk: false,
    confidence: 0,
    summary: '模型返回格式异常，无法解析',
    evidenceTimeline: [],
    breakdown: [{ label: '解析失败', value: 100 }],
    trend: []
  }

  try {
    const parsed: OllamaResponse = JSON.parse(jsonStr)
    const analysis: VlmAnalysis = {
      hasRisk: Boolean(parsed.hasRisk),
      riskScore: clamp(Number(parsed.riskScore) || 0, 0, 100),
      level: ['A', 'B', 'C'].includes(parsed.level) ? parsed.level as 'A' | 'B' | 'C' : 'C',
      confidence: clamp(Number(parsed.confidence) || 0, 0, 1),
      summary: String(parsed.summary || '分析完成'),
      evidenceTimeline: Array.isArray(parsed.evidenceTimeline) ? parsed.evidenceTimeline : [],
      breakdown: Array.isArray(parsed.breakdown) && parsed.breakdown.length > 0
        ? parsed.breakdown
        : [{ label: '综合评估', value: 100 }],
      trend: []
    }
    const boxes: DetectionBox[] = Array.isArray(parsed.detectionBoxes)
      ? parsed.detectionBoxes.filter(
          (b) => typeof b.x === 'number' && typeof b.y === 'number' && b.label
        )
      : []

    return { analysis, boxes }
  } catch {
    return { analysis: fallback, boxes: [] }
  }
}

export async function analyzeFrameWithOllama(
  imageBase64: string,
  cameraId: string,
  scene: string
): Promise<{ analysis: VlmAnalysis; boxes: DetectionBox[] }> {
  const response = await http.post(OLLAMA_PROXY_PATH, {
    model: OLLAMA_MODEL,
    temperature: 0.15,
    max_tokens: 800,
    stream: false,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildUserPrompt(cameraId, scene) },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      }
    ]
  })

  const content = response.data?.choices?.[0]?.message?.content ?? ''
  return parseVlmResponse(content)
}
