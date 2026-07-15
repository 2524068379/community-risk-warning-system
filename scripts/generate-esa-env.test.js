import { describe, expect, it } from 'vitest';
import { buildGeneratedEsaEnvModule, collectEsaEnv } from './generate-esa-env.js';

describe('generate ESA env module', () => {
  it('keeps only supported non-empty server env values', () => {
    expect(collectEsaEnv({
      QWEN_BASE_URL: ' https://open.bigmodel.cn/api/paas/v4 ',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash',
      ESA_VLM_API_BASE_URL: ' https://api.vendor.example/v1 ',
      ESA_VLM_API_KEY: 'vendor-key',
      ESA_VLM_API_PROFILE: 'generic',
      REQUEST_BODY_LIMIT: '2mb',
      MAX_CHAT_MESSAGES: '16',
      MAX_CHAT_TOKENS: '2048',
      MAX_UPSTREAM_RESPONSE_BYTES: '2097152',
      VLM_API_KEY: 'local-llama-key-must-not-be-reused',
      VITE_BAIDU_MAP_AK: 'browser-key',
      RANDOM_SECRET: 'ignored'
    })).toEqual({
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash',
      ESA_VLM_API_BASE_URL: 'https://api.vendor.example/v1',
      ESA_VLM_API_KEY: 'vendor-key',
      ESA_VLM_API_PROFILE: 'generic',
      REQUEST_BODY_LIMIT: '2mb',
      MAX_CHAT_MESSAGES: '16',
      MAX_CHAT_TOKENS: '2048',
      MAX_UPSTREAM_RESPONSE_BYTES: '2097152'
    });
  });

  it('generates an ESM default export for the edge function bundle', () => {
    expect(buildGeneratedEsaEnvModule({
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash'
    })).toContain('export default {');
    expect(buildGeneratedEsaEnvModule({
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash'
    })).toContain('"QWEN_MODEL": "glm-4v-flash"');
  });
});
