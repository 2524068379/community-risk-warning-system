import dotenv from 'dotenv';
import { createQwenProxyApp, loadQwenProxyConfig } from './qwenProxy.js';

// 加载项目根目录统一 .env；系统环境变量保持更高优先级。
dotenv.config({ path: '.env', override: false });

const config = loadQwenProxyConfig();
const app = createQwenProxyApp(config);

const server = app.listen(config.port, config.host, () => {
  console.log(`Qwen proxy server is running at http://${config.host}:${config.port}`);
});

// 设置 5 分钟超时，防止慢客户端无限占用连接
server.timeout = 300_000;
