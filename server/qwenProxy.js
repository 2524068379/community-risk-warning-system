import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import http from 'node:http';
import { resolveOllamaHealthStatus } from './ollamaHealthStatus.js';
import {
  API_HEALTH_ROUTE,
  OLLAMA_CHAT_COMPLETIONS_ROUTE,
  OLLAMA_STATUS_ROUTE,
  QWEN_CHAT_COMPLETIONS_ROUTE
} from '../shared/apiRoutes.js';
import { DEFAULT_QWEN_VLM_API_MODEL, DEFAULT_VLM_MODEL_ALIAS } from '../shared/vlmModelConfig.js';
import { loadVlmRuntimeConfig } from '../shared/vlmRuntimeConfig.js';
import { parseBoolean, parseInteger } from '../shared/envParsers.js';

export const LOCAL_PROXY_TOKEN_HEADER = 'x-local-proxy-token';

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173'];
const QWEN_TIMEOUT_OPTIONS_MS = [15_000, 30_000, 60_000, 90_000, 120_000];
const OLLAMA_TIMEOUT_OPTIONS_MS = [30_000, 60_000, 120_000, 180_000, 300_000];
const OLLAMA_HEALTH_TIMEOUT_MS = 3000;
const LOCAL_OLLAMA_HOST = '127.0.0.1';
const LOOPBACK_HOST_NAMES = new Set(['127.0.0.1', 'localhost']);
const QWEN_ENDPOINT_KEYS = {
  LOCAL_LM_STUDIO: 'local-lm-studio',
  LOCAL_LM_STUDIO_HOSTNAME: 'local-lm-studio-hostname',
  LOCAL_OLLAMA: 'local-ollama',
  LOCAL_OLLAMA_HOSTNAME: 'local-ollama-hostname',
  DASHSCOPE_CN: 'dashscope-cn',
  DASHSCOPE_INTL: 'dashscope-intl',
  DASHSCOPE_US: 'dashscope-us',
  BIGMODEL: 'bigmodel'
};

const QWEN_ENDPOINTS = {
  LOCAL_LM_STUDIO: {
    key: QWEN_ENDPOINT_KEYS.LOCAL_LM_STUDIO,
    baseUrl: 'http://127.0.0.1:1234/v1',
    chatCompletionsUrl: 'http://127.0.0.1:1234/v1/chat/completions'
  },
  LOCAL_LM_STUDIO_HOSTNAME: {
    key: QWEN_ENDPOINT_KEYS.LOCAL_LM_STUDIO_HOSTNAME,
    baseUrl: 'http://localhost:1234/v1',
    chatCompletionsUrl: 'http://localhost:1234/v1/chat/completions'
  },
  LOCAL_OLLAMA: {
    key: QWEN_ENDPOINT_KEYS.LOCAL_OLLAMA,
    baseUrl: 'http://127.0.0.1:11434/v1',
    chatCompletionsUrl: 'http://127.0.0.1:11434/v1/chat/completions'
  },
  LOCAL_OLLAMA_HOSTNAME: {
    key: QWEN_ENDPOINT_KEYS.LOCAL_OLLAMA_HOSTNAME,
    baseUrl: 'http://localhost:11434/v1',
    chatCompletionsUrl: 'http://localhost:11434/v1/chat/completions'
  },
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

function normalizeHost(host) {
  const trimmed = String(host || '').trim();
  return trimmed || '127.0.0.1';
}

function normalizeLoopbackHost(host) {
  const trimmed = String(host || '').trim();
  return LOOPBACK_HOST_NAMES.has(trimmed) ? trimmed : LOCAL_OLLAMA_HOST;
}

function parseTimeoutOption(value, fallback, options) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < options[0]) {
    return fallback;
  }

  return options.find((option) => parsed <= option) ?? fallback;
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

