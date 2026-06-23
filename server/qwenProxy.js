import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'node:http';
import { resolveOllamaHealthStatus } from './ollamaHealthStatus.js';
import {
  API_HEALTH_ROUTE,
  OLLAMA_CHAT_COMPLETIONS_ROUTE,
  OLLAMA_STATUS_ROUTE,
  QWEN_CHAT_COMPLETIONS_ROUTE
} from '../shared/apiRoutes.js';
import { DEFAULT_VLM_MODEL_ALIAS } from '../shared/vlmModelConfig.js';
import { loadVlmRuntimeConfig } from '../shared/vlmRuntimeConfig.js';
import { parseBoolean, parseInteger } from '../shared/envParsers.js';

export const LOCAL_PROXY_TOKEN_HEADER = 'x-local-proxy-token';

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173'];
const QWEN_TIMEOUT_OPTIONS_MS = [15_000, 30_000, 60_000, 90_000, 120_000];
const OLLAMA_TIMEOUT_OPTIONS_MS = [30_000, 60_000, 120_000, 180_000, 300_000];
const OLLAMA_HEALTH_TIMEOUT_MS = 3000;
const LOCAL_OLLAMA_HOST = '127.0.0.1';
const LOOPBACK_HOST_NAMES = new Set(['127.0.0.1', 'localhost']);
const ALLOWED_QWEN_BASE_URLS = [
  'http://127.0.0.1:1234/v1',
  'http://localhost:1234/v1',
  'http://127.0.0.1:11434/v1',
  'http://localhost:11434/v1',
  'https://dashscope.aliyuncs.com/compatible-mode/v1'
];
const QWEN_CHAT_COMPLETIONS_URLS = new Map([
  ['http://127.0.0.1:1234/v1', 'http://127.0.0.1:1234/v1/chat/completions'],
  ['http://localhost:1234/v1', 'http://localhost:1234/v1/chat/completions'],
  ['http://127.0.0.1:11434/v1', 'http://127.0.0.1:11434/v1/chat/completions'],
  ['http://localhost:11434/v1', 'http://localhost:11434/v1/chat/completions'],
  ['https://dashscope.aliyuncs.com/compatible-mode/v1', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions']
]);

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

function resolveAllowedQwenBaseUrl(rawUrl) {
  const normalized = normalizeBaseUrl(rawUrl);
  return ALLOWED_QWEN_BASE_URLS.find((allowedUrl) => allowedUrl === normalized) || '';
}

function resolveAllowedQwenChatCompletionsUrl(baseUrl) {
  return QWEN_CHAT_COMPLETIONS_URLS.get(baseUrl) || '';
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
  const qwenBaseUrl = resolveAllowedQwenBaseUrl(env.QWEN_BASE_URL);
  const ollamaHost = normalizeLoopbackHost(vlmRuntimeConfig.host);
  const ollamaPort = parseInteger(vlmRuntimeConfig.port, 11434, 1);

  return {
    host: normalizeHost(env.SERVER_HOST || '127.0.0.1'),
    port: parseInteger(env.SERVER_PORT, 8787),
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN || 'http://localhost:5173'),
    allowLocalFileOrigins: parseBoolean(env.ALLOW_LOCAL_FILE_ORIGINS, false),
    qwenBaseUrl,
    qwenChatCompletionsUrl: resolveAllowedQwenChatCompletionsUrl(qwenBaseUrl),
    qwenApiKey: env.QWEN_API_KEY || '',
    qwenModel: env.QWEN_MODEL || DEFAULT_VLM_MODEL_ALIAS,
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

  const windowMs = 60_000;
  const buckets = new Map();

  // 每 5 分钟清理一次过期 bucket，防止内存泄漏
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.startedAt >= windowMs) {
        buckets.delete(key);
      }
    }
  }, 300_000);

  // 允许 Node.js 正常退出，不因定时器阻塞
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }

    if (bucket.count >= limit) {
      return res.status(429).json({
        error: {
          message: '请求过于频繁，请稍后再试',
          type: 'rate_limit'
        }
      });
    }

    bucket.count += 1;
    return next();
  };
}

export function createQwenProxyApp(config = loadQwenProxyConfig()) {
  const app = express();
  const chatRateLimiter = createChatRateLimiter(config);
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

  app.post(QWEN_CHAT_COMPLETIONS_ROUTE, chatRateLimiter, localProxyTokenGuard, chatPayloadValidator, async (req, res) => {
    if (!config.qwenChatCompletionsUrl || !config.qwenApiKey) {
      return res.status(500).json({
        error: {
          message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置，请检查 .env.server',
          type: 'configuration_error'
        }
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.qwenTimeout);

    try {
      const response = await fetch(config.qwenChatCompletionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.qwenApiKey}`
        },
        body: JSON.stringify(buildQwenRequestBody(req.body, config.qwenModel)),
        signal: controller.signal
      });

      const text = await response.text();
      const payload = parseProxyResponseText(text);

      return res.status(response.status).json(payload);
    } catch (error) {
      const errorResponse = buildProxyErrorResponse(error, {
        timeoutMessage: 'Qwen 接口请求超时',
        timeoutType: 'timeout_error',
        fallbackMessage: '代理请求失败',
        fallbackType: 'proxy_error'
      });
      return res.status(errorResponse.statusCode).json(errorResponse.body);
    } finally {
      clearTimeout(timer);
    }
  });

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
  const OLLAMA_MODEL = config.ollamaModel || DEFAULT_VLM_MODEL_ALIAS;
  const rateLimiter = chatRateLimiter ?? createChatRateLimiter(config);
  const payloadValidator = chatPayloadValidator ?? createChatPayloadValidator(config);
  const tokenGuard = localProxyTokenGuard ?? createLocalProxyTokenGuard(config);

  app.post(OLLAMA_CHAT_COMPLETIONS_ROUTE, rateLimiter, tokenGuard, payloadValidator, async (req, res) => {
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

      if (config.logModelOutput) {
        console.log('[ollama-proxy] Model output metadata:', {
          statusCode: response.status,
          contentLength: payload?.choices?.[0]?.message?.content?.length ?? 0
        });
      }

      return res.status(response.status).json(payload);
    } catch (error) {
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
  });

  app.get(OLLAMA_STATUS_ROUTE, async (_req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_HEALTH_TIMEOUT_MS);

    try {
      const response = await requestLocalOllamaText(config, {
        path: '/health',
        method: 'GET',
        signal: controller.signal
      });
      res.json(resolveOllamaHealthStatus(response.status));
    } catch {
      res.json({ ready: false, status: 'error', gpu: 'unknown' });
    } finally {
      clearTimeout(timer);
    }
  });
}
