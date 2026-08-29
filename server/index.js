import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createQwenProxyApp, loadQwenProxyConfig } from './qwenProxy.js';
import { createTasksIngestRouter } from './tasksIngest.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

// 加载项目根目录统一 .env；系统环境变量保持更高优先级。
// 按 server/ 所在目录解析，避免从其他 CWD 启动时静默读不到配置。
dotenv.config({ path: path.resolve(serverDir, '../.env'), override: false });

const config = loadQwenProxyConfig();
// tasks 路由必须在 createQwenProxyApp 内部、全局错误处理器之前挂载：
// 令牌守卫/限流在 qwenProxy 内统一生效，JSON 解析错误也能返回 JSON 400。
const app = createQwenProxyApp(config, { tasksRouter: createTasksIngestRouter() });

const server = app.listen(config.port, config.host, () => {
  console.log(`Qwen proxy server is running at http://${config.host}:${config.port}`);
});

server.on('error', (error) => {
  console.error('[server] Failed to bind/listen:', error);
  process.exit(1);
});

// 设置 5 分钟超时，防止慢客户端无限占用连接
server.timeout = 300_000;
// Node 推荐：headersTimeout 必须大于 keepAliveTimeout，且都不超过 timeout
server.keepAliveTimeout = 60_000;
server.headersTimeout = 65_000;

// 未捕获的 Promise rejection 不应让进程默默崩溃
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[server] Uncaught exception, shutting down:', error);
  shutdown('uncaughtException', 1);
});

let shuttingDown = false;
function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] Received ${signal}, closing HTTP server...`);

  const forceExit = setTimeout(() => {
    console.warn('[server] Graceful shutdown timed out, forcing exit');
    process.exit(exitCode);
  }, 5000);
  forceExit.unref();

  // 空闲 keep-alive 连接不会等 server.close 回调，主动断开避免拖满 5 秒。
  server.closeIdleConnections?.();
  server.close(() => {
    clearTimeout(forceExit);
    process.exit(exitCode);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
