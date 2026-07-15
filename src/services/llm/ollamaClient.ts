import { http } from '@/services/http'
import type { VlmAnalysis, DetectionBox, VlmModelSource } from '@/types'
import { OLLAMA_CHAT_COMPLETIONS_ROUTE } from '../../../shared/apiRoutes.js'
import { DEFAULT_VLM_MODEL_ALIAS } from '../../../shared/vlmModelConfig.js'
import { VLM_RESPONSE_FIELDS, VLM_RESPONSE_FORMAT } from '../../../shared/vlmResponseSchema.js'

const OLLAMA_PROXY_PATH = OLLAMA_CHAT_COMPLETIONS_ROUTE
export const OLLAMA_MODEL = DEFAULT_VLM_MODEL_ALIAS
const MIN_SAFE_NO_RISK_CONFIDENCE = 0.5
const MIN_DETAILED_SUMMARY_LENGTH = 20
const UNCERTAIN_CONCLUSION_PATTERN = /(?:无法(?:判断|识别|确认|分析)|画面(?:模糊|不清)|看不清|信息不足|cannot determine|unable to (?:determine|identify)|unclear|insufficient)/i
const IMAGE_QUALITY_FAILURE_PATTERN = /(?:(?:画面|图像|镜头|视频|当前帧)(?:(?:整体|内容|几乎|严重|大面积|基本|完全|被|呈现为|显示为|出现|存在|是|为|中|内)\s*){0,4}(?:全白|纯白|白屏|全黑|黑屏|过曝|欠曝|大面积遮挡|严重遮挡|失焦|模糊|不清|无有效(?:视觉)?内容|没有(?:可辨识|可识别)(?:的)?(?:内容|物体|目标)|不可辨识|无法(?:辨认|识别))|(?:全白|白屏|全黑|黑屏|过曝|欠曝|失焦)(?:画面|图像|镜头|视频|当前帧))/i
const SAFE_CHINESE_CONCLUSION_PATTERN = /(?:(?:风险判断|风险结论)[：:\s]*)?(?:(?:当前)?(?:画面|场景)(?:中|内|整体)?(?:正常|安全)[，,；;：:\s]*)?(?:未发现|没有发现|没有|暂无|无|未见|未显示(?:出)?)(?:任何|明显)?(?:的)?(?:与社区安全相关的|社区)?(?:安全)?风险(?:因素|迹象)?[。.!！\s]*$/i
const SAFE_ENGLISH_CONCLUSION_PATTERN = /(?:(?:risk (?:assessment|conclusion))[:\s]*)?(?:(?:the )?(?:scene|image|frame)(?: is)? (?:normal|safe)[,; ]*)?no (?:obvious )?risk(?: detected)?[.!\s]*$/i
const NEGATED_RISK_EVIDENCE_PATTERN = /(?:未见|未发现|没有(?:发现)?|未观察到|未检测到|未出现|不存在|未有|无|未)(?:(?:任何|明显|疑似)(?:的)?\s*){0,3}(?:发生|进行|存在|出现|被)?(?:(?:(?:人员)?(?:跌倒|倒地)|明火|火灾|烟雾|浓烟|(?:通道)?(?:堵塞|占用)|飞线|违规充电|闯入|徘徊|异常聚集|打斗|冲突|求助|积水|破损|损坏|遮挡|设备异常)(?:\s*(?:[、/]|或|和|及)\s*)?){1,8}/gi
const POSITIVE_RISK_CONCLUSION_PATTERN = /(?:跌倒|倒地|明火|火灾|烟雾|浓烟|堵塞|占用|飞线|违规充电|闯入|徘徊|异常聚集|打斗|冲突|求助|积水|破损|损坏|遮挡|设备异常)|(?:^|[。.!！；;，,：:\s])需要(?:立即|尽快).{0,12}(?:救助|处置|疏散|报警)|(?:^|[.!;,\s])(?:detected|observed|shows?|contains?|suspected).{0,40}(?:fall|fire|smoke|blocked|charging|intrusion|loitering|gathering|fight|flood|damage|obstruction)/i
const SAFE_BREAKDOWN_LABEL_PATTERN = /^(?:正常|安全|无风险|未发现风险|normal|safe|no risk)$/i
const ALLOWED_VLM_PAYLOAD_FIELDS = new Set(VLM_RESPONSE_FIELDS)
const VLM_ENVELOPE_FIELDS = [
  'message',
  'choices',
  'analysis',
  'result',
  'data',
  'output',
  'response',
  'riskAnalysis'
] as const
const ALLOWED_CHAT_RESPONSE_FIELDS = new Set([
  'id',
  'object',
  'created',
  'model',
  'choices',
  'usage',
  'timings',
  'system_fingerprint',
  'request_id'
])
const ALLOWED_CHAT_CHOICE_FIELDS = new Set(['index', 'message', 'finish_reason', 'logprobs'])
const ALLOWED_CHAT_MESSAGE_FIELDS = new Set(['role', 'content', 'refusal', 'reasoning_content'])

