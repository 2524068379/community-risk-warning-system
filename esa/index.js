export const API_HEALTH_ROUTE = '/api/health';
export const QWEN_CHAT_COMPLETIONS_ROUTE = '/api/qwen/chat/completions';
export const OLLAMA_CHAT_COMPLETIONS_ROUTE = '/api/ollama/chat/completions';
export const OLLAMA_STATUS_ROUTE = '/api/ollama/status';

export const DEFAULT_QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_QWEN_VLM_API_MODEL = 'qwen3-vl-plus';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_QWEN_TIMEOUT_MS = 120000;
const ALLOWED_QWEN_BASE_URLS = [
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  'https://dashscope-us.aliyuncs.com/compatible-mode/v1'
];
const ALLOWED_QWEN_MAAS_HOST_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}\.(cn-beijing|ap-southeast-1|ap-northeast-1)\.maas\.aliyuncs\.com$/;

function getEnv() {
  return typeof process !== 'undefined' && process.env ? process.env : {};
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
  const normalized = normalizeBaseUrl(rawUrl);
  if (ALLOWED_QWEN_BASE_URLS.includes(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (
      url.protocol === 'https:' &&
      url.pathname === '/compatible-mode/v1' &&
      ALLOWED_QWEN_MAAS_HOST_RE.test(url.hostname)
    ) {
      return normalized;
    }
  } catch {
    return '';
  }

  return '';
}

function resolveQwenChatCompletionsUrl(baseUrl) {
  return baseUrl ? `${baseUrl}/chat/completions` : '';
}

function parseTimeout(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 15000 && parsed <= 300000
    ? parsed
    : DEFAULT_QWEN_TIMEOUT_MS;
}

export function loadPagesApiConfig(env = getEnv()) {
  const baseUrl = resolveAllowedQwenBaseUrl(
    env.QWEN_BASE_URL || env.DASHSCOPE_BASE_URL || DEFAULT_QWEN_BASE_URL
  );

  return {
    baseUrl,
    chatCompletionsUrl: resolveQwenChatCompletionsUrl(baseUrl),
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

function buildCorsHeaders(request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return {};
  }

  const requestOrigin = new URL(request.url).origin;
  const extraOrigins = normalizeCorsOrigins(getEnv().CORS_ORIGIN);
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

function jsonResponse(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': JSON_CONTENT_TYPE,
      'cache-control': 'no-store',
      ...buildCorsHeaders(request),
      ...extraHeaders
    }
  });
}

function methodNotAllowed(request, allow) {
  return jsonResponse(request, {
    error: {
      message: 'Method not allowed',
      type: 'method_not_allowed'
    }
  }, 405, { allow });
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

async function fetchWithTimeout(url, init, timeoutMs) {
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

async function handleChatCompletions(request, config) {
  if (request.method !== 'POST') {
    return methodNotAllowed(request, 'POST, OPTIONS');
  }

  if (!config.chatCompletionsUrl || !config.apiKey) {
    return jsonResponse(request, {
      error: {
        message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置，请在 ESA Pages 环境变量中设置',
        type: 'configuration_error'
      }
    }, 500);
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
    }, 400);
  }

  const validationMessage = validateChatCompletionPayload(body);
  if (validationMessage) {
    return jsonResponse(request, {
      error: {
        message: validationMessage,
        type: 'invalid_request'
      }
    }, 400);
  }

  try {
    const upstreamResponse = await fetchWithTimeout(config.chatCompletionsUrl, {
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
        ...buildCorsHeaders(request)
      }
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return jsonResponse(request, {
      error: {
        message: isTimeout ? 'Qwen VLM 接口请求超时' : 'Qwen VLM 代理请求失败',
        type: isTimeout ? 'timeout_error' : 'proxy_error'
      }
    }, isTimeout ? 504 : 500);
  }
}

function handleHealth(request, config) {
  if (request.method !== 'GET') {
    return methodNotAllowed(request, 'GET, OPTIONS');
  }

  return jsonResponse(request, {
    ok: true,
    service: 'community-risk-warning-pages-api',
    qwenConfigured: Boolean(config.chatCompletionsUrl && config.apiKey),
    model: config.model,
    timestamp: new Date().toISOString()
  });
}

function handleVlmStatus(request, config) {
  if (request.method !== 'GET') {
    return methodNotAllowed(request, 'GET, OPTIONS');
  }

  const ready = Boolean(config.chatCompletionsUrl && config.apiKey);
  return jsonResponse(request, {
    ready,
    status: ready ? 'ready' : 'error',
    gpu: 'unknown'
  });
}

export async function handleRequest(request) {
  const config = loadPagesApiConfig();

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request)
    });
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === API_HEALTH_ROUTE) {
    return handleHealth(request, config);
  }

  if (pathname === OLLAMA_STATUS_ROUTE) {
    return handleVlmStatus(request, config);
  }

  if (pathname === QWEN_CHAT_COMPLETIONS_ROUTE || pathname === OLLAMA_CHAT_COMPLETIONS_ROUTE) {
    return handleChatCompletions(request, config);
  }

  return jsonResponse(request, {
    error: {
      message: 'Not found',
      type: 'not_found'
    }
  }, 404);
}

export default {
  fetch(request) {
    return handleRequest(request);
  }
};
