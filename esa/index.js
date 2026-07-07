export const API_HEALTH_ROUTE = '/api/health';
export const QWEN_CHAT_COMPLETIONS_ROUTE = '/api/qwen/chat/completions';
export const OLLAMA_CHAT_COMPLETIONS_ROUTE = '/api/ollama/chat/completions';
export const OLLAMA_STATUS_ROUTE = '/api/ollama/status';

export const DEFAULT_QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_QWEN_VLM_API_MODEL = 'qwen3-vl-plus';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_QWEN_TIMEOUT_MS = 120000;
const QWEN_ENDPOINT_KEYS = {
  DASHSCOPE_CN: 'dashscope-cn',
  DASHSCOPE_INTL: 'dashscope-intl',
  DASHSCOPE_US: 'dashscope-us',
  BIGMODEL: 'bigmodel'
};

const QWEN_ENDPOINTS = {
  DASHSCOPE_CN: {
    key: QWEN_ENDPOINT_KEYS.DASHSCOPE_CN,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatCompletionsUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  },
  DASHSCOPE_INTL: {
    key: QWEN_ENDPOINT_KEYS.DASHSCOPE_INTL,
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    chatCompletionsUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'
  },
  DASHSCOPE_US: {
    key: QWEN_ENDPOINT_KEYS.DASHSCOPE_US,
    baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
    chatCompletionsUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions'
  },
  BIGMODEL: {
    key: QWEN_ENDPOINT_KEYS.BIGMODEL,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    chatCompletionsUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  }
};

function normalizeRuntimeEnv(runtimeEnv = {}) {
  return runtimeEnv && typeof runtimeEnv === 'object' && !Array.isArray(runtimeEnv)
    ? runtimeEnv
    : {};
}

function getEnv(runtimeEnv = {}) {
  const processEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  return {
    ...processEnv,
    ...normalizeRuntimeEnv(runtimeEnv)
  };
}

function normalizeBaseUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function resolveAllowedQwenBaseUrl(rawUrl = DEFAULT_QWEN_BASE_URL) {
  return resolveQwenEndpoint(rawUrl).baseUrl;
}

function resolveQwenEndpoint(rawBaseUrl = DEFAULT_QWEN_BASE_URL) {
  switch (normalizeBaseUrl(rawBaseUrl || DEFAULT_QWEN_BASE_URL)) {
    case QWEN_ENDPOINTS.DASHSCOPE_CN.baseUrl:
      return QWEN_ENDPOINTS.DASHSCOPE_CN;
    case QWEN_ENDPOINTS.DASHSCOPE_INTL.baseUrl:
      return QWEN_ENDPOINTS.DASHSCOPE_INTL;
    case QWEN_ENDPOINTS.DASHSCOPE_US.baseUrl:
      return QWEN_ENDPOINTS.DASHSCOPE_US;
    case QWEN_ENDPOINTS.BIGMODEL.baseUrl:
      return QWEN_ENDPOINTS.BIGMODEL;
    default:
      return { key: '', baseUrl: '', chatCompletionsUrl: '' };
  }
}

function parseTimeout(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 15000 && parsed <= 300000
    ? parsed
    : DEFAULT_QWEN_TIMEOUT_MS;
}

export function loadPagesApiConfig(env = getEnv()) {
  const endpoint = resolveQwenEndpoint(
    env.QWEN_BASE_URL || env.DASHSCOPE_BASE_URL || DEFAULT_QWEN_BASE_URL
  );

  return {
    endpointKey: endpoint.key,
    baseUrl: endpoint.baseUrl,
    chatCompletionsUrl: endpoint.chatCompletionsUrl,
    apiKey: env.QWEN_API_KEY || env.DASHSCOPE_API_KEY || '',
    model: env.QWEN_MODEL || env.DASHSCOPE_MODEL || DEFAULT_QWEN_VLM_API_MODEL,
    timeoutMs: parseTimeout(env.QWEN_TIMEOUT || env.DASHSCOPE_TIMEOUT)
  };
}

function normalizeCorsOrigins(rawOrigin = '') {
  return String(rawOrigin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildCorsHeaders(request, env = getEnv()) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return {};
  }

  const requestOrigin = new URL(request.url).origin;
  const extraOrigins = normalizeCorsOrigins(env.CORS_ORIGIN);
  if (origin !== requestOrigin && !extraOrigins.includes(origin)) {
    return {};
  }

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function jsonResponse(request, body, status = 200, extraHeaders = {}, env = getEnv()) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': JSON_CONTENT_TYPE,
      'cache-control': 'no-store',
      ...buildCorsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function methodNotAllowed(request, allow, env = getEnv()) {
  return jsonResponse(request, {
    error: {
      message: 'Method not allowed',
      type: 'method_not_allowed'
    }
  }, 405, { allow }, env);
}

function validateChatCompletionPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'request body must be an object';
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return 'messages must be a non-empty array';
  }

  return '';
}

