import { describe, expect, it } from 'vitest';
import { buildGeneratedEsaEnvModule, collectEsaEnv } from './generate-esa-env.js';

describe('generate ESA env module', () => {
  it('keeps only whitelisted non-empty server env values', () => {
    expect(collectEsaEnv({
      QWEN_BASE_URL: ' https://open.bigmodel.cn/api/paas/v4 ',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash',
      VITE_BAIDU_MAP_AK: 'browser-key',
      RANDOM_SECRET: 'ignored'
    })).toEqual({
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash'
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
