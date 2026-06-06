import { http } from '@/services/http'
import type { VlmAnalysis, DetectionBox } from '@/types'
import { OLLAMA_CHAT_COMPLETIONS_ROUTE } from '../../../shared/apiRoutes.js'
import { DEFAULT_VLM_MODEL_ALIAS } from '../../../shared/vlmModelConfig.js'

const OLLAMA_PROXY_PATH = OLLAMA_CHAT_COMPLETIONS_ROUTE
export const OLLAMA_MODEL = DEFAULT_VLM_MODEL_ALIAS

const SYSTEM_PROMPT = `你是社区安全监控系统的结构化分析模块。你的输出会被程序直接 JSON.parse，因此必须严格遵守以下规则：

1. 仅输出一段合法 JSON，不要输出任何解释、前言、markdown 代码块（\`\`\`）、思考过程（<think>）、注释或多余空白。
2. JSON 顶层字段及类型（全部必填）：
   - hasRisk: boolean
   - riskScore: integer，范围 0-100
   - level: 字符串，仅可为 "A"、"B" 或 "C"
   - confidence: float，范围 0.0-1.0
   - hasLoitering: boolean（同一人员是否在同一区域反复徘徊或异常滞留）
   - hasGathering: boolean（是否存在非正常的人员聚集或围观）
   - hasFallen: boolean（是否有人员跌倒并持续未起身）
   - summary: 字符串，1-2 句中文概述
   - evidenceTimeline: 字符串数组
   - breakdown: 对象数组，每个对象含 label(字符串) 与 value(整数 0-100)，所有 value 之和必须等于 100
   - detectionBoxes: 对象数组，每个对象含 x,y,width,height(均为 0-1 归一化浮点数)、label(字符串)、confidence(0-1)、risk(boolean)
3. 判定标准：正常画面 riskScore<30, level="C", hasRisk=false；存在风险时按实际严重程度填写。
4. 风险分类：消防(通道堵塞/电动车违规)、治安(徘徊/聚集/闯入)、救助(摔倒/求助)、环境(积水/损坏)、设备(遮挡/异常)。
5. 示例（仅用于说明格式）：{"hasRisk":false,"riskScore":0,"level":"C","confidence":0.9,"hasLoitering":false,"hasGathering":false,"hasFallen":false,"summary":"画面正常，未发现风险。","evidenceTimeline":[],"breakdown":[{"label":"正常","value":100}],"detectionBoxes":[]}`

function buildUserPrompt(cameraId: string, scene: string): string {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  return `这是来自摄像头 ${cameraId}（场景：${scene}）的实时画面。请分析当前画面中存在的社区安全风险，并返回结构化JSON结果。当前时间：${now}`
}

