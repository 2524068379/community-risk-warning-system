import { DEFAULT_VLM_MODEL_ALIAS } from './vlmModelConfig.js';
import { parseBoolean, parseInteger } from './envParsers.js';

const LOCALHOST = '127.0.0.1';

// llama.cpp 支持的 KV cache 数据类型；量化为 q8_0/q4_0 可显著降低显存占用。
const VALID_CACHE_TYPES = ['f32', 'f16', 'bf16', 'q8_0', 'q4_0', 'q4_1', 'q5_0', 'q5_1'];

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

function parseCacheType(value, fallback) {
  const type = String(value || '').trim().toLowerCase();
  return VALID_CACHE_TYPES.includes(type) ? type : fallback;
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
    // KV cache 量化：默认 f16 保持精度，8GB 显存可设 q8_0 近乎无损地省下约一半 KV 显存。
    cacheTypeK: parseCacheType(env.VLM_CACHE_TYPE_K, 'f16'),
    cacheTypeV: parseCacheType(env.VLM_CACHE_TYPE_V, 'f16'),
    startupTimeoutMs: parseInteger(env.VLM_STARTUP_TIMEOUT_MS, 60000, 5000),
    // MTP（draft-mtp 推测解码）默认关闭：相关 --spec-* 参数只存在于 llama.cpp 的 MTP
    // 专用分支（官方预编译包不含），与 mmproj 视觉编码器互斥，且仅加速文本生成、对视觉
    // 编码无效；对以视觉研判为核心、运行在 8GB 显存上的本项目不适用。
    mtpEnabled: parseBoolean(env.VLM_MTP_ENABLED, false),
    mtpDraftTokens: parseInteger(env.VLM_MTP_DRAFT_TOKENS, 4, 1)
  };
}