function resolveQwenEndpoint(rawBaseUrl) {
  switch (normalizeBaseUrl(rawBaseUrl)) {
    case QWEN_ENDPOINTS.LOCAL_LM_STUDIO.baseUrl:
      return QWEN_ENDPOINTS.LOCAL_LM_STUDIO;
    case QWEN_ENDPOINTS.LOCAL_LM_STUDIO_HOSTNAME.baseUrl:
      return QWEN_ENDPOINTS.LOCAL_LM_STUDIO_HOSTNAME;
    case QWEN_ENDPOINTS.LOCAL_OLLAMA.baseUrl:
      return QWEN_ENDPOINTS.LOCAL_OLLAMA;
    case QWEN_ENDPOINTS.LOCAL_OLLAMA_HOSTNAME.baseUrl:
      return QWEN_ENDPOINTS.LOCAL_OLLAMA_HOSTNAME;
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

function fetchKnownQwenChatCompletions(endpointKey, init) {
  switch (endpointKey) {
    case QWEN_ENDPOINT_KEYS.LOCAL_LM_STUDIO:
      return fetch('http://127.0.0.1:1234/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.LOCAL_LM_STUDIO_HOSTNAME:
      return fetch('http://localhost:1234/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.LOCAL_OLLAMA:
      return fetch('http://127.0.0.1:11434/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.LOCAL_OLLAMA_HOSTNAME:
      return fetch('http://localhost:11434/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.DASHSCOPE_CN:
      return fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.DASHSCOPE_INTL:
      return fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.DASHSCOPE_US:
      return fetch('https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions', init);
    case QWEN_ENDPOINT_KEYS.BIGMODEL:
      return fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', init);
    default:
      throw new Error('Unsupported Qwen upstream endpoint');
  }
}

function parseCorsOrigin(rawOrigin = 'http://localhost:5173') {
  const trimmed = rawOrigin.trim();
  if (trimmed === '*') {
    return [...DEFAULT_CORS_ORIGINS];
  }

  const origins = trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : [...DEFAULT_CORS_ORIGINS];
}

export function isAllowedCorsOrigin(origin, corsOrigin, allowLocalFileOrigins = false) {
  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return allowLocalFileOrigins;
  }

  return Array.isArray(corsOrigin) && corsOrigin.includes(origin);
}

function createCorsOriginOption(config) {
  return (origin, callback) => {
    callback(null, isAllowedCorsOrigin(origin, config.corsOrigin, config.allowLocalFileOrigins));
  };
}

export function loadQwenProxyConfig(env = process.env) {
  const vlmRuntimeConfig = loadVlmRuntimeConfig(env);
  const qwenEndpoint = resolveQwenEndpoint(env.QWEN_BASE_URL);
  const ollamaHost = normalizeLoopbackHost(vlmRuntimeConfig.host);
  const ollamaPort = parseInteger(vlmRuntimeConfig.port, 11434, 1);

  return {
    host: normalizeHost(env.SERVER_HOST || '127.0.0.1'),
    port: parseInteger(env.SERVER_PORT, 8787),
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN || 'http://localhost:5173'),
    allowLocalFileOrigins: parseBoolean(env.ALLOW_LOCAL_FILE_ORIGINS, false),
    qwenEndpointKey: qwenEndpoint.key,
    qwenBaseUrl: qwenEndpoint.baseUrl,
    qwenChatCompletionsUrl: qwenEndpoint.chatCompletionsUrl,
    qwenApiKey: env.QWEN_API_KEY || '',
    qwenModel: env.QWEN_MODEL || DEFAULT_QWEN_VLM_API_MODEL,
    qwenTimeout: parseTimeoutOption(env.QWEN_TIMEOUT, 60_000, QWEN_TIMEOUT_OPTIONS_MS),
    ollamaTimeout: parseTimeoutOption(env.OLLAMA_TIMEOUT, 120_000, OLLAMA_TIMEOUT_OPTIONS_MS),
    ollamaModel: vlmRuntimeConfig.modelAlias,
    requestBodyLimit: env.REQUEST_BODY_LIMIT || '2mb',
    chatRequestsPerMinute: parseInteger(env.CHAT_REQUESTS_PER_MINUTE, 30, 0),
    maxChatMessages: parseInteger(env.MAX_CHAT_MESSAGES, 16),
    maxChatTokens: parseInteger(env.MAX_CHAT_TOKENS, 2048),
    localProxyToken: env.LOCAL_PROXY_TOKEN || '',
    logModelOutput: parseBoolean(env.LOG_MODEL_OUTPUT, false),
    ollamaHost,
    ollamaPort,
    ollamaBaseUrl: `http://${ollamaHost}:${ollamaPort}`
  };
}

export function buildQwenRequestBody(body = {}, defaultModel) {
  const requestBody = { ...body };

  if (!requestBody.model) {
    requestBody.model = defaultModel;
  }

  return requestBody;
}

export function buildQwenFallbackRequestBody(body = {}, model) {
  const requestBody = {
    ...body,
    model,
    stream: false
  };

  delete requestBody.chat_template_kwargs;
  return requestBody;
}

export function buildOllamaRequestBody(body = {}, model) {
  return {
    ...body,
    model,
    response_format: body.response_format ?? { type: 'json_object' },
    chat_template_kwargs: {
      ...(body.chat_template_kwargs || {}),
      enable_thinking: false
    }
  };
}

export function isQwenProxyConfigured(config = loadQwenProxyConfig()) {
  return Boolean(config.qwenEndpointKey && config.qwenApiKey);
}

export function shouldFallbackToQwen(response) {
  return response.status === 404 || response.status >= 500;
}

export function resolveVlmProxyStatus(localStatus, config = loadQwenProxyConfig()) {
  if (localStatus.ready) {
    return { ...localStatus, source: 'local' };
  }

  if (isQwenProxyConfigured(config)) {
    return {
      ready: true,
      status: 'ready',
      gpu: 'unknown',
      source: 'cloud'
    };
  }

  return { ...localStatus, source: 'local' };
}

export function parseProxyResponseText(text, onInvalidJson) {
  try {
    return JSON.parse(text);
  } catch {
    onInvalidJson?.(text);
    return { raw: text };
  }
}

export function buildProxyErrorResponse(error, options) {
  const isAbortError = error instanceof Error && error.name === 'AbortError';
  return {
    statusCode: isAbortError ? 504 : 500,
    body: {
      error: {
        message: isAbortError
          ? options.timeoutMessage
          : error instanceof Error
            ? error.message
            : options.fallbackMessage,
        type: isAbortError ? options.timeoutType : options.fallbackType
      }
    }
  };
}

function requestLocalOllamaText(config, options) {
  const hostname = config.ollamaHost === 'localhost' ? 'localhost' : LOCAL_OLLAMA_HOST;

  return new Promise((resolve, reject) => {
    const upstreamRequest = http.request({
      hostname,
      port: config.ollamaPort,
      path: options.path,
      method: options.method,
      headers: options.headers,
      signal: options.signal
    }, (upstreamResponse) => {
      upstreamResponse.setEncoding('utf8');

      let text = '';
      upstreamResponse.on('data', (chunk) => {
        text += chunk;
      });
      upstreamResponse.on('end', () => {
        resolve({
          status: upstreamResponse.statusCode || 502,
          text
        });
      });
    });

    upstreamRequest.on('error', reject);

    if (options.body) {
      upstreamRequest.write(options.body);
    }

    upstreamRequest.end();
  });
}

export function isLocalProxyTokenProtectedPath(pathname) {
  return pathname === QWEN_CHAT_COMPLETIONS_ROUTE || pathname === OLLAMA_CHAT_COMPLETIONS_ROUTE;
}

export function isLocalProxyTokenAuthorized(pathname, token, config = loadQwenProxyConfig()) {
  if (!config.localProxyToken || !isLocalProxyTokenProtectedPath(pathname)) {
    return true;
  }

  return token === config.localProxyToken;
}

function createLocalProxyTokenGuard(config) {
  return (req, res, next) => {
    const token = req.get(LOCAL_PROXY_TOKEN_HEADER);
    if (isLocalProxyTokenAuthorized(req.path, token, config)) {
      return next();
    }

    return res.status(403).json({
      error: {
        message: '本地代理请求未授权',
        type: 'forbidden'
      }
    });
  };
}

export function buildExpressErrorResponse(error) {
  const statusCandidate = Number(error?.status ?? error?.statusCode);
  const statusCode = Number.isInteger(statusCandidate) && statusCandidate >= 400 && statusCandidate < 600
    ? statusCandidate
    : 500;
  const message = error instanceof Error && error.message
    ? error.message
    : statusCode >= 500
      ? 'Internal server error'
      : 'Invalid request';

  return {
    statusCode,
    body: {
      error: {
        message,
        type: statusCode >= 500 ? 'internal_error' : 'invalid_request'
      }
    }
  };
}

export function validateChatCompletionPayload(body = {}, config = loadQwenProxyConfig()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be an object' };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, message: 'messages must be a non-empty array' };
  }

  if (body.messages.length > config.maxChatMessages) {
    return { ok: false, message: 'messages exceeds the configured limit' };
  }

  if (body.max_tokens !== undefined && body.max_tokens !== null) {
    const maxTokens = Number(body.max_tokens);
    if (!Number.isFinite(maxTokens) || maxTokens < 1) {
      return { ok: false, message: 'max_tokens must be a positive number' };
    }

    if (maxTokens > config.maxChatTokens) {
      return { ok: false, message: 'max_tokens exceeds the configured limit' };
    }
  }

  return { ok: true };
}

function createChatPayloadValidator(config) {
  return (req, res, next) => {
    const validation = validateChatCompletionPayload(req.body, config);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          message: validation.message,
          type: 'invalid_request'
        }
      });
    }

    return next();
  };
}

