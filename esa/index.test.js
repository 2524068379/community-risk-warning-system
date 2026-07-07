import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QWEN_VLM_API_MODEL,
  buildVlmApiRequestBody,
  handleRequest,
  loadPagesApiConfig,
  resolveAllowedQwenBaseUrl
} from './index.js';

describe('ESA Pages API config', () => {
  it('uses Qwen VL hosted API defaults', () => {
    expect(loadPagesApiConfig({ DASHSCOPE_API_KEY: 'sk-test' })).toMatchObject({
      endpointKey: 'dashscope-cn',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      chatCompletionsUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: 'sk-test',
      model: DEFAULT_QWEN_VLM_API_MODEL
    });
  });

  it('rejects workspace-specific MaaS URLs unless they are added to the fixed endpoint table', () => {
    expect(resolveAllowedQwenBaseUrl(
      'https://workspace-abc123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/'
    )).toBe('');
  });

  it('allows the fixed BigModel OpenAI-compatible endpoint', () => {
    expect(loadPagesApiConfig({
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
      QWEN_API_KEY: 'sk-test'
    })).toMatchObject({
      endpointKey: 'bigmodel',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      chatCompletionsUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    });
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

  it('reads ESA runtime env bindings passed to the fetch handler', async () => {
    const runtimeEnv = {
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash'
    };

    const health = await handleRequest(new Request('https://demo.example/api/health'), runtimeEnv);
    const healthJson = await health.json();

    expect(health.status).toBe(200);
    expect(healthJson).toMatchObject({
      ok: true,
      qwenConfigured: true,
      model: 'glm-4v-flash'
    });

    const status = await handleRequest(new Request('https://demo.example/api/ollama/status'), runtimeEnv);
    const statusJson = await status.json();

    expect(status.status).toBe(200);
    expect(statusJson).toMatchObject({
      ready: true,
      status: 'ready'
    });
  });
});
