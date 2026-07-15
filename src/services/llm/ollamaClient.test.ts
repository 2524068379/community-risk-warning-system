import { describe, expect, it } from 'vitest'
import {
  OLLAMA_MODEL,
  VlmResponseError,
  buildOllamaChatRequestBody,
  normalizeVlmModelSource,
  parseOllamaChatResponse,
  parseVlmResponse
} from './ollamaClient'
import { DEFAULT_VLM_MODEL_ALIAS } from '../../../shared/vlmModelConfig.js'
import { VLM_RESPONSE_FIELDS, VLM_RESPONSE_FORMAT } from '../../../shared/vlmResponseSchema.js'

const DETAILED_SAFE_SUMMARY = '画面描述：小区入口光线清晰，可见两名居民正常通行，消防通道保持畅通。判断依据：未见明火、烟雾、人员跌倒或异常聚集。风险结论：未发现明显社区安全风险。'

function completePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hasRisk: false,
    riskScore: 0,
    level: 'C',
    confidence: 0.9,
    hasLoitering: false,
    hasGathering: false,
    hasFallen: false,
    summary: DETAILED_SAFE_SUMMARY,
    evidenceTimeline: [],
    breakdown: [{ label: '正常', value: 100 }],
    detectionBoxes: [],
    ...overrides
  }
}

function completeChatChoice(content: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    finish_reason: 'stop',
    message: {
      role: 'assistant',
      content: content
    },
    ...overrides
  }
}

describe('ollamaClient model configuration', () => {
  it('uses the configured Unsloth Qwen3.5 MTP GGUF model alias', () => {
    expect(OLLAMA_MODEL).toBe(DEFAULT_VLM_MODEL_ALIAS)
  })
})

describe('ollamaClient request payload', () => {
  it('requests schema-constrained JSON with Qwen thinking disabled', () => {
    const body = buildOllamaChatRequestBody('data:image/jpeg;base64,abc', 'cam-1', '入口')
    const messages = body.messages as Array<{ role: string; content: unknown }>
    const systemPrompt = String(messages.find((message) => message.role === 'system')?.content ?? '')
    const userContent = messages.find((message) => message.role === 'user')?.content as Array<{ type: string; text?: string }>
    const userPrompt = String(userContent.find((item) => item.type === 'text')?.text ?? '')

    expect(body).toMatchObject({
      response_format: VLM_RESPONSE_FORMAT,
      chat_template_kwargs: { enable_thinking: false },
      stream: false
    })
    expect(VLM_RESPONSE_FORMAT.schema.required).toEqual(VLM_RESPONSE_FIELDS)
    expect(VLM_RESPONSE_FORMAT.schema.additionalProperties).toBe(false)
    expect(VLM_RESPONSE_FORMAT.schema.properties.summary).toMatchObject({
      description: expect.stringContaining('画面描述')
    })
    expect(systemPrompt).toContain('画面描述：')
    expect(systemPrompt).toContain('判断依据：')
    expect(systemPrompt).toContain('风险结论：')
    expect(systemPrompt).toContain('只能描述当前图像中实际可见的内容')
    expect(systemPrompt).toContain('画面全白、全黑、严重过曝')
    expect(systemPrompt).toContain('严禁输出无风险')
    expect(systemPrompt).not.toContain('画面正常，未发现风险。')
    expect(userPrompt).toContain('先逐项观察画面')
    expect(userPrompt).toContain('不得复用固定的“画面正常”式短句')
    expect(JSON.stringify(body)).not.toContain('/no_think')
  })
})