const SYSTEM_PROMPT = `你是社区安全监控系统的结构化视觉分析模块。必须先观察图像，再基于图像中的可见事实进行判断。必须使用非思考模式，禁止输出思考过程。你的输出会被程序直接 JSON.parse，因此必须严格遵守以下规则：

1. 仅输出一段合法 JSON，不要输出任何解释、前言、markdown 代码块（\`\`\`）、思考过程（<think>）、注释或多余空白。
2. 不要在 JSON 前后添加任何自然语言。只能描述当前图像中实际可见的内容，不得编造身份、意图、持续时长、运动轨迹、画面外事件或先后过程。
3. JSON 顶层字段及类型（全部必填）：
   - hasRisk: boolean
   - riskScore: integer，范围 0-100
   - level: 字符串，仅可为 "A"、"B" 或 "C"
   - confidence: float，范围 0.0-1.0
   - hasLoitering: boolean（同一人员是否在同一区域反复徘徊或异常滞留）
   - hasGathering: boolean（是否存在非正常的人员聚集或围观）
   - hasFallen: boolean（是否有人员跌倒并持续未起身）
   - summary: 单一字符串（必须是一个 JSON 字符串，绝不能是对象或数组），使用 2-4 句中文作具体说明。第 1 句描述场景环境、可见人员/车辆/物体及其数量、动作或位置关系；中间句说明支持判断的可见事实；最后一句说明具体风险类型和程度，或明确未发现明显社区安全风险。所有句子必须写在同一个 summary 字符串中，不要把“画面描述”“判断依据”“风险结论”作为对象键或嵌套字段。不得只写“画面正常”“有风险”“无风险”等模板化短句
   - evidenceTimeline: 字符串数组。hasRisk=false 时必须输出空数组 []；hasRisk=true 时只能写“当前帧：……”形式的可见风险证据。当前请求只有单帧，不得虚构时间点、持续时间或事件过程
   - breakdown: 对象数组，每个对象含 label(字符串) 与 value(整数 0-100)，所有 value 之和必须等于 100
   - detectionBoxes: 对象数组，每个对象含 x,y,width,height(均为 0-1 归一化浮点数)、label(字符串)、confidence(0-1)、risk(boolean)
4. 分数、等级和风险必须严格一致：0-29 对应 level="C" 且 hasRisk=false；30-69 对应 level="B" 且 hasRisk=true；70-100 对应 level="A" 且 hasRisk=true。
5. hasRisk=false 只适用于画面内容清晰且信息足以判断的情况，并且必须同时满足：confidence>=0.5；summary 仍须具体描述画面和判断依据，最后一句必须是“未发现明显社区安全风险。”；evidenceTimeline 与 detectionBoxes 必须为空；breakdown 必须为 [{"label":"正常","value":100}]。
6. 风险分类：消防(通道堵塞/电动车违规)、治安(徘徊/聚集/闯入)、救助(摔倒/求助)、环境(积水/损坏)、设备(遮挡/异常)。
7. 当前输入是单帧。仅凭单帧不能确认“反复徘徊”“持续未起身”等时序事实；若只能看到疑似姿态，应在 summary 中如实说明并给出人工复核结论，不得伪造持续时间。
8. 画面全白、全黑、严重过曝、严重欠曝、大面积遮挡、失焦或没有有效视觉内容时，属于设备/图像质量异常，严禁输出无风险。此时必须输出 hasRisk=true、riskScore=30、level="B"、confidence<0.5，breakdown 使用设备风险 100；summary 应描述具体画质问题、无法确认的内容和复核重点，风险结论明确为“图像质量异常，需要技术或人工复核”。
9. 其他无法可靠判断的情况同样按“需要人工复核”的风险结果输出：hasRisk=true、riskScore=30、level="B"、confidence<0.5；summary 仍要写明已看见的内容、无法确认的原因和复核重点，不得以低置信度输出无风险结论。`