interface OllamaResponse {
  hasRisk: boolean
  riskScore: number
  level: string
  confidence: number
  hasLoitering?: boolean
  hasGathering?: boolean
  hasFallen?: boolean
  summary: string
  evidenceTimeline: string[]
  breakdown: { label: string; value: number }[]
  detectionBoxes: DetectionBox[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeDetectionBox(box: unknown): DetectionBox | null {
  if (!box || typeof box !== 'object') {
    return null
  }

  const candidate = box as Partial<DetectionBox>
  if (
    !isFiniteNumber(candidate.x) ||
    !isFiniteNumber(candidate.y) ||
    !isFiniteNumber(candidate.width) ||
    !isFiniteNumber(candidate.height) ||
    !isFiniteNumber(candidate.confidence) ||
    typeof candidate.label !== 'string' ||
    !candidate.label.trim()
  ) {
    return null
  }

  if (candidate.width <= 0 || candidate.height <= 0) {
    return null
  }

  return {
    x: clamp(candidate.x, 0, 1),
    y: clamp(candidate.y, 0, 1),
    width: clamp(candidate.width, 0, 1),
    height: clamp(candidate.height, 0, 1),
    label: candidate.label,
    confidence: clamp(candidate.confidence, 0, 1),
    risk: typeof candidate.risk === 'boolean' ? candidate.risk : false
  }
}

function stripThinkTags(text: string): string {
  return text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').trim()
}

function extractFencedJson(text: string): string | null {
  // Match ``` optionally followed by a language tag (json/JSON/etc.), content, and closing ```.
  const match = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

function extractBalancedObject(text: string): string | null {
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

function extractJson(raw: string): string | null {
  let text = stripThinkTags(raw.trim())

  const fenced = extractFencedJson(text)
  if (fenced) {
    text = fenced
  }

  const balanced = extractBalancedObject(text)
  if (balanced) return balanced

  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) {
    return text.slice(first, last + 1)
  }

  return null
}

function sanitizeJson(jsonStr: string): string {
  let out = jsonStr
  // Strip single-line comments that are NOT inside string literals.
  out = out.replace(/(?:^|\n)([^"\n]|"[^"\n\\]*(?:\\.[^"\\]*)*")*?(\/\/[^\n]*)/g, (match, _prefix, comment) =>
    match.replace(comment, '')
  )
  // A simpler second pass to catch trailing inline comments missed above.
  out = out.replace(/^\s*\/\/[^\n]*$/gm, '')
  // Strip trailing commas before } or ].
  out = out.replace(/,\s*([\]}])/g, '$1')
  return out
}

export function parseVlmResponse(raw: string): { analysis: VlmAnalysis; boxes: DetectionBox[] } {
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
    console.warn('[vlm-parser] No JSON found in response, raw length:', raw.length)
    return { analysis: fallback, boxes: [] }
  }

  let parsed: OllamaResponse
  try {
    parsed = JSON.parse(jsonStr) as OllamaResponse
  } catch (primaryError) {
    try {
      parsed = JSON.parse(sanitizeJson(jsonStr)) as OllamaResponse
    } catch (secondaryError) {
      console.warn(
        '[vlm-parser] JSON parse failed:',
        primaryError instanceof Error ? primaryError.message : primaryError,
        '| sanitized retry:',
        secondaryError instanceof Error ? secondaryError.message : secondaryError
      )
      return { analysis: fallback, boxes: [] }
    }
  }

  const analysis: VlmAnalysis = {
    hasRisk: Boolean(parsed.hasRisk),
    riskScore: clamp(Number(parsed.riskScore) || 0, 0, 100),
    level: ['A', 'B', 'C'].includes(parsed.level) ? parsed.level as 'A' | 'B' | 'C' : 'C',
    confidence: clamp(Number(parsed.confidence) || 0, 0, 1),
    hasLoitering: typeof parsed.hasLoitering === 'boolean' ? parsed.hasLoitering : undefined,
    hasGathering: typeof parsed.hasGathering === 'boolean' ? parsed.hasGathering : undefined,
    hasFallen: typeof parsed.hasFallen === 'boolean' ? parsed.hasFallen : undefined,
    summary: String(parsed.summary || '分析完成'),
    evidenceTimeline: Array.isArray(parsed.evidenceTimeline) ? parsed.evidenceTimeline : [],
    breakdown: Array.isArray(parsed.breakdown) && parsed.breakdown.length > 0
      ? parsed.breakdown
      : [{ label: '综合评估', value: 100 }],
    trend: []
  }
  const boxes: DetectionBox[] = Array.isArray(parsed.detectionBoxes)
    ? parsed.detectionBoxes.flatMap((box) => {
        const normalized = normalizeDetectionBox(box)
        return normalized ? [normalized] : []
      })
    : []

  return { analysis, boxes }
}

export async function analyzeFrameWithOllama(
  imageBase64: string,
  cameraId: string,
  scene: string,
  signal?: AbortSignal
): Promise<{ analysis: VlmAnalysis; boxes: DetectionBox[] }> {
  const response = await http.post(OLLAMA_PROXY_PATH, {
    model: OLLAMA_MODEL,
    temperature: 0.15,
    max_tokens: 800,
    stream: false,
    response_format: { type: 'json_object' },
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
  }, { signal })

  const content = response.data?.choices?.[0]?.message?.content ?? ''
  return parseVlmResponse(content)
}
