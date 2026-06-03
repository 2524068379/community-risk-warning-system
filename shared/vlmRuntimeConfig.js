import { DEFAULT_VLM_MODEL_ALIAS } from './vlmModelConfig.js';

const LOCALHOST = '127.0.0.1';

function parseInteger(value, fallback, min) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).toLowerCase() === 'true';
}

function parseFloatInRange(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function parseHost(value) {
  const host = String(value || '').trim();
  if (host === LOCALHOST || host === 'localhost') {
    return host;
  }

  return LOCALHOST;
}

function parseModelAlias(value) {
  const alias = String(value || '').trim();
  return alias || DEFAULT_VLM_MODEL_ALIAS;
}

export function loadVlmRuntimeConfig(env = process.env) {
  const forceCpu = parseBoolean(env.VLM_FORCE_CPU);
  const gpuLayers = forceCpu ? 0 : parseInteger(env.VLM_GPU_LAYERS, 99, 0);
  const batchSize = parseInteger(env.VLM_BATCH_SIZE, 512, 1);
  const ubatchSize = parseInteger(env.VLM_UBATCH_SIZE, 256, 1);

  return {
    host: parseHost(env.VLM_HOST),
    port: parseInteger(env.VLM_PORT, 11434, 1),
    modelAlias: parseModelAlias(env.VLM_MODEL),
    gpuLayers,
    contextSize: parseInteger(env.VLM_CONTEXT_SIZE, 4096, 512),
    batchSize,
    ubatchSize,
    startupTimeoutMs: parseInteger(env.VLM_STARTUP_TIMEOUT_MS, 60000, 5000),
    mtpEnabled: parseBoolean(env.VLM_MTP_ENABLED, true),
    mtpDraftTokens: parseInteger(env.VLM_MTP_DRAFT_TOKENS, 4, 1),
    mtpMinDraftTokens: parseInteger(env.VLM_MTP_MIN_DRAFT_TOKENS, 1, 0),
    mtpMinProbability: parseFloatInRange(env.VLM_MTP_MIN_PROBABILITY, 0.75, 0, 1)
  };
}
