import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { resolveOllamaHealthStatus } from './ollamaHealthStatus.js';
import {
  API_HEALTH_ROUTE,
  OLLAMA_CHAT_COMPLETIONS_ROUTE,
  OLLAMA_STATUS_ROUTE,
  QWEN_CHAT_COMPLETIONS_ROUTE
} from '../shared/apiRoutes.js';
import { DEFAULT_VLM_MODEL_ALIAS } from '../shared/vlmModelConfig.js';
import { loadVlmRuntimeConfig } from '../shared/vlmRuntimeConfig.js';

function parseCorsOrigin(rawOrigin = 'http://localhost:5173') {
  const trimmed = rawOrigin.trim();
  if (trimmed === '*') {
    return true;
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).toLowerCase() === 'true';
}

function parseInteger(value, fallback, min = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return parsed;
}

function normalizeHost(host) {
  const trimmed = String(host || '').trim();
  return trimmed || '127.0.0.1';
}

export function isAllowedCorsOrigin(origin, corsOrigin, allowLocalFileOrigins = false) {
  if (corsOrigin === true) {
    return true;
  }

  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return allowLocalFileOrigins;
  }

  return corsOrigin.includes(origin);
}

function createCorsOriginOption(config) {
  if (config.corsOrigin === true) {
    return true;
  }

  return (origin, callback) => {
    callback(null, isAllowedCorsOrigin(origin, config.corsOrigin, config.allowLocalFileOrigins));
  };
}

export function loadQwenProxyConfig(env = process.env) {
  const vlmRuntimeConfig = loadVlmRuntimeConfig(env);

  return {
    host: normalizeHost(env.SERVER_HOST || '127.0.0.1'),
    port: parseInteger(env.SERVER_PORT, 8787),
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN || 'http://localhost:5173'),
    allowLocalFileOrigins: parseBoolean(env.ALLOW_LOCAL_FILE_ORIGINS, false),
    qwenBaseUrl: (env.QWEN_BASE_URL || '').replace(/\/$/, ''),
    qwenApiKey: env.QWEN_API_KEY || '',
    qwenModel: env.QWEN_MODEL || DEFAULT_VLM_MODEL_ALIAS,
    qwenTimeout: parseInteger(env.QWEN_TIMEOUT, 60000),
    ollamaTimeout: parseInteger(env.OLLAMA_TIMEOUT, 120000),
    ollamaModel: vlmRuntimeConfig.modelAlias,
    requestBodyLimit: env.REQUEST_BODY_LIMIT || '2mb',
    chatRequestsPerMinute: parseInteger(env.CHAT_REQUESTS_PER_MINUTE, 30, 0),
    maxChatMessages: parseInteger(env.MAX_CHAT_MESSAGES, 16),
    maxChatTokens: parseInteger(env.MAX_CHAT_TOKENS, 2048),
    logModelOutput: parseBoolean(env.LOG_MODEL_OUTPUT, false),
    ollamaBaseUrl: `http://${vlmRuntimeConfig.host}:${vlmRuntimeConfig.port}`
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
    model
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

  app.use(compression());

  app.use(
    cors({
      origin: createCorsOriginOption(config),
      credentials: config.corsOrigin !== true
    })
  );
  app.use(express.json({ limit: config.requestBodyLimit }));

  createOllamaProxyRoutes(app, config, chatRateLimiter, chatPayloadValidator);

  app.get(API_HEALTH_ROUTE, (_req, res) => {
    res.json({
      ok: true,
      service: 'community-risk-warning-proxy',
      qwenConfigured: Boolean(config.qwenBaseUrl && config.qwenApiKey),
      model: config.qwenModel,
      timestamp: new Date().toISOString()
    });
  });

  app.post(QWEN_CHAT_COMPLETIONS_ROUTE, chatRateLimiter, chatPayloadValidator, async (req, res) => {
    if (!config.qwenBaseUrl || !config.qwenApiKey) {
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
      const response = await fetch(`${config.qwenBaseUrl}/chat/completions`, {
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
    console.error('[ollama-proxy] Unhandled error:', err);
    res.status(500).json({
      error: {
        message: err instanceof Error ? err.message : 'Internal server error',
        type: 'internal_error'
      }
    });
  });

  return app;
}

export function createOllamaProxyRoutes(app, config = loadQwenProxyConfig(), chatRateLimiter, chatPayloadValidator) {
  const OLLAMA_BASE = config.ollamaBaseUrl || 'http://127.0.0.1:11434';
  const OLLAMA_MODEL = config.ollamaModel || DEFAULT_VLM_MODEL_ALIAS;
  const rateLimiter = chatRateLimiter ?? createChatRateLimiter(config);
  const payloadValidator = chatPayloadValidator ?? createChatPayloadValidator(config);

  app.post(OLLAMA_CHAT_COMPLETIONS_ROUTE, rateLimiter, payloadValidator, async (req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ollamaTimeout);

    try {
      const response = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOllamaRequestBody(req.body, OLLAMA_MODEL)),
        signal: controller.signal
      });

      const text = await response.text();
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
    try {
      const r = await fetch(`${OLLAMA_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      res.json(resolveOllamaHealthStatus(r.status));
    } catch {
      res.json({ ready: false, status: 'error', gpu: 'unknown' });
    }
  });
}