function buildUserPrompt(cameraId: string, scene: string): string {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  return `这是来自摄像头 ${cameraId}（场景：${scene}）的实时画面。请先逐项观察画面中的环境、人员、车辆、物体、动作和位置关系，再判断社区安全风险。summary 只能是单一字符串，必须在同一个字符串中写至少 2 句、最多 4 句，依次说明具体画面情况、可见判断依据和风险结论，不得输出 summary 子对象，也不得复用固定的“画面正常”式短句。若判断无风险，也必须先描述画面，最后再用独立一句“未发现明显社区安全风险。”收尾，并令 evidenceTimeline=[]、detectionBoxes=[]。请返回结构化 JSON 结果。当前时间：${now}`
}

type JsonObject = Record<string, unknown>

export class VlmResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VlmResponseError'
  }
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
    !candidate.label.trim() ||
    typeof candidate.risk !== 'boolean'
  ) {
    return null
  }

  if (
    x < 0 || x > 1 || y < 0 || y > 1 ||
    width <= 0 || width > 1 || height <= 0 || height > 1 ||
    x + width > 1 || y + height > 1 ||
    confidence < 0 || confidence > 1
  ) {
    return null
  }

  return {
    x,
    y,
    width,
    height,
    label: candidate.label,
    confidence,
    risk: candidate.risk
  }
}

function stripClosedThinkTags(text: string): string | null {
  const withoutClosedTags = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
  return /<\/?think\b[^>]*>/i.test(withoutClosedTags)
    ? null
    : withoutClosedTags.trim()
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
  const withoutThink = stripClosedThinkTags(raw.trim())
  if (withoutThink === null) {
    return []
  }

  const fenced = withoutThink.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i)
  const candidateText = (fenced?.[1] ?? withoutThink).trim()
  const candidates = extractBalancedJsonValues(candidateText)
  if (candidates.length !== 1) {
    return []
  }

  const candidate = candidates[0].trim()
  if (candidate === candidateText) return [candidate]

  // A few JSON-mode VLM streams append an incomplete Markdown fence. Tolerate
  // only fence fragments around the one balanced JSON value, never prose.
  const candidateStart = candidateText.indexOf(candidates[0])
  const prefix = candidateText.slice(0, candidateStart).trim()
  const suffix = candidateText.slice(candidateStart + candidates[0].length).trim()
  const hasValidPrefix = !prefix || /^```(?:json)?$/i.test(prefix)
  const hasValidSuffix = !suffix || /^`{1,3}$/.test(suffix)
  if (!hasValidPrefix || !hasValidSuffix) return []

  return [candidate]
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

function hasDuplicateJsonObjectKeys(candidate: string): boolean {
  const text = sanitizeJson(candidate)
  const stack: Array<{ type: 'object'; keys: Set<string> } | { type: 'array' }> = []
  let inString = false
  let escape = false
  let stringStart = -1

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (inString) {
      if (escape) {
        escape = false
      } else if (character === '\\') {
        escape = true
      } else if (character === '"') {
        inString = false
        let nextIndex = index + 1
        while (/\s/.test(text[nextIndex] ?? '')) nextIndex++
        const context = stack[stack.length - 1]
        if (text[nextIndex] === ':' && context?.type === 'object') {
          try {
            const key = JSON.parse(text.slice(stringStart, index + 1)) as string
            if (context.keys.has(key)) return true
            context.keys.add(key)
          } catch {
            return true
          }
        }
      }
      continue
    }

    if (character === '"') {
      inString = true
      stringStart = index
    } else if (character === '{') {
      stack.push({ type: 'object', keys: new Set<string>() })
    } else if (character === '[') {
      stack.push({ type: 'array' })
    } else if (character === '}' || character === ']') {
      stack.pop()
    }
  }

  return false
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
  return knownKeys.some((key) => Object.prototype.hasOwnProperty.call(record, key))
}

