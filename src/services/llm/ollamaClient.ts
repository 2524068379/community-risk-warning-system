import { http } from '@/services/http'
import type { VlmAnalysis, DetectionBox } from '@/types'
import { OLLAMA_CHAT_COMPLETIONS_ROUTE } from '../../../shared/apiRoutes.js'
import { DEFAULT_VLM_MODEL_ALIAS } from '../../../shared/vlmModelConfig.js'

const OLLAMA_PROXY_PATH = OLLAMA_CHAT_COMPLETIONS_ROUTE
export const OLLAMA_MODEL = DEFAULT_VLM_MODEL_ALIAS

const SYSTEM_PROMPT = `你是社区安全监控系统的结构化分析模块。必须使用 no_thinking 模式，禁止输出思考过程。你的输出会被程序直接 JSON.parse，因此必须严格遵守以下规则：

1. 仅输出一段合法 JSON，不要输出任何解释、前言、markdown 代码块（\`\`\`）、思考过程（<think>）、注释或多余空白。
2. 不要在 JSON 前后添加任何自然语言；如果无法判断，也必须按字段给出低置信度 JSON。
3. JSON 顶层字段及类型（全部必填）：
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

type JsonObject = Record<string, unknown>

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = Number(value.trim().replace(/%$/, ''))
    if (Number.isFinite(normalized)) {
      return normalized
    }
  }

  return null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeDetectionBox(box: unknown): DetectionBox | null {
  if (!box || typeof box !== 'object') {
    return null
  }

  const candidate = box as Partial<DetectionBox> & { bbox?: unknown }
  let x = toFiniteNumber(candidate.x)
  let y = toFiniteNumber(candidate.y)
  let width = toFiniteNumber(candidate.width)
  let height = toFiniteNumber(candidate.height)
  const confidence = toFiniteNumber(candidate.confidence)

  if (
    (x === null || y === null || width === null || height === null) &&
    Array.isArray(candidate.bbox) &&
    candidate.bbox.length >= 4
  ) {
    const [bx, by, bw, bh] = candidate.bbox.map((value) => toFiniteNumber(value))
    x = bx
    y = by
    width = bw
    height = bh
  }

  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isFiniteNumber(confidence) ||
    typeof candidate.label !== 'string' ||
    !candidate.label.trim()
  ) {
    return null
  }

  if (width <= 0 || height <= 0) {
    return null
  }

  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    width: clamp(width, 0, 1),
    height: clamp(height, 0, 1),
    label: candidate.label,
    confidence: clamp(confidence, 0, 1),
    risk: typeof candidate.risk === 'boolean' ? candidate.risk : false
  }
}

function stripThinkTags(text: string): string {
  const withoutClosedTags = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
  const unclosedTag = withoutClosedTags.match(/<think\b[^>]*>/i)
  if (!unclosedTag || unclosedTag.index === undefined) {
    return withoutClosedTags.trim()
  }

  const beforeTag = withoutClosedTags.slice(0, unclosedTag.index)
  const afterTag = withoutClosedTags.slice(unclosedTag.index + unclosedTag[0].length)
  const jsonStart = afterTag.search(/[{\[]/)
  if (jsonStart !== -1) {
    return `${beforeTag}${afterTag.slice(jsonStart)}`.trim()
  }

  return beforeTag.trim()
}

function extractFencedJsonBlocks(text: string): string[] {
  // Match ``` optionally followed by a language tag (json/JSON/etc.), content, and closing ```.
  const blocks = [...text.matchAll(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)

  if (blocks.length > 0) {
    return blocks
  }

  const unclosed = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*)$/)
  return unclosed?.[1]?.trim() ? [unclosed[1].trim()] : []
}

function extractBalancedJsonValues(text: string): string[] {
  const values: string[] = []
  const stack: string[] = []
  let start = -1
  let inString: '"' | '\'' | null = null
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === inString) {
        inString = null
      }
      continue
    }

    if (ch === '"' || ch === '\'') {
      inString = ch
    } else if (ch === '{' || ch === '[') {
      if (stack.length === 0) start = i
      stack.push(ch === '{' ? '}' : ']')
    } else if (ch === '}' || ch === ']') {
      if (stack[stack.length - 1] !== ch) {
        stack.length = 0
        start = -1
        continue
      }

      stack.pop()
      if (stack.length === 0 && start !== -1) {
        values.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }

  return values
}

function extractJsonCandidates(raw: string): string[] {
  let text = stripThinkTags(raw.trim())
  const sources = extractFencedJsonBlocks(text)
  if (sources.length === 0) {
    sources.push(text)
  }

  return sources.flatMap((source) => extractBalancedJsonValues(source))
}

function sanitizeJson(jsonStr: string): string {
  let out = jsonStr.trim()
  out = out
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '\'')

  out = normalizeJsonLikePunctuation(out)
  // Strip single-line comments that are NOT inside string literals.
  out = out.replace(/(?:^|\n)([^"\n]|"[^"\n\\]*(?:\\.[^"\\]*)*")*?(\/\/[^\n]*)/g, (match, _prefix, comment) =>
    match.replace(comment, '')
  )
  // Strip block comments.
  out = out.replace(/\/\*[\s\S]*?\*\//g, '')
  // A simpler second pass to catch trailing inline comments missed above.
  out = out.replace(/^\s*\/\/[^\n]*$/gm, '')
  // Quote common unquoted object keys and normalize JSON-like literals.
  out = out.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3')
  out = out.replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*:)/g, (_match, prefix, key, suffix) =>
    `${prefix}${JSON.stringify(key.replace(/\\'/g, '\''))}${suffix}`
  )
  out = out.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value) =>
    `:${JSON.stringify(value.replace(/\\'/g, '\''))}`
  )
  out = out.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value) =>
    JSON.stringify(value.replace(/\\'/g, '\''))
  )
  out = out.replace(/\bTrue\b/g, 'true')
  out = out.replace(/\bFalse\b/g, 'false')
  out = out.replace(/\bNone\b/g, 'null')
  // Strip trailing commas before } or ].
  out = out.replace(/,\s*([\]}])/g, '$1')
  return out
}

function normalizeJsonLikePunctuation(input: string): string {
  let out = ''
  let inString: '"' | '\'' | null = null
  let escape = false

  for (const ch of input) {
    if (inString) {
      out += ch
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === inString) {
        inString = null
      }
      continue
    }

    if (ch === '"' || ch === '\'') {
      inString = ch
      out += ch
    } else if (ch === '：') {
      out += ':'
    } else if (ch === '，') {
      out += ','
    } else {
      out += ch
    }
  }

  return out
}

function parseJsonCandidate(candidate: string): unknown | null {
  const attempts = [candidate, sanitizeJson(candidate)]
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt)
    } catch {
      // Try the next repair level.
    }
  }

  return null
}

function getNestedValue(record: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key]
    }
  }

  return undefined
}

function hasVlmFields(record: JsonObject): boolean {
  const knownKeys = [
    'hasRisk',
    'riskScore',
    'risk_score',
    'level',
    'riskLevel',
    'risk_level',
    'confidence',
    'summary',
    'description',
    'conclusion',
    'evidenceTimeline',
    'breakdown',
    'detectionBoxes'
  ]
  return knownKeys.some((key) => key in record)
}

function unwrapVlmPayload(value: unknown): unknown | null {
  if (Array.isArray(value)) {
    return value.map((item) => unwrapVlmPayload(item)).find(Boolean) ?? null
  }

  if (!isRecord(value)) {
    return null
  }

  if (hasVlmFields(value)) {
    return value
  }

  const content = isRecord(value.message) ? value.message.content : undefined
  if (typeof content === 'string') {
    return parseModelPayload(content)
  }

  if (Array.isArray(value.choices)) {
    for (const choice of value.choices) {
      const unwrapped = unwrapVlmPayload(choice)
      if (unwrapped) {
        return unwrapped
      }
    }
  }

  const nested = getNestedValue(value, ['analysis', 'result', 'data', 'output', 'response', 'riskAnalysis'])
  if (nested !== undefined) {
    if (typeof nested === 'string') {
      return parseModelPayload(nested)
    }

    return unwrapVlmPayload(nested)
  }

  return null
}

function parseModelPayload(raw: unknown): unknown | null {
  if (isRecord(raw) || Array.isArray(raw)) {
    return unwrapVlmPayload(raw)
  }

  if (typeof raw !== 'string') {
    return null
  }

  for (const candidate of extractJsonCandidates(raw)) {
    const parsed = parseJsonCandidate(candidate)
    const unwrapped = unwrapVlmPayload(parsed)
    if (unwrapped) {
      return unwrapped
    }
  }

  return null
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1', '是', '有', '存在'].includes(normalized)) {
      return true
    }
    if (['false', 'no', 'n', '0', '否', '无', '不存在'].includes(normalized)) {
      return false
    }
  }

  return fallback
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  return normalizeBoolean(value)
}

function normalizeRiskScore(value: unknown): number {
  const score = toFiniteNumber(value)
  return clamp(score ?? 0, 0, 100)
}

function normalizeConfidence(value: unknown): number {
  const confidence = toFiniteNumber(value)
  if (confidence === null) {
    return 0
  }

  return clamp(confidence > 1 && confidence <= 100 ? confidence / 100 : confidence, 0, 1)
}

function normalizeLevel(value: unknown, riskScore: number): 'A' | 'B' | 'C' {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase()
    const matched = normalized.match(/[ABC]/)
    if (matched) {
      return matched[0] as 'A' | 'B' | 'C'
    }

    if (/高|HIGH|SEVERE/.test(normalized)) {
      return 'A'
    }
    if (/中|MEDIUM|MODERATE/.test(normalized)) {
      return 'B'
    }
    if (/低|LOW|NORMAL|SAFE/.test(normalized)) {
      return 'C'
    }
  }

  if (riskScore >= 70) return 'A'
  if (riskScore >= 30) return 'B'
  return 'C'
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n；;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeBreakdown(value: unknown): { label: string; value: number }[] {
  if (Array.isArray(value)) {
    const items = value.flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }

      const label = String(getNestedValue(item, ['label', 'name', 'type']) ?? '').trim()
      const itemValue = toFiniteNumber(getNestedValue(item, ['value', 'score', 'percent', 'percentage']))
      if (!label || itemValue === null) {
        return []
      }

      return [{ label, value: clamp(Math.round(itemValue), 0, 100) }]
    })

    if (items.length > 0) {
      return items
    }
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([label, itemValue]) => {
      const normalizedValue = toFiniteNumber(itemValue)
      return normalizedValue === null ? [] : [{ label, value: clamp(Math.round(normalizedValue), 0, 100) }]
    })
  }

  return [{ label: '综合评估', value: 100 }]
}

function pickSummary(record: JsonObject): string {
  const value = getNestedValue(record, [
    'summary',
    'description',
    'conclusion',
    'reason',
    'riskDescription',
    'risk_description',
    'analysisSummary',
    'analysis_summary'
  ])

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return '分析完成'
}

function normalizeVlmPayload(parsed: unknown): { analysis: VlmAnalysis; boxes: DetectionBox[] } | null {
  const payload = unwrapVlmPayload(parsed)
  if (!isRecord(payload)) {
    return null
  }

  const riskScore = normalizeRiskScore(getNestedValue(payload, ['riskScore', 'risk_score', 'score']))
  const level = normalizeLevel(getNestedValue(payload, ['level', 'riskLevel', 'risk_level']), riskScore)
  const detectionBoxes = getNestedValue(payload, ['detectionBoxes', 'detection_boxes', 'boxes', 'detections'])
  const analysis: VlmAnalysis = {
    hasRisk: normalizeBoolean(getNestedValue(payload, ['hasRisk', 'has_risk', 'risk']), riskScore >= 30),
    riskScore,
    level,
    confidence: normalizeConfidence(getNestedValue(payload, ['confidence', 'probability'])),
    hasLoitering: normalizeOptionalBoolean(getNestedValue(payload, ['hasLoitering', 'has_loitering', 'loitering'])),
    hasGathering: normalizeOptionalBoolean(getNestedValue(payload, ['hasGathering', 'has_gathering', 'gathering'])),
    hasFallen: normalizeOptionalBoolean(getNestedValue(payload, ['hasFallen', 'has_fallen', 'fallen'])),
    summary: pickSummary(payload),
    evidenceTimeline: normalizeStringArray(getNestedValue(payload, [
      'evidenceTimeline',
      'evidence_timeline',
      'timeline',
      'evidence'
    ])),
    breakdown: normalizeBreakdown(getNestedValue(payload, ['breakdown', 'riskBreakdown', 'risk_breakdown'])),
    trend: []
  }
  const boxes: DetectionBox[] = Array.isArray(detectionBoxes)
    ? detectionBoxes.flatMap((box) => {
        const normalized = normalizeDetectionBox(box)
        return normalized ? [normalized] : []
      })
    : []

  return { analysis, boxes }
}

function buildFallbackAnalysis(summary = '模型未返回可解析内容'): VlmAnalysis {
  const normalizedSummary = summary.trim() || '模型未返回可解析内容'
  const hasRisk =
    /(风险|异常|摔倒|聚集|徘徊|堵塞|占用|充电|闯入|求助|损坏)/.test(normalizedSummary) &&
    !/(未发现|无明显|正常|风险可控|没有发现)/.test(normalizedSummary)
  const riskScore = hasRisk ? 45 : 0

  return {
    riskScore,
    level: hasRisk ? 'B' : 'C',
    hasRisk,
    confidence: 0.2,
    summary: normalizedSummary,
    evidenceTimeline: [],
    breakdown: [{ label: hasRisk ? '文本风险摘要' : '文本摘要', value: 100 }],
    trend: []
  }
}

function extractLooseSummary(raw: string): string | null {
  const text = stripThinkTags(raw)
  const summaryMatch = text.match(/["'“”]?summary["'“”]?\s*[:：]\s*["'“”]([^"'“”\n\r}]{1,240})["'“”]?/i)
    ?? text.match(/(?:模型摘要|摘要|结论|summary)\s*[:：]\s*([^\n\r]{1,240})/i)

  return summaryMatch?.[1]?.trim() || null
}

function buildFallbackFromRaw(raw: unknown): VlmAnalysis {
  if (typeof raw !== 'string') {
    return buildFallbackAnalysis()
  }

  const looseSummary = extractLooseSummary(raw)
  if (looseSummary) {
    return buildFallbackAnalysis(looseSummary)
  }

  const text = stripThinkTags(raw)
    .replace(/```[a-zA-Z0-9_-]*\s*/g, '')
    .replace(/```/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return buildFallbackAnalysis()
  }

  return buildFallbackAnalysis(text.length > 180 ? `${text.slice(0, 177)}...` : text)
}

export function parseVlmResponse(raw: unknown): { analysis: VlmAnalysis; boxes: DetectionBox[] } {
  const parsed = parseModelPayload(raw)
  const normalized = normalizeVlmPayload(parsed)
  if (normalized) {
    return normalized
  }

  console.warn('[vlm-parser] Falling back to plain-text summary')
  return { analysis: buildFallbackFromRaw(raw), boxes: [] }
}

export function buildOllamaChatRequestBody(imageBase64: string, cameraId: string, scene: string): Record<string, unknown> {
  return {
    model: OLLAMA_MODEL,
    temperature: 0.15,
    max_tokens: 800,
    stream: false,
    response_format: { type: 'json_object' },
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `${buildUserPrompt(cameraId, scene)} /no_think` },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      }
    ]
  }
}

export async function analyzeFrameWithOllama(
  imageBase64: string,
  cameraId: string,
  scene: string,
  signal?: AbortSignal
): Promise<{ analysis: VlmAnalysis; boxes: DetectionBox[] }> {
  const response = await http.post(OLLAMA_PROXY_PATH, buildOllamaChatRequestBody(imageBase64, cameraId, scene), { signal })

  const content = response.data?.choices?.[0]?.message?.content ?? ''
  return parseVlmResponse(content)
}
