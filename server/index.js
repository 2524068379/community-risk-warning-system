import dotenv from 'dotenv';
import { createQwenProxyApp, loadQwenProxyConfig } from './qwenProxy.js';

// 优先加载项目根目录 .env.server，没有则回退系统环境变量
for (const path of ['.env.server', '.env']) {
  dotenv.config({ path, override: false });
}

const config = loadQwenProxyConfig();
const app = createQwenProxyApp(config);

app.listen(config.port, () => {
  console.log(`Qwen proxy server is running at http://localhost:${config.port}`);
});
