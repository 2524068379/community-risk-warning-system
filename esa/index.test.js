import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QWEN_VLM_API_MODEL,
  buildVlmApiRequestBody,
  loadPagesApiConfig,
  resolveAllowedQwenBaseUrl
} from './index.js';

describe('ESA Pages API config', () => {
  it('uses Qwen VL hosted API defaults', () => {
    expect(loadPagesApiConfig({ DASHSCOPE_API_KEY: 'sk-test' })).toMatchObject({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      chatCompletionsUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: 'sk-test',
      model: DEFAULT_QWEN_VLM_API_MODEL
    });
  });

  it('allows Bailian workspace-specific OpenAI-compatible endpoints', () => {
    expect(resolveAllowedQwenBaseUrl(
      'https://workspace-abc123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/'
    )).toBe('https://workspace-abc123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
  });

  it('blocks unsupported upstream URLs', () => {
    expect(resolveAllowedQwenBaseUrl('http://169.254.169.254/latest/meta-data')).toBe('');
  });

  it('forces the configured VLM model and removes local-only llama options', () => {
    expect(buildVlmApiRequestBody({
      model: 'local-model',
      stream: true,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: 'user', content: 'JSON only' }]
    }, 'qwen3-vl-plus')).toEqual({
      model: 'qwen3-vl-plus',
      stream: false,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'JSON only' }]
    });
  });
});
