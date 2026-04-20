import express from 'express';
import cors from 'cors';

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

export function isAllowedCorsOrigin(origin, corsOrigin) {
  if (corsOrigin === true) {
    return true;
  }

  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return true;
  }

  return corsOrigin.includes(origin);
}

function createCorsOriginOption(corsOrigin) {
  if (corsOrigin === true) {
    return true;
  }

  return (origin, callback) => {
    callback(null, isAllowedCorsOrigin(origin, corsOrigin));
  };
}

export function loadQwenProxyConfig(env = process.env) {
  return {
    port: Number(env.SERVER_PORT || 8787),
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN || 'http://localhost:5173'),
    qwenBaseUrl: (env.QWEN_BASE_URL || '').replace(/\/$/, ''),
    qwenApiKey: env.QWEN_API_KEY || '',
    qwenModel: env.QWEN_MODEL || 'qwen3.5-vl',
    qwenTimeout: Number(env.QWEN_TIMEOUT || 60000)
  };
}

export function buildQwenRequestBody(body = {}, defaultModel) {
  const requestBody = { ...body };

  if (!requestBody.model) {
    requestBody.model = defaultModel;
  }

  return requestBody;
}

export function createQwenProxyApp(config = loadQwenProxyConfig()) {
  const app = express();

  app.use(
    cors({
      origin: createCorsOriginOption(config.corsOrigin),
      credentials: config.corsOrigin !== true
    })
  );
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'community-risk-warning-proxy',
      qwenConfigured: Boolean(config.qwenBaseUrl && config.qwenApiKey),
      model: config.qwenModel,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/qwen/chat/completions', async (req, res) => {
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
      let payload;

      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }

      return res.status(response.status).json(payload);
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === 'AbortError';

      return res.status(isAbortError ? 504 : 500).json({
        error: {
          message: isAbortError ? 'Qwen 接口请求超时' : error instanceof Error ? error.message : '代理请求失败',
          type: isAbortError ? 'timeout_error' : 'proxy_error'
        }
      });
    } finally {
      clearTimeout(timer);
    }
  });

  return app;
}
