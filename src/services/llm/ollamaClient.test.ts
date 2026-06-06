import { describe, expect, it } from 'vitest'
import { OLLAMA_MODEL, parseVlmResponse } from './ollamaClient'
import { DEFAULT_VLM_MODEL_ALIAS } from '../../../shared/vlmModelConfig.js'

describe('ollamaClient model configuration', () => {
  it('uses the configured Unsloth Qwen3.5 MTP GGUF model alias', () => {
    expect(OLLAMA_MODEL).toBe(DEFAULT_VLM_MODEL_ALIAS)
  })
})

describe('parseVlmResponse', () => {
  it('drops detection boxes with missing size or confidence fields', () => {
    const result = parseVlmResponse(JSON.stringify({
      hasRisk: true,
      riskScore: 70,
      level: 'B',
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
    }))

    expect(result.boxes).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
    ])
  })

  it('clamps numeric detection box fields and defaults missing risk to false', () => {
    const result = parseVlmResponse(JSON.stringify({
      hasRisk: true,
      riskScore: 70,
      level: 'B',
      confidence: 0.8,
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: -0.2, y: 1.2, width: 2, height: 0.5, label: 'out of bounds', confidence: 1.5 }
      ]
    }))

    expect(result.boxes).toEqual([
      { x: 0, y: 1, width: 1, height: 0.5, label: 'out of bounds', confidence: 1, risk: false }
    ])
  })

  it('drops detection boxes with non-finite numeric fields', () => {
    const result = parseVlmResponse(JSON.stringify({
      hasRisk: true,
      riskScore: 70,
      level: 'B',
      confidence: 0.8,
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: 'bad', y: 0.2, width: 0.3, height: 0.4, label: 'invalid', confidence: 0.9, risk: true },
        { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
      ]
    }))

    expect(result.boxes).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
    ])
  })

  it('normalizes numeric detection box fields returned as strings', () => {
    const result = parseVlmResponse(JSON.stringify({
      hasRisk: true,
      riskScore: '70',
      level: 'B',
      confidence: '80%',
      summary: 'risk found',
      evidenceTimeline: [],
      breakdown: [{ label: 'risk', value: 100 }],
      detectionBoxes: [
        { x: '0.1', y: '0.2', width: '0.3', height: '0.4', label: 'valid', confidence: '0.9', risk: true }
      ]
    }))

    expect(result.analysis.confidence).toBe(0.8)
    expect(result.boxes).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4, label: 'valid', confidence: 0.9, risk: true }
    ])
  })

  it('parses JSON wrapped in a markdown code fence with a language identifier', () => {
    const raw = '```json\n{"hasRisk":false,"riskScore":10,"level":"C","confidence":0.7,"summary":"正常","evidenceTimeline":[],"breakdown":[{"label":"正常","value":100}],"detectionBoxes":[]}\n```'
    const result = parseVlmResponse(raw)
    expect(result.analysis.summary).toBe('正常')
    expect(result.analysis.riskScore).toBe(10)
  })

  it('parses JSON surrounded by <think> reasoning tags and trailing prose', () => {
    const raw = '<think>analyzing the scene...</think>\nHere is the result:\n{"hasRisk":true,"riskScore":60,"level":"B","confidence":0.8,"hasLoitering":true,"summary":"发现徘徊人员","evidenceTimeline":["10:01 人员徘徊"],"breakdown":[{"label":"治安","value":100}],"detectionBoxes":[]}'
    const result = parseVlmResponse(raw)
    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.hasLoitering).toBe(true)
    expect(result.analysis.summary).toBe('发现徘徊人员')
  })

  it('recovers from trailing commas in JSON arrays and objects', () => {
    const raw = '{"hasRisk":false,"riskScore":5,"level":"C","confidence":0.9,"summary":"正常","evidenceTimeline":[],"breakdown":[{"label":"正常","value":100,}],"detectionBoxes":[],"hasLoitering":false,}'
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
      "hasGathering": true,
      "evidenceTimeline": [],
      "breakdown": [{"label": "治安", "value": 100}],
      "detectionBoxes": []
    }`
    const result = parseVlmResponse(raw)
    expect(result.analysis.hasGathering).toBe(true)
    expect(result.analysis.riskScore).toBe(45)
  })

  it('uses plain text as a low-confidence summary when the response contains no JSON', () => {
    const result = parseVlmResponse('画面中未发现明显社区安全风险。')
    expect(result.analysis.summary).toBe('画面中未发现明显社区安全风险。')
    expect(result.analysis.confidence).toBe(0.2)
    expect(result.boxes).toEqual([])
  })

  it('extracts nested JSON correctly when JSON is embedded inside prose with braces', () => {
    const raw = '说明：结果对象为 {"hasRisk":false,"riskScore":15,"level":"C","confidence":0.5,"summary":"画面清晰","evidenceTimeline":[],"breakdown":[{"label":"正常","value":100}],"detectionBoxes":[]}，请查收。'
    const result = parseVlmResponse(raw)
    expect(result.analysis.summary).toBe('画面清晰')
  })

  it('parses JSON-like model output with single quotes, unquoted keys, and Python booleans', () => {
    const raw = "{hasRisk: True, riskScore: 62, level: 'B', confidence: 0.71, summary: '消防通道疑似被占用', evidenceTimeline: ['10:01 消防通道被占用'], breakdown: [{'label': '消防', 'value': 100}], detectionBoxes: []}"
    const result = parseVlmResponse(raw)
    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.summary).toBe('消防通道疑似被占用')
    expect(result.analysis.evidenceTimeline).toEqual(['10:01 消防通道被占用'])
    expect(result.analysis.breakdown).toEqual([{ label: '消防', value: 100 }])
  })

  it('keeps parsing JSON that appears after an unclosed think tag', () => {
    const raw = '<think>先观察画面\n{"hasRisk":true,"riskScore":55,"level":"B","confidence":0.7,"summary":"检测到异常聚集","evidenceTimeline":[],"breakdown":[{"label":"治安","value":100}],"detectionBoxes":[]}'
    const result = parseVlmResponse(raw)
    expect(result.analysis.summary).toBe('检测到异常聚集')
    expect(result.analysis.riskScore).toBe(55)
  })

  it('unwraps structured results returned inside common response envelopes', () => {
    const result = parseVlmResponse({
      result: {
        risk_score: 35,
        risk_level: 'B级',
        confidence: 0.6,
        has_risk: '是',
        description: '发现人员聚集',
        evidence_timeline: '10:01 入口聚集；10:02 人群未散开',
        risk_breakdown: { 治安: 100 },
        boxes: []
      }
    })

    expect(result.analysis.hasRisk).toBe(true)
    expect(result.analysis.riskScore).toBe(35)
    expect(result.analysis.level).toBe('B')
    expect(result.analysis.summary).toBe('发现人员聚集')
    expect(result.analysis.evidenceTimeline).toEqual(['10:01 入口聚集', '10:02 人群未散开'])
  })

  it('uses the first structured object from a JSON array response', () => {
    const raw = '[{"hasRisk":false,"riskScore":8,"level":"C","confidence":0.9,"summary":"正常","evidenceTimeline":[],"breakdown":[{"label":"正常","value":100}],"detectionBoxes":[]}]'
    const result = parseVlmResponse(raw)
    expect(result.analysis.summary).toBe('正常')
    expect(result.analysis.riskScore).toBe(8)
  })
})