describe('parseVlmResponse', () => {
  it('drops detection boxes with missing size or confidence fields', () => {
    const result = parseVlmResponse(JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 70,
      level: 'A',
      confidence: 0.8,
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true },
        { x: 0.1, y: 0.2, height: 0.4, label: 'missing width', confidence: 0.9, risk: true },
        { x: 0.1, y: 0.2, width: 0.3, label: 'missing height', confidence: 0.9, risk: true },
        { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'missing confidence', risk: true }
      ]
    })))

    expect(result.boxes).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
    ])
  })

  it('drops out-of-bounds boxes and boxes missing the required risk flag', () => {
    const result = parseVlmResponse(JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 70,
      level: 'A',
      confidence: 0.8,
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: -0.2, y: 0.2, width: 0.3, height: 0.5, label: 'out of bounds', confidence: 0.9, risk: true },
        { x: 0.1, y: 0.2, width: 0.3, height: 0.5, label: 'missing risk', confidence: 0.9 }
      ]
    })))

    expect(result.boxes).toEqual([])
  })

  it('drops detection boxes with non-finite numeric fields', () => {
    const result = parseVlmResponse(JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 70,
      level: 'A',
      confidence: 0.8,
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: 'bad', y: 0.2, width: 0.3, height: 0.4, label: 'invalid', confidence: 0.9, risk: true },
        { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
      ]
    })))

    expect(result.boxes).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
    ])
  })

  it('normalizes numeric detection box fields returned as strings', () => {
    const result = parseVlmResponse(JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: '70',
      level: 'A',
      confidence: '80%',
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: '0.1', y: '0.2', width: '0.3', height: '0.4', label: 'valid', confidence: '0.9', risk: true }
      ]
    })))

    expect(result.analysis.confidence).toBe(0.8)
    expect(result.boxes).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
    ])
  })

  it('parses JSON wrapped in a markdown code fence with a language identifier', () => {
    const raw = `\`\`\`json\n${JSON.stringify(completePayload({ riskScore: 10, confidence: 0.7 }))}\n\`\`\``
    const result = parseVlmResponse(raw)
    expect(result.analysis.summary).toBe(DETAILED_SAFE_SUMMARY)
    expect(result.analysis.riskScore).toBe(10)
  })

  it('parses a single JSON result after a complete <think> reasoning block', () => {
    const raw = `<think>analyzing the scene...</think>\n${JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 60,
      level: 'B',
      confidence: 0.8,
      hasLoitering: true,
      summary: '发现徘徊人员',
      evidenceTimeline: ['10:01 人员徘徊'],
      breakdown: [{ label: '治安', value: 100 }]
    }))}`
    const result = parseVlmResponse(raw)
    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.hasLoitering).toBe(true)
    expect(result.analysis.summary).toBe('发现徘徊人员')
  })

  it('recovers from trailing commas in JSON arrays and objects', () => {
    const raw = `{"hasRisk":false,"riskScore":5,"level":"C","confidence":0.9,"summary":${JSON.stringify(DETAILED_SAFE_SUMMARY)},"evidenceTimeline":[],"breakdown":[{"label":"正常","value":100,}],"detectionBoxes":[],"hasLoitering":false,"hasGathering":false,"hasFallen":false,}`
    const result = parseVlmResponse(raw)
    expect(result.analysis.riskScore).toBe(5)
    expect(result.analysis.breakdown).toEqual([{ label: '正常', value: 100 }])
  })

  it('recovers from single-line // comments inside the JSON body', () => {
    const raw = `{
      // 风险等级判定
      "hasRisk": true,
      "riskScore": 45,
      "level": "B",
      "confidence": 0.6,
      "summary": "发现聚集",
      "hasLoitering": false,
      "hasGathering": true,
      "hasFallen": false,
      "evidenceTimeline": [],
      "breakdown": [{"label": "治安", "value": 100}],
      "detectionBoxes": []
    }`
    const result = parseVlmResponse(raw)
    expect(result.analysis.hasGathering).toBe(true)
    expect(result.analysis.riskScore).toBe(45)
  })

  it.each([
    '画面中未发现明显社区安全风险。',
    '画面中有两名人员站立。',
    '画面正常，但发现有人跌倒。'
  ])('fails closed for unstructured natural-language output: %s', (raw) => {
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('rejects JSON embedded inside surrounding prose', () => {
    const raw = `说明：结果对象为 ${JSON.stringify(completePayload({
      riskScore: 15,
      confidence: 0.5,
      summary: '画面正常'
    }))}，请查收。`
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('parses JSON-like model output with single quotes, unquoted keys, and Python booleans', () => {
    const raw = "{hasRisk: True, riskScore: 62, level: 'B', confidence: 0.71, hasLoitering: False, hasGathering: False, hasFallen: False, summary: '消防通道疑似被占用', evidenceTimeline: ['10:01 消防通道被占用'], breakdown: [{'label': '消防', 'value': 100}], detectionBoxes: []}"
    const result = parseVlmResponse(raw)
    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.summary).toBe('消防通道疑似被占用')
    expect(result.analysis.evidenceTimeline).toEqual(['10:01 消防通道被占用'])
    expect(result.analysis.breakdown).toEqual([{ label: '消防', value: 100 }])
  })

  it('rejects JSON that appears after an unclosed think tag', () => {
    const raw = `<think>先观察画面\n${JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 55,
      level: 'B',
      confidence: 0.7,
      hasGathering: true,
      summary: '检测到异常聚集',
      breakdown: [{ label: '治安', value: 100 }]
    }))}`
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('rejects risk text outside an otherwise complete safe JSON result', () => {
    const raw = `发现严重风险。\n${JSON.stringify(completePayload())}`
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('unwraps structured results returned inside common response envelopes', () => {
    const result = parseVlmResponse({
      result: {
        riskScore: 35,
        level: 'B',
        confidence: 0.6,
        hasRisk: true,
        hasLoitering: false,
        hasGathering: true,
        hasFallen: false,
        summary: '发现人员聚集',
        evidenceTimeline: ['10:01 入口聚集', '10:02 人群未散开'],
        breakdown: [{ label: '治安', value: 100 }],
        detectionBoxes: []
      }
    })

    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.riskScore).toBe(35)
    expect(result.analysis.level).toBe('B')
    expect(result.analysis.summary).toBe('发现人员聚集')
    expect(result.analysis.evidenceTimeline).toEqual(['10:01 入口聚集', '10:02 人群未散开'])
  })

  it('accepts a JSON array only when it contains one structured result', () => {
    const raw = JSON.stringify([completePayload({ riskScore: 8 })])
    const result = parseVlmResponse(raw)
    expect(result.analysis.summary).toBe(DETAILED_SAFE_SUMMARY)
    expect(result.analysis.riskScore).toBe(8)
  })

  it.each([
    {
      result: completePayload(),
      data: completePayload({
        hasRisk: true,
        riskScore: 80,
        level: 'A',
        hasFallen: true,
        summary: '发现人员跌倒',
        breakdown: [{ label: '救助风险', value: 100 }]
      })
    },
    {
      analysis: completePayload(),
      result: completePayload({
        hasRisk: true,
        riskScore: 80,
        level: 'A',
        hasFallen: true,
        summary: '发现人员跌倒',
        breakdown: [{ label: '救助风险', value: 100 }]
      })
    },
    {
      message: { content: JSON.stringify(completePayload()) },
      choices: [{ message: { content: JSON.stringify(completePayload({ hasRisk: true, riskScore: 80, level: 'A' })) } }]
    },
    [completePayload(), { risk: true }],
    {
      choices: [
        { message: { content: JSON.stringify(completePayload()) } },
        { message: { content: '{"risk":true}' } }
      ]
    }
  ])('rejects response containers with multiple or ambiguous candidates: %o', (raw) => {
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it.each([
    `示例：${JSON.stringify(completePayload())}\n实际结果：${JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 80,
      level: 'A',
      hasFallen: true,
      summary: '发现人员跌倒',
      evidenceTimeline: ['10:01 发现人员跌倒'],
      breakdown: [{ label: '救助风险', value: 100 }]
    }))}`,
    `\`\`\`json\n${JSON.stringify(completePayload())}\n\`\`\`\n\`\`\`json\n${JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 80,
      level: 'A',
      hasFallen: true,
      summary: '发现人员跌倒',
      evidenceTimeline: ['10:01 发现人员跌倒'],
      breakdown: [{ label: '救助风险', value: 100 }]
    }))}\n\`\`\``
  ])('rejects ambiguous responses containing multiple structured results', (raw) => {
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it.each([
    `实际：${JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 80,
      level: 'A',
      hasFallen: true,
      summary: '发现人员跌倒',
      evidenceTimeline: ['10:01 发现人员跌倒'],
      breakdown: [{ label: '救助风险', value: 100 }]
    }))}\n示例：\`\`\`json\n${JSON.stringify(completePayload())}\n\`\`\``,
    `示例：\`\`\`json\n${JSON.stringify(completePayload())}\n\`\`\`\n实际：${JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 80,
      level: 'A',
      hasFallen: true,
      summary: '发现人员跌倒',
      evidenceTimeline: ['10:01 发现人员跌倒'],
      breakdown: [{ label: '救助风险', value: 100 }]
    }))}`
  ])('rejects ambiguity across fenced and unfenced structured results', (raw) => {
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it.each([
    ['empty string', ''],
    ['empty object', '{}'],
    ['empty choices', { choices: [] }],
    ['truncated JSON', '{"hasRisk":false,"riskScore":0'],
    ['unparseable placeholder', '无法解析模型响应']
  ])('fails closed for %s', (_name, raw) => {
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('rejects structured output with a missing required field', () => {
    const payload = completePayload()
    delete payload.hasFallen
    expect(() => parseVlmResponse(JSON.stringify(payload))).toThrow(/缺少必填字段/)
  })

  it.each([
    ['positive fall flag', { hasFallen: true }],
    ['risk-marked detection box', {
      detectionBoxes: [
        { x: 0.1, y: 0.1, width: 0.2, height: 0.2, label: '跌倒人员', confidence: 0.9, risk: true }
      ]
    }]
  ])('rejects a no-risk conclusion that contradicts %s', (_name, overrides) => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload(overrides)))).toThrow(VlmResponseError)
  })

  it.each([
    { confidence: 0, summary: '画面模糊，无法判断' },
    { confidence: 0.49, summary: '未发现明显风险' },
    { confidence: 0.9, summary: '信息不足，无法确认是否安全' }
  ])('rejects an uncertain no-risk conclusion: %o', (overrides) => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload(overrides)))).toThrow(VlmResponseError)
  })

  it.each([
    { summary: '发现一名人员跌倒，需要立即救助' },
    { evidenceTimeline: ['10:01 发现人员跌倒并持续未起身'] },
    { breakdown: [{ label: '人员跌倒', value: 100 }] },
    {
      detectionBoxes: [
        { x: 0.1, y: 0.1, width: 0.2, height: 0.2, label: '跌倒人员', confidence: 0.9, risk: false }
      ]
    }
  ])('rejects textual or boxed risk evidence inside a no-risk payload: %o', (overrides) => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload(overrides)))).toThrow(VlmResponseError)
  })

  it('accepts a detailed no-risk summary with visible observations and supporting evidence', () => {
    const result = parseVlmResponse(JSON.stringify(completePayload()))

    expect(result.analysis.hasRisk).toBe(false)
    expect(result.analysis.summary).toBe(DETAILED_SAFE_SUMMARY)
  })

  it('accepts a detailed risk summary with location, evidence, and severity', () => {
    const summary = '画面描述：楼道右侧停放一辆电动自行车，车身旁可见电线连接至墙面插座。判断依据：车辆占用部分通行区域，线缆连接方式存在违规充电迹象。风险结论：存在中等级别消防风险，建议立即人工核查并移除车辆。'
    const result = parseVlmResponse(JSON.stringify(completePayload({
      hasRisk: true,
      riskScore: 55,
      level: 'B',
      summary,
      evidenceTimeline: ['当前帧：楼道右侧可见电动自行车及连接线缆'],
      breakdown: [{ label: '消防', value: 100 }]
    })))

    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.summary).toBe(summary)
  })

  it('rejects a positive risk description followed by a contradictory safe conclusion', () => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload({
      summary: '画面描述：发现一名人员跌倒在道路中央。判断依据：该人员呈倒地姿态，需要立即救助。风险结论：未发现明显社区安全风险。'
    })))).toThrow(VlmResponseError)
  })

  it('rejects raw risk evidence even when the box geometry itself is invalid', () => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload({
      detectionBoxes: [
        { x: -0.1, y: 0.1, width: 0.2, height: 0.2, label: '跌倒人员', confidence: 0.9, risk: true }
      ]
    })))).toThrow(VlmResponseError)
  })

  it.each([
    [null],
    [{ label: '跌倒人员' }],
    [{ label: '跌倒人员', risk: false }],
    [{ x: -0.1, y: 0.1, width: 0.2, height: 0.2, label: '跌倒人员', confidence: 0.9, risk: false }]
  ])('requires the raw detectionBoxes array to be empty for a no-risk result: %o', (detectionBoxes) => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload({ detectionBoxes })))).toThrow(VlmResponseError)
  })

  it.each([
    { persons: [{ hasFallen: true }] },
    { hazards: ['人员跌倒'] },
    { anomalies: ['检测到明火'] }
  ])('rejects unknown top-level fields instead of ignoring contradictory evidence: %o', (extra) => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload(extra)))).toThrow(VlmResponseError)
  })

  it.each([
    { risk: true },
    { score: 90 },
    { riskLevel: 'A' },
    { has_fallen: true },
    { evidence: ['10:01 人员跌倒'] },
    {
      boxes: [
        { x: 0.1, y: 0.1, width: 0.2, height: 0.2, label: '跌倒人员', confidence: 0.9, risk: true }
      ]
    }
  ])('rejects conflicting alias fields instead of preferring canonical safe values: %o', (alias) => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload(alias)))).toThrow(VlmResponseError)
  })

  it.each([
    { risk: true },
    { score: 90 },
    { has_fallen: true }
  ])('rejects an extra partial JSON object before a complete safe payload: %o', (partial) => {
    const raw = `${JSON.stringify(partial)}\n${JSON.stringify(completePayload())}`
    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('rejects duplicate JSON object keys instead of accepting the last safe value', () => {
    const raw = JSON.stringify(completePayload()).replace(
      '"hasRisk":false',
      '"hasRisk":true,"hasRisk":false'
    )

    expect(() => parseVlmResponse(raw)).toThrow(VlmResponseError)
  })

  it('rejects out-of-range fields and an invalid breakdown total', () => {
    expect(() => parseVlmResponse(JSON.stringify(completePayload({ riskScore: 101 })))).toThrow(VlmResponseError)
    expect(() => parseVlmResponse(JSON.stringify(completePayload({
      breakdown: [{ label: '正常', value: 80 }]
    })))).toThrow(VlmResponseError)
  })
})