function unwrapVlmPayload(value: unknown): unknown | null {
  if (Array.isArray(value)) {
    return value.length === 1 ? unwrapVlmPayload(value[0]) : null
  }

  if (!isRecord(value)) {
    return null
  }

  if (hasVlmFields(value)) {
    return value
  }

  const keys = Object.keys(value)
  const envelopeFields = VLM_ENVELOPE_FIELDS.filter((key) =>
    Object.prototype.hasOwnProperty.call(value, key)
  )
  if (keys.length !== 1 || envelopeFields.length !== 1) {
    return null
  }

  const envelopeField = envelopeFields[0]
  if (envelopeField === 'message') {
    const message = value.message
    if (!isRecord(message) || Object.keys(message).length !== 1 || !Object.prototype.hasOwnProperty.call(message, 'content')) {
      return null
    }

    return typeof message.content === 'string' ? parseModelPayload(message.content) : null
  }

  if (envelopeField === 'choices') {
    const choices = value.choices
    return Array.isArray(choices) && choices.length === 1
      ? unwrapVlmPayload(choices[0])
      : null
  }

  const nested = value[envelopeField]
  if (typeof nested === 'string') {
    return parseModelPayload(nested)
  }

  return unwrapVlmPayload(nested)
}

function parseModelPayload(raw: unknown): unknown | null {
  if (isRecord(raw) || Array.isArray(raw)) {
    return unwrapVlmPayload(raw)
  }

  if (typeof raw !== 'string') {
    return null
  }

  const candidates = extractJsonCandidates(raw)
  if (candidates.length !== 1) {
    return null
  }

  if (hasDuplicateJsonObjectKeys(candidates[0])) {
    return null
  }

  return unwrapVlmPayload(parseJsonCandidate(candidates[0]))
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 0 || value === 1) {
    return value === 1
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

  return null
}

function normalizeRiskScore(value: unknown): number | null {
  const score = toFiniteNumber(value)
  return score !== null && Number.isInteger(score) && score >= 0 && score <= 100
    ? score
    : null
}

function normalizeConfidence(value: unknown): number | null {
  const confidence = toFiniteNumber(value)
  if (confidence === null) {
    return null
  }

  const normalized = confidence > 1 && confidence <= 100 ? confidence / 100 : confidence
  return normalized >= 0 && normalized <= 1 ? normalized : null
}

function normalizeLevel(value: unknown): 'A' | 'B' | 'C' | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase().replace(/级$/, '').trim()
    if (normalized === 'A' || normalized === 'B' || normalized === 'C') {
      return normalized
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

  return null
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

function normalizeBreakdown(value: unknown): { label: string; value: number }[] | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null

    const items = value.flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }

      const label = String(getNestedValue(item, ['label', 'name', 'type']) ?? '').trim()
      const itemValue = toFiniteNumber(getNestedValue(item, ['value', 'score', 'percent', 'percentage']))
      if (!label || itemValue === null || !Number.isInteger(itemValue) || itemValue < 0 || itemValue > 100) {
        return []
      }

      return [{ label, value: itemValue }]
    })

    if (items.length !== value.length) return null
    return items.reduce((total, item) => total + item.value, 0) === 100 ? items : null
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return null
    const items = entries.flatMap(([label, itemValue]) => {
      const normalizedValue = toFiniteNumber(itemValue)
      return !label.trim() ||
        normalizedValue === null ||
        !Number.isInteger(normalizedValue) ||
        normalizedValue < 0 ||
        normalizedValue > 100
        ? []
        : [{ label, value: normalizedValue }]
    })
    if (items.length !== entries.length) return null
    return items.reduce((total, item) => total + item.value, 0) === 100 ? items : null
  }

  return null
}

function pickSummary(record: JsonObject): string | null {
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

  // Some OpenAI-compatible VLMs ignore the declared string type and split the
  // requested explanation into a small object. Accept only the exact, known
  // section shape and flatten it back into the renderer's string contract.
  if (isRecord(value)) {
    const sectionKeys = ['画面描述', '判断依据', '风险结论']
    if (
      Object.keys(value).length === sectionKeys.length &&
      sectionKeys.every((key) => typeof value[key] === 'string' && value[key].trim())
    ) {
      return sectionKeys
        .map((key) => `${key}：${String(value[key]).trim()}`)
        .join('')
    }
  }

  return null
}

function hasPositiveRiskText(summary: string): boolean {
  return POSITIVE_RISK_CONCLUSION_PATTERN.test(
    summary.replace(NEGATED_RISK_EVIDENCE_PATTERN, '')
  )
}

