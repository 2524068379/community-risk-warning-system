import { DEFAULT_VLM_MODEL_ALIAS } from './vlmModelConfig.js';

const LOCALHOST = '127.0.0.1';

function parseInteger(value, fallback, min) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value) {
  return String(value || '').toLowerCase() === 'true';
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

  return {
    host: parseHost(env.VLM_HOST),
    port: parseInteger(env.VLM_PORT, 11434, 1),
    modelAlias: parseModelAlias(env.VLM_MODEL),
    gpuLayers,
    contextSize: parseInteger(env.VLM_CONTEXT_SIZE, 4096, 512),
    startupTimeoutMs: parseInteger(env.VLM_STARTUP_TIMEOUT_MS, 60000, 5000)
  };
}