function createChatRateLimiter(config) {
  const limit = config.chatRequestsPerMinute;
  if (!limit) {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      return res.status(429).json({
        error: {
          message: '请求过于频繁，请稍后再试',
          type: 'rate_limit'
        }
      });
    }
  });
}

function createDisabledRateLimiter() {
  return (_req, _res, next) => next();
}

function resolveChatRateLimiter(config) {
  return config.chatRequestsPerMinute ? createChatRateLimiter(config) : createDisabledRateLimiter();
}

async function requestQwenChatCompletionsText(config, requestBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.qwenTimeout);

  try {
    const response = await fetchKnownQwenChatCompletions(config.qwenEndpointKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.qwenApiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    return {
      status: response.status,
      text: await response.text()
    };
  } finally {
    clearTimeout(timer);
  }
}

async function sendQwenChatResponse(res, config, requestBody, source = 'cloud') {
  try {
    const response = await requestQwenChatCompletionsText(config, requestBody);
    const payload = parseProxyResponseText(response.text);

    res.set('X-VLM-Source', source);
    return res.status(response.status).json(payload);
  } catch (error) {
    const errorResponse = buildProxyErrorResponse(error, {
      timeoutMessage: 'Qwen 接口请求超时',
      timeoutType: 'timeout_error',
      fallbackMessage: '代理请求失败',
      fallbackType: 'proxy_error'
    });
    return res.status(errorResponse.statusCode).json(errorResponse.body);
  }
}