function isDetailedSummary(summary: string): boolean {
  const compact = summary.replace(/\s/g, '')
  const clauses = summary.split(/[。.!！；;，,：:]/).filter((part) => part.trim()).length
  return compact.length >= MIN_DETAILED_SUMMARY_LENGTH && clauses >= 2
}

function isDetailedSafeSummary(summary: string): boolean {
  if (!isDetailedSummary(summary)) return false
  const visibleDescription = summary
    .replace(SAFE_CHINESE_CONCLUSION_PATTERN, '')
    .replace(SAFE_ENGLISH_CONCLUSION_PATTERN, '')
    .replace(/\s/g, '')
  return visibleDescription.length >= 12
}

function appendSafeConclusion(summary: string): string {
  const trimmed = summary.trim()
  const separator = /[。.!！]$/.test(trimmed) ? '' : '。'
  return `${trimmed}${separator}未发现明显社区安全风险。`
}

function normalizeVlmPayload(parsed: unknown): { analysis: VlmAnalysis; boxes: DetectionBox[] } | null {
  const payload = unwrapVlmPayload(parsed)
  if (!isRecord(payload)) {
    return null
  }

  if (Object.keys(payload).some((field) => !ALLOWED_VLM_PAYLOAD_FIELDS.has(field))) {
    return null
  }

  const hasRisk = normalizeBoolean(payload.hasRisk)
  const riskScore = normalizeRiskScore(payload.riskScore)
  const level = normalizeLevel(payload.level)
  const confidence = normalizeConfidence(payload.confidence)
  const hasLoitering = normalizeBoolean(payload.hasLoitering)
  const hasGathering = normalizeBoolean(payload.hasGathering)
  const hasFallen = normalizeBoolean(payload.hasFallen)
  let summary = pickSummary(payload)
  const evidenceTimelineValue = payload.evidenceTimeline
  const breakdown = normalizeBreakdown(payload.breakdown)
  const detectionBoxes = payload.detectionBoxes
  const hasRawRiskBox = Array.isArray(detectionBoxes) && detectionBoxes.some(
    (box) => isRecord(box) && normalizeBoolean(box.risk) === true
  )
  const boxes: DetectionBox[] = Array.isArray(detectionBoxes)
    ? detectionBoxes.flatMap((box) => {
        const normalized = normalizeDetectionBox(box)
        return normalized ? [normalized] : []
      })
    : []
  const expectedLevel = riskScore === null ? null : riskScore >= 70 ? 'A' : riskScore >= 30 ? 'B' : 'C'
  const hasValidTimeline = typeof evidenceTimelineValue === 'string'
    ? Boolean(evidenceTimelineValue.trim())
    : Array.isArray(evidenceTimelineValue) && evidenceTimelineValue.every(
        (item) => typeof item === 'string' && Boolean(item.trim())
      )
  if (
    hasRisk === null ||
    riskScore === null ||
    level === null ||
    confidence === null ||
    hasLoitering === null ||
    hasGathering === null ||
    hasFallen === null ||
    !summary ||
    !hasValidTimeline ||
    !breakdown ||
    !Array.isArray(detectionBoxes) ||
    level !== expectedLevel ||
    hasRisk !== (riskScore >= 30)
  ) {
    return null
  }

  if (!isDetailedSummary(summary)) {
    return null
  }

  const hasPositiveRiskEvidence = hasLoitering ||
    hasGathering ||
    hasFallen ||
    hasRawRiskBox ||
    boxes.some((box) => box.risk) ||
    hasPositiveRiskText(summary)
  const evidenceTimeline = normalizeStringArray(evidenceTimelineValue)
  const safeBreakdown = breakdown.every((item) => SAFE_BREAKDOWN_LABEL_PATTERN.test(item.label))
  if (!hasRisk) {
    if (
      hasPositiveRiskEvidence ||
      confidence < MIN_SAFE_NO_RISK_CONFIDENCE ||
      UNCERTAIN_CONCLUSION_PATTERN.test(summary) ||
      IMAGE_QUALITY_FAILURE_PATTERN.test(summary) ||
      !isDetailedSafeSummary(summary) ||
      evidenceTimeline.length > 0 ||
      detectionBoxes.length > 0 ||
      !safeBreakdown
    ) {
      return null
    }

    const hasSafeConclusion = SAFE_CHINESE_CONCLUSION_PATTERN.test(summary) ||
      SAFE_ENGLISH_CONCLUSION_PATTERN.test(summary)
    if (!hasSafeConclusion) {
      summary = appendSafeConclusion(summary)
    }
  }

  const analysis: VlmAnalysis = {
    hasRisk,
    riskScore,
    level,
    confidence,
    hasLoitering,
    hasGathering,
    hasFallen,
    summary,
    evidenceTimeline,
    breakdown,
    trend: []
  }
  return { analysis, boxes }
}

