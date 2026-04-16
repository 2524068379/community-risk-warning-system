import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 优先加载项目根目录 .env.server，没有则回退系统环境变量
for (const path of ['.env.server', '.env']) {
  dotenv.config({ path, override: false });
}

const app = express();
const port = Number(process.env.SERVER_PORT || 8787);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const qwenBaseUrl = (process.env.QWEN_BASE_URL || '').replace(/\/$/, '');
const qwenApiKey = process.env.QWEN_API_KEY || '';
const qwenModel = process.env.QWEN_MODEL || 'qwen3.5-vl';
const qwenTimeout = Number(process.env.QWEN_TIMEOUT || 60000);

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((item) => item.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'community-risk-warning-proxy',
    qwenConfigured: Boolean(qwenBaseUrl && qwenApiKey),
    model: qwenModel,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/qwen/chat/completions', async (req, res) => {
  if (!qwenBaseUrl || !qwenApiKey) {
    return res.status(500).json({
      error: {
        message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置，请检查 .env.server',
        type: 'configuration_error'
      }
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), qwenTimeout);

    const response = await fetch(`${qwenBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${qwenApiKey}`
      },
      body: JSON.stringify({
        model: req.body?.model || qwenModel,
        ...req.body
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

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
  }
});

app.listen(port, () => {
  console.log(`Qwen proxy server is running at http://localhost:${port}`);
});
