import { describe, expect, it } from 'vitest';
import { DEFAULT_VLM_MODEL_ALIAS } from './vlmModelConfig.js';
import { loadVlmRuntimeConfig } from './vlmRuntimeConfig.js';

describe('vlmRuntimeConfig', () => {
  it('defaults to a localhost CUDA-oriented runtime with MTP disabled', () => {
    expect(loadVlmRuntimeConfig({})).toEqual({
      host: '127.0.0.1',
      port: 11434,
      modelAlias: DEFAULT_VLM_MODEL_ALIAS,
      gpuLayers: 99,
      contextSize: 4096,
      batchSize: 512,
      ubatchSize: 256,
      cacheTypeK: 'f16',
      cacheTypeV: 'f16',
      startupTimeoutMs: 60000,
      mtpEnabled: false,
      mtpDraftTokens: 4
    });
  });

  it('supports CPU fallback, KV cache quantization and MTP toggling from environment variables', () => {
    expect(loadVlmRuntimeConfig({
      VLM_HOST: '0.0.0.0',
      VLM_PORT: '12345',
      VLM_MODEL: 'local-vlm',
      VLM_FORCE_CPU: 'true',
      VLM_CONTEXT_SIZE: '2048',
      VLM_BATCH_SIZE: '1024',
      VLM_UBATCH_SIZE: '128',
      VLM_CACHE_TYPE_K: 'q8_0',
      VLM_CACHE_TYPE_V: 'q4_0',
      VLM_STARTUP_TIMEOUT_MS: '15000',
      VLM_MTP_ENABLED: 'true',
      VLM_MTP_DRAFT_TOKENS: '8'
    })).toEqual({
      host: '127.0.0.1',
      port: 12345,
      modelAlias: 'local-vlm',
      gpuLayers: 0,
      contextSize: 2048,
      batchSize: 1024,
      ubatchSize: 128,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q4_0',
      startupTimeoutMs: 15000,
      mtpEnabled: true,
      mtpDraftTokens: 8
    });
  });

  it('falls back to f16 for unsupported or empty KV cache types', () => {
    const config = loadVlmRuntimeConfig({ VLM_CACHE_TYPE_K: 'q3_k_m', VLM_CACHE_TYPE_V: '' });
    expect(config.cacheTypeK).toBe('f16');
    expect(config.cacheTypeV).toBe('f16');
  });
});