export function parseVlmResponse(raw: unknown): { analysis: VlmAnalysis; boxes: DetectionBox[] } {
  const parsed = parseModelPayload(raw)
  const normalized = normalizeVlmPayload(parsed)
  if (normalized) {
    return normalized
  }

  throw new VlmResponseError('VLM 响应为空、无法解析或缺少必填字段')
}

export function normalizeVlmModelSource(value: unknown): VlmModelSource {
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase()
  return normalized === 'local' || normalized === 'cloud' || normalized === 'cloud-fallback'
    ? normalized
    : 'unknown'
}

function readVlmSourceHeader(headers: unknown): VlmModelSource {
  if (!headers || typeof headers !== 'object') return 'unknown'
  const candidate = headers as Record<string, unknown> & { get?: (name: string) => unknown }
  const value = typeof candidate.get === 'function'
    ? candidate.get('x-vlm-source')
    : candidate['x-vlm-source'] ?? candidate['X-VLM-Source']
  return normalizeVlmModelSource(value)
}

function isEmptyOptionalChatField(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim())
}

export function parseOllamaChatResponse(
  data: unknown,
  headers?: unknown
): { analysis: VlmAnalysis; boxes: DetectionBox[]; modelSource: VlmModelSource } {
  if (isRecord(data) && isRecord(data.error)) {
    const upstreamMessage = typeof data.error.message === 'string' && data.error.message.trim()
      ? data.error.message.trim()
      : 'VLM 上游返回错误'
    throw new Error(upstreamMessage)
  }

  if (
    !isRecord(data) ||
    Object.keys(data).some((field) => !ALLOWED_CHAT_RESPONSE_FIELDS.has(field)) ||
    !Object.prototype.hasOwnProperty.call(data, 'choices')
  ) {
    throw new VlmResponseError('VLM 响应结构无效')
  }

  const choices = data.choices
  if (!Array.isArray(choices) || choices.length !== 1) {
    throw new VlmResponseError('VLM 响应的 choices 必须只包含一个项目')
  }

  const firstChoice = choices[0]
  if (
    !isRecord(firstChoice) ||
    Object.keys(firstChoice).some((field) => !ALLOWED_CHAT_CHOICE_FIELDS.has(field)) ||
    !Object.prototype.hasOwnProperty.call(firstChoice, 'message') ||
    firstChoice.finish_reason !== 'stop' ||
    !isRecord(firstChoice.message) ||
    Object.keys(firstChoice.message).some((field) => !ALLOWED_CHAT_MESSAGE_FIELDS.has(field)) ||
    !Object.prototype.hasOwnProperty.call(firstChoice.message, 'content') ||
    firstChoice.message.role !== 'assistant' ||
    !isEmptyOptionalChatField(firstChoice.message.refusal) ||
    !isEmptyOptionalChatField(firstChoice.message.reasoning_content)
  ) {
    throw new VlmResponseError('VLM choice 结构无效')
  }

  const content = firstChoice.message.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new VlmResponseError('VLM 响应内容为空')
  }

  return {
    ...parseVlmResponse(content),
    modelSource: readVlmSourceHeader(headers)
  }
}

export function buildOllamaChatRequestBody(imageBase64: string, cameraId: string, scene: string): Record<string, unknown> {
  return {
    model: OLLAMA_MODEL,
    temperature: 0.15,
    max_tokens: 800,
    stream: false,
    response_format: VLM_RESPONSE_FORMAT,
    chat_template_kwargs: { enable_thinking: false },
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
  }
}

export async function analyzeFrameWithOllama(
  imageBase64: string,
  cameraId: string,
  scene: string,
  signal?: AbortSignal
): Promise<{ analysis: VlmAnalysis; boxes: DetectionBox[]; modelSource: VlmModelSource }> {
  const response = await http.post(OLLAMA_PROXY_PATH, buildOllamaChatRequestBody(imageBase64, cameraId, scene), { signal })
  return parseOllamaChatResponse(response.data, response.headers)
}