describe('parseOllamaChatResponse', () => {
  it('rejects empty choices and empty message content', () => {
    expect(() => parseOllamaChatResponse({ choices: [] })).toThrow(/choices/)
    expect(() => parseOllamaChatResponse({ choices: [completeChatChoice('  ')] })).toThrow(/内容为空/)
  })

  it('rejects multiple choices even when the first choice is a complete safe result', () => {
    expect(() => parseOllamaChatResponse({
      choices: [
        completeChatChoice(JSON.stringify(completePayload())),
        completeChatChoice(JSON.stringify(completePayload({ hasRisk: true, riskScore: 80, level: 'A' })))
      ]
    })).toThrow(/只包含一个/)
  })

  it.each([
    {
      choices: [completeChatChoice(JSON.stringify(completePayload()), {
        result: completePayload({ hasRisk: true, riskScore: 80, level: 'A' })
      })]
    },
    {
      choices: [completeChatChoice(JSON.stringify(completePayload()), {
        message: {
          role: 'assistant',
          content: JSON.stringify(completePayload()),
          response: JSON.stringify(completePayload({ hasRisk: true, riskScore: 80, level: 'A' }))
        }
      })]
    }
  ])('rejects unsupported sibling output fields in the chat envelope: %o', (response) => {
    expect(() => parseOllamaChatResponse(response)).toThrow(/结构无效/)
  })

  it.each([
    completeChatChoice(JSON.stringify(completePayload()), { finish_reason: 'length' }),
    completeChatChoice(JSON.stringify(completePayload()), { finish_reason: 'content_filter' }),
    completeChatChoice(JSON.stringify(completePayload()), {
      message: {
        role: 'assistant',
        content: JSON.stringify(completePayload()),
        reasoning_content: { hasRisk: true }
      }
    }),
    completeChatChoice(JSON.stringify(completePayload()), {
      message: {
        role: 'assistant',
        content: JSON.stringify(completePayload()),
        refusal: { reason: 'unsafe' }
      }
    }),
    completeChatChoice(JSON.stringify(completePayload()), {
      message: {
        role: 'user',
        content: JSON.stringify(completePayload())
      }
    })
  ])('rejects an incomplete or non-assistant chat choice: %o', (choice) => {
    expect(() => parseOllamaChatResponse({ choices: [choice] })).toThrow(/结构无效/)
  })

  it('returns the normalized VLM source response header', () => {
    const result = parseOllamaChatResponse({
      choices: [completeChatChoice(JSON.stringify(completePayload()))],
      timings: {
        cache_n: 236,
        prompt_n: 1,
        predicted_n: 35,
        predicted_ms: 661.064
      },
      usage: {
        completion_tokens: 48,
        prompt_tokens: 44,
        total_tokens: 92
      }
    }, { 'x-vlm-source': 'cloud-fallback' })

    expect(result.modelSource).toBe('cloud-fallback')
    expect(normalizeVlmModelSource('unexpected')).toBe('unknown')
  })

  it('accepts BigModel request metadata without weakening the chat payload checks', () => {
    const result = parseOllamaChatResponse({
      request_id: 'req-bigmodel-1',
      choices: [completeChatChoice(JSON.stringify(completePayload()))]
    }, { 'x-vlm-source': 'cloud' })

    expect(result.modelSource).toBe('cloud')
    expect(result.analysis.hasRisk).toBe(false)
  })

  it('surfaces a streamed proxy error envelope as an operational error', () => {
    expect(() => parseOllamaChatResponse({
      error: {
        message: 'Qwen VLM 接口请求超时',
        type: 'timeout_error'
      }
    })).toThrow('Qwen VLM 接口请求超时')

    let caughtError: unknown
    try {
      parseOllamaChatResponse({ error: { message: 'upstream failed' } })
    } catch (error) {
      caughtError = error
    }
    expect(caughtError).toBeInstanceOf(Error)
    expect(caughtError).not.toBeInstanceOf(VlmResponseError)
  })
})
