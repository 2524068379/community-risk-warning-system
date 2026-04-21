import { http } from '@/services/http'
import type { VlmAnalysis, DetectionBox } from '@/types'

const OLLAMA_PROXY_PATH = '/api/ollama/chat/completions'
const OLLAMA_MODEL = 'qwen3.5:4b-q4_K_M'

const SYSTEM_PROMPT = `/no_think
你是社区安全监控系统。分析摄像头画面，返回纯JSON，不要任何其他文字。

检测：消防(通道堵塞/电动车违规)、治安(徘徊/聚集/闯入)、救助(摔倒/求助)、环境(积水/损坏)、设备(遮挡/异常)。

直接返回JSON，不要思考过程，不要markdown标记：
{"hasRisk":false,"riskScore":0,"level":"C","confidence":0.0,"summary":"","evidenceTimeline":[],"breakdown":[{"label":"正常","value":100}],"detectionBoxes":[]}

正常画面：riskScore<30,level=C,hasRisk=false。风险画面按实际填写。detectionBox坐标0-1归一化。breakdown的value总和100。`

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

function stripThinkTags(text: string): string {
  return text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').trim()
}

function extractJson(raw: string): string | null {
  let text = raw.trim()

  // Strip <think/> blocks (Qwen3 reasoning)
  text = stripThinkTags(text)

  // Try markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }

  // Find balanced outermost { }
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (text[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1)
      }
    }
  }

  // Fallback: first { to last }
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) {
    return text.slice(first, last + 1)
  }

  return null
}

function parseVlmResponse(raw: string): { analysis: VlmAnalysis; boxes: DetectionBox[] } {
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

  const jsonStr = extractJson(raw)
  if (!jsonStr) {
    console.warn('[vlm-parser] No JSON found in response, raw length:', raw.length, 'first 200:', raw.slice(0, 200))
    return { analysis: fallback, boxes: [] }
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
  } catch (e) {
    console.warn('[vlm-parser] JSON parse failed:', e instanceof Error ? e.message : e, 'jsonStr:', jsonStr.slice(0, 300))
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
  console.log('[vlm-client] Raw response length:', content.length, 'first 200:', content.slice(0, 200))
  return parseVlmResponse(content)
}
