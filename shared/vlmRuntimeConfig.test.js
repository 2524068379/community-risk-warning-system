import { describe, expect, it } from 'vitest';
import { DEFAULT_VLM_MODEL_ALIAS } from './vlmModelConfig.js';
import { loadVlmRuntimeConfig } from './vlmRuntimeConfig.js';

describe('vlmRuntimeConfig', () => {
  it('defaults to a localhost CUDA-oriented runtime', () => {
    expect(loadVlmRuntimeConfig({})).toEqual({
      host: '127.0.0.1',
      port: 11434,
      modelAlias: DEFAULT_VLM_MODEL_ALIAS,
      gpuLayers: 99,
      contextSize: 4096,
      batchSize: 512,
      ubatchSize: 256,
      startupTimeoutMs: 60000,
      mtpEnabled: true,
      mtpDraftTokens: 4,
      mtpMinDraftTokens: 1,
      mtpMinProbability: 0.75
    });
  });

  it('supports CPU fallback and bounded startup tuning from environment variables', () => {
    expect(loadVlmRuntimeConfig({
      VLM_HOST: '0.0.0.0',
      VLM_PORT: '12345',
      VLM_MODEL: 'local-vlm',
      VLM_FORCE_CPU: 'true',
      VLM_CONTEXT_SIZE: '2048',
      VLM_BATCH_SIZE: '1024',
      VLM_UBATCH_SIZE: '128',
      VLM_STARTUP_TIMEOUT_MS: '15000',
      VLM_MTP_ENABLED: 'false',
      VLM_MTP_DRAFT_TOKENS: '8',
      VLM_MTP_MIN_DRAFT_TOKENS: '2',
      VLM_MTP_MIN_PROBABILITY: '0.6'
    })).toEqual({
      host: '127.0.0.1',
      port: 12345,
      modelAlias: 'local-vlm',
      gpuLayers: 0,
      contextSize: 2048,
      batchSize: 1024,
      ubatchSize: 128,
      startupTimeoutMs: 15000,
      mtpEnabled: false,
      mtpDraftTokens: 8,
      mtpMinDraftTokens: 2,
      mtpMinProbability: 0.6
    });
  });
});