export function buildVlmApiRequestBody(body = {}, model = DEFAULT_QWEN_VLM_API_MODEL) {
  const requestBody = {
    ...body,
    model,
    stream: false
  };

  delete requestBody.chat_template_kwargs;
  return requestBody;
}

async function fetchStaticQwenEndpoint(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function fetchKnownQwenChatCompletions(endpointKey, init, timeoutMs) {
  switch (endpointKey) {
    case QWEN_ENDPOINT_KEYS.DASHSCOPE_CN:
      return fetchStaticQwenEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', init, timeoutMs);
    case QWEN_ENDPOINT_KEYS.DASHSCOPE_INTL:
      return fetchStaticQwenEndpoint('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', init, timeoutMs);
    case QWEN_ENDPOINT_KEYS.DASHSCOPE_US:
      return fetchStaticQwenEndpoint('https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions', init, timeoutMs);
    case QWEN_ENDPOINT_KEYS.BIGMODEL:
      return fetchStaticQwenEndpoint('https://open.bigmodel.cn/api/paas/v4/chat/completions', init, timeoutMs);
    default:
      throw new Error('Unsupported Qwen upstream endpoint');
  }
}

async function handleChatCompletions(request, config, env) {
  if (request.method !== 'POST') {
    return methodNotAllowed(request, 'POST, OPTIONS', env);
  }

  if (!config.endpointKey || !config.apiKey) {
    return jsonResponse(request, {
      error: {
        message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置，请在 ESA Pages 环境变量中设置',
        type: 'configuration_error'
      }
    }, 500, {}, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, {
      error: {
        message: 'request body must be valid JSON',
        type: 'invalid_request'
      }
    }, 400, {}, env);
  }

  const validationMessage = validateChatCompletionPayload(body);
  if (validationMessage) {
    return jsonResponse(request, {
      error: {
        message: validationMessage,
        type: 'invalid_request'
      }
    }, 400, {}, env);
  }

  try {
    const upstreamResponse = await fetchKnownQwenChatCompletions(config.endpointKey, {
      method: 'POST',
      headers: {
        'content-type': JSON_CONTENT_TYPE,
        authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(buildVlmApiRequestBody(body, config.model))
    }, config.timeoutMs);

    const text = await upstreamResponse.text();
    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        'content-type': upstreamResponse.headers.get('content-type') || JSON_CONTENT_TYPE,
        'cache-control': 'no-store',
        ...buildCorsHeaders(request, env)
      }
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return jsonResponse(request, {
      error: {
        message: isTimeout ? 'Qwen VLM 接口请求超时' : 'Qwen VLM 代理请求失败',
        type: isTimeout ? 'timeout_error' : 'proxy_error'
      }
    }, isTimeout ? 504 : 500, {}, env);
  }
}

function handleHealth(request, config, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(request, 'GET, OPTIONS', env);
  }

  return jsonResponse(request, {
    ok: true,
    service: 'community-risk-warning-pages-api',
    qwenConfigured: Boolean(config.chatCompletionsUrl && config.apiKey),
    model: config.model,
    timestamp: new Date().toISOString()
  }, 200, {}, env);
}

function handleVlmStatus(request, config, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(request, 'GET, OPTIONS', env);
  }

  const ready = Boolean(config.chatCompletionsUrl && config.apiKey);
  return jsonResponse(request, {
    ready,
    status: ready ? 'ready' : 'error',
    gpu: 'unknown'
  }, 200, {}, env);
}

export async function handleRequest(request, runtimeEnv = {}) {
  const env = getEnv(runtimeEnv);
  const config = loadPagesApiConfig(env);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request, env)
    });
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === API_HEALTH_ROUTE) {
    return handleHealth(request, config, env);
  }

  if (pathname === OLLAMA_STATUS_ROUTE) {
    return handleVlmStatus(request, config, env);
  }

  if (pathname === QWEN_CHAT_COMPLETIONS_ROUTE || pathname === OLLAMA_CHAT_COMPLETIONS_ROUTE) {
    return handleChatCompletions(request, config, env);
  }

  return jsonResponse(request, {
    error: {
      message: 'Not found',
      type: 'not_found'
    }
  }, 404, {}, env);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
