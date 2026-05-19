import dotenv from 'dotenv';
import { createQwenProxyApp, loadQwenProxyConfig } from './qwenProxy.js';

// 优先加载项目根目录 .env.server，没有则回退系统环境变量
for (const path of ['.env.server', '.env']) {
  dotenv.config({ path, override: false });
}

const config = loadQwenProxyConfig();
const app = createQwenProxyApp(config);

const server = app.listen(config.port, config.host, () => {
  console.log(`Qwen proxy server is running at http://${config.host}:${config.port}`);
});

// 设置 5 分钟超时，防止慢客户端无限占用连接
server.timeout = 300_000;
