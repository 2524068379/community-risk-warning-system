export const VLM_RESPONSE_FIELDS = [
  'hasRisk',
  'riskScore',
  'level',
  'confidence',
  'hasLoitering',
  'hasGathering',
  'hasFallen',
  'summary',
  'evidenceTimeline',
  'breakdown',
  'detectionBoxes'
];

export const VLM_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: VLM_RESPONSE_FIELDS,
  properties: {
    hasRisk: { type: 'boolean' },
    riskScore: { type: 'integer', minimum: 0, maximum: 100 },
    level: { type: 'string', enum: ['A', 'B', 'C'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    hasLoitering: { type: 'boolean' },
    hasGathering: { type: 'boolean' },
    hasFallen: { type: 'boolean' },
    summary: {
      type: 'string',
      minLength: 1,
      description: '必须是单一字符串而非对象或数组；用 2-4 句中文依次说明画面情况、可见判断依据和风险结论，不得只回答是否有风险'
    },
    evidenceTimeline: {
      type: 'array',
      description: '无风险时必须为空数组；有风险时仅记录当前帧可见证据',
      items: { type: 'string', minLength: 1 }
    },
    breakdown: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: {
          label: { type: 'string', minLength: 1 },
          value: { type: 'integer', minimum: 0, maximum: 100 }
        }
      }
    },
    detectionBoxes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y', 'width', 'height', 'label', 'confidence', 'risk'],
        properties: {
          x: { type: 'number', minimum: 0, maximum: 1 },
          y: { type: 'number', minimum: 0, maximum: 1 },
          width: { type: 'number', minimum: 0, maximum: 1 },
          height: { type: 'number', minimum: 0, maximum: 1 },
          label: { type: 'string', minLength: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          risk: { type: 'boolean' }
        }
      }
    }
  }
};

export const VLM_RESPONSE_FORMAT = {
  type: 'json_schema',
  schema: VLM_RESPONSE_SCHEMA
};