function createQwenChatHandler(config) {
  return async (req, res) => {
    if (!isQwenProxyConfigured(config)) {
      return res.status(500).json({
        error: {
          message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置，请检查 .env',
          type: 'configuration_error'
        }
      });
    }

    return sendQwenChatResponse(
      res,
      config,
      buildQwenRequestBody(req.body, config.qwenModel),
      'cloud'
    );
  };
}

function createOllamaChatHandler(config) {
  const OLLAMA_MODEL = config.ollamaModel || DEFAULT_VLM_MODEL_ALIAS;

  return async (req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ollamaTimeout);

    try {
      const response = await requestLocalOllamaText(config, {
        path: '/v1/chat/completions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOllamaRequestBody(req.body, OLLAMA_MODEL)),
        signal: controller.signal
      });

      const text = response.text;
      const payload = parseProxyResponseText(text, () => {
        console.error('[ollama-proxy] Non-JSON response from upstream');
      });

      if (shouldFallbackToQwen(response) && isQwenProxyConfigured(config)) {
        console.warn(`[ollama-proxy] Local VLM returned HTTP ${response.status}; falling back to Qwen VLM`);
        return sendQwenChatResponse(
          res,
          config,
          buildQwenFallbackRequestBody(req.body, config.qwenModel),
          'cloud-fallback'
        );
      }

      if (config.logModelOutput) {
        console.log('[ollama-proxy] Model output metadata:', {
          statusCode: response.status,
          contentLength: payload?.choices?.[0]?.message?.content?.length ?? 0
        });
      }

      res.set('X-VLM-Source', 'local');
      return res.status(response.status).json(payload);
    } catch (error) {
      if (isQwenProxyConfigured(config)) {
        console.warn('[ollama-proxy] Local VLM request failed; falling back to Qwen VLM');
        return sendQwenChatResponse(
          res,
          config,
          buildQwenFallbackRequestBody(req.body, config.qwenModel),
          'cloud-fallback'
        );
      }

      const errorResponse = buildProxyErrorResponse(error, {
        timeoutMessage: 'Ollama 推理超时',
        timeoutType: 'timeout',
        fallbackMessage: '代理请求失败',
        fallbackType: 'proxy_error'
      });
      return res.status(errorResponse.statusCode).json(errorResponse.body);
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createQwenProxyApp(config = loadQwenProxyConfig()) {
  const app = express();
  const chatRateLimiter = resolveChatRateLimiter(config);
  const chatPayloadValidator = createChatPayloadValidator(config);
  const localProxyTokenGuard = createLocalProxyTokenGuard(config);

  app.use(compression());

  app.use(
    cors({
      origin: createCorsOriginOption(config),
      credentials: config.corsOrigin !== true
    })
  );
  app.use(express.json({ limit: config.requestBodyLimit }));

  createOllamaProxyRoutes(app, config, chatRateLimiter, chatPayloadValidator, localProxyTokenGuard);

  app.get(API_HEALTH_ROUTE, (_req, res) => {
    res.json({
      ok: true,
      service: 'community-risk-warning-proxy',
      qwenConfigured: Boolean(config.qwenBaseUrl && config.qwenApiKey),
      model: config.qwenModel,
      timestamp: new Date().toISOString()
    });
  });

  app.post(
    QWEN_CHAT_COMPLETIONS_ROUTE,
    chatRateLimiter,
    localProxyTokenGuard,
    chatPayloadValidator,
    createQwenChatHandler(config)
  );

  // 全局错误处理，避免 Express 返回 HTML 500 页面
  app.use((err, _req, res, _next) => {
    const errorResponse = buildExpressErrorResponse(err);
    if (errorResponse.statusCode >= 500) {
      console.error('[ollama-proxy] Unhandled error:', err);
    }
    res.status(errorResponse.statusCode).json(errorResponse.body);
  });

  return app;
}

export function createOllamaProxyRoutes(app, config = loadQwenProxyConfig(), chatRateLimiter, chatPayloadValidator, localProxyTokenGuard) {
  const rateLimiter = chatRateLimiter ?? resolveChatRateLimiter(config);
  const payloadValidator = chatPayloadValidator ?? createChatPayloadValidator(config);
  const tokenGuard = localProxyTokenGuard ?? createLocalProxyTokenGuard(config);

  app.post(
    OLLAMA_CHAT_COMPLETIONS_ROUTE,
    rateLimiter,
    tokenGuard,
    payloadValidator,
    createOllamaChatHandler(config)
  );

  app.get(OLLAMA_STATUS_ROUTE, async (_req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_HEALTH_TIMEOUT_MS);

    try {
      const response = await requestLocalOllamaText(config, {
        path: '/health',
        method: 'GET',
        signal: controller.signal
      });
      res.json(resolveVlmProxyStatus(resolveOllamaHealthStatus(response.status), config));
    } catch {
      res.json(resolveVlmProxyStatus({ ready: false, status: 'error', gpu: 'unknown' }, config));
    } finally {
      clearTimeout(timer);
    }
  });
}
