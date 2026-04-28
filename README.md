# 险封·社区风险预警平台

一个基于 **Electron + React + TypeScript + Vite + Node/Express** 构建的跨平台社区风险预警系统，集成实时视频监控、AI 视觉分析和地理信息展示。

## 核心功能

- **总览仪表板**：实时视频流 + VLM 实时分析 + 百度地图联动
- **监控管理**：多视图展示（地图/列表/详情）与点位快速定位
- **风险预警**：高危事件识别、等级分类、证据包生成与导出
- **AI 分析引擎**：集成 Qwen OpenAI 兼容接口的后端代理
- **跨平台部署**：Electron 桌面应用与浏览器混合模式支持

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | React 19 + TypeScript + Vite | 高性能渲染与快速开发 |
| **UI 组件** | Ant Design | 企业级设计系统 |
| **状态管理** | Zustand | 轻量级全局状态 |
| **路由** | React Router | SPA 路由管理 |
| **HTTP 客户端** | Axios | 请求封装与拦截 |
| **实时视频** | mpegts.js | 低延迟视频播放（FLV/MPEG-TS/HLS/MP4） |
| **地图服务** | 百度地图 JSAPI GL | Web GL 地图与点位标注 |
| **桌面框架** | Electron | 跨平台可执行程序 |
| **后端代理** | Node.js + Express | Qwen API 代理与请求控制 |
| **打包工具** | electron-vite | Electron + Vite 集成构建 |

## 项目结构

```
.
├─ src/                          # 前端渲染进程
│  ├─ components/               # React 组件库
│  │  ├─ player/               # 实时视频播放器
│  │  ├─ CameraMapPanel.tsx    # 地图与摄像头管理
│  │  └─ ...
│  ├─ pages/                    # 路由页面（概览、监控、预警等）
│  ├─ router/                   # 路由定义与配置
│  ├─ services/                 # API 与第三方服务集成
│  │  ├─ llm/                  # Qwen LLM 调用封装
│  │  ├─ map/                  # 百度地图 SDK 加载器
│  │  ├─ http.ts              # Axios 实例与拦截器
│  │  └─ ...
│  ├─ store/                    # Zustand 全局状态
│  ├─ types/                    # TypeScript 类型定义
│  ├─ utils/                    # 工具函数
│  ├─ App.tsx                   # 应用入口
│  └─ main.tsx                  # Vite 应用挂载
├─ electron/                     # Electron 主进程
│  ├─ main.ts                   # 主进程入口
│  ├─ preload.ts               # 预加载脚本
│  └─ ...
├─ server/                       # Node/Express 代理服务
│  └─ index.js                  # Qwen 后端代理入口
├─ public/                       # 静态资源
├─ example/                      # 示例媒体文件
├─ .env.example                 # 前端环境变量模板
├─ .env.server.example          # 后端环境变量模板
├─ vite.config.ts               # Vite 配置
├─ vitest.config.ts             # Vitest 单测配置
└─ electron-builder.json        # Electron 打包配置
```

## 快速开始

### 1. 环境准备

```bash
# 使用 Node.js 22+ 与 npm
node --version  # v22.x.x 或更高
npm --version   # 10.x.x 或更高

# 克隆仓库并进入目录
git clone <repository-url>
cd community-risk-warning-system
```

### 2. 安装依赖

```bash
npm ci  # 使用 package-lock.json 锁定版本
```

### 3. 环境配置

#### 前端配置（`.env`）

```bash
cp .env.example .env
```

编辑 `.env`，填写关键字段：

```env
# 百度地图配置
VITE_BAIDU_MAP_AK=你的百度地图浏览器端AK
VITE_BAIDU_MAP_STYLE_ID=
VITE_BAIDU_MAP_CENTER_LNG=118.796877
VITE_BAIDU_MAP_CENTER_LAT=32.060255
VITE_BAIDU_MAP_ZOOM=16

# Qwen 代理配置
VITE_QWEN_PROXY_PATH=/api/qwen/chat/completions
VITE_QWEN_MODEL=jackrong-qwen3.5-4b-claude-4.6-opus-distilled-v2:q4_k_m

# 演示视频流配置
VITE_DEMO_STREAM_URL=
VITE_DEMO_STREAM_TYPE=flv
```

#### 后端代理配置（`.env.server`）

```bash
cp .env.server.example .env.server
```

编辑 `.env.server`，填写关键字段：

```env
# 服务器配置
SERVER_PORT=8787
SERVER_HOST=127.0.0.1
CORS_ORIGIN=http://localhost:5173

# Qwen 代理配置
QWEN_BASE_URL=http://127.0.0.1:1234/v1
QWEN_API_KEY=your_qwen_api_key_here
QWEN_MODEL=jackrong-qwen3.5-4b-claude-4.6-opus-distilled-v2:q4_k_m
QWEN_TIMEOUT=60000

# 限流与容量配置
CHAT_REQUESTS_PER_MINUTE=30
MAX_CHAT_MESSAGES=16
MAX_CHAT_TOKENS=2048
REQUEST_BODY_LIMIT=8mb

# VLM 本地化部署（可选）
VLM_HOST=127.0.0.1
VLM_PORT=11434
VLM_GPU_LAYERS=99
VLM_CONTEXT_SIZE=4096
```

### 4. 开发运行

#### 仅前端开发（浏览器模式）

```bash
npm run dev:web
```

访问 `http://localhost:5173`

#### 仅后端代理

```bash
npm run dev:server
```

代理服务运行在 `http://127.0.0.1:8787`

#### 前后端联调

```bash
npm run dev:all
```

同时启动浏览器 Vite 与 Express 代理

#### Electron 桌面应用开发

```bash
npm run dev
```

启动 Electron 主进程与渲染进程热更新

### 5. 生产构建与打包

```bash
# 构建前端资源
npm run build

# 打包成 Windows 可执行文件（生成 dist-electron/）
npm run package

# 预览打包后的应用
npm run preview
```

## 核心功能详解

### 实时视频播放器

**位置**：`src/components/player/LiveVideoPlayer.tsx`

支持的协议：
- `flv`：HTTP-FLV（推荐用于社区监控网关）
- `mpegts`：MPEG-TS over HTTP（低延迟方案）
- `hls`：HTTP Live Streaming（浏览器原生支持）
- `mp4`：标准 MP4 文件播放

配置示例：

```typescript
<LiveVideoPlayer
  url="http://localhost:8080/stream.flv"
  type="flv"
  autoplay={true}
  controls={true}
/>
```

### 百度地图集成

**位置**：`src/components/CameraMapPanel.tsx` 与 `src/services/map/baiduMap.ts`

功能：
- ✅ 动态加载百度地图 JSAPI GL
- ✅ 摄像头点位标注（风险等级色彩分类）
- ✅ 搜索定位与地图中心联动
- ✅ 标准路网 / ��星图切换
- ✅ 点击点位切换监控视角

接入要求：
1. **填写真实 AK**：在 `.env` 中配置 `VITE_BAIDU_MAP_AK`（注意不要提交真实密钥）
2. **域名白名单**：在百度地图控制台添加本地开发域名 `http://localhost:5173`
3. **坐标系**：确保数据坐标为 `BD09`，若为 `WGS84` 或 `GCJ02` 需提前转换
4. **SDK 加载**：脚本自动加载自 `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=...`，命名空间为 `BMapGL`

### Qwen OpenAI 兼容代理

**后端入口**：`server/index.js`

设计目的：
- 隐藏前端暴露 API Key 的安全风险
- 统一请求接口，便于日志与审计
- 实现请求限流、消息管理、上下文控制

前端调用：

```typescript
// 不再使用直接的 Qwen 地址，而是通过代理
POST /api/qwen/chat/completions
Content-Type: application/json

{
  "model": "jackrong-qwen3.5-4b-claude-4.6-opus-distilled-v2:q4_k_m",
  "messages": [
    { "role": "user", "content": "分析这个视频画面..." }
  ]
}
```

代理配置：
- **每分钟限流**：`CHAT_REQUESTS_PER_MINUTE`（默认 30）
- **消息历史**：`MAX_CHAT_MESSAGES`（默认 16）
- **token 限制**：`MAX_CHAT_TOKENS`（默认 2048）
- **日志输出**：`LOG_MODEL_OUTPUT=false` 防止敏感信息泄露（排障时可临时设置 `true`）

扩展方向：
- SSE 流式响应
- 图片上传与缓存
- 视频关键帧抽取
- 用户鉴权与权限校验
- 请求日志与审计跟踪

## 测试与质量检查

```bash
# 运行 Vitest 单测
npm run test

# TypeScript 类型检查（不生成文件）
npm run typecheck

# 完整构建流程（CI/CD 使用）
npm run build && npm run package
```

**提交代码前必须执行**：

```bash
npm run test && npm run typecheck && npm run build
```

## 编码规范

### TypeScript 与 JavaScript

- **前端与 Electron**：必须使用 TypeScript（`.ts` / `.tsx`）
- **后端代理**：可使用 JavaScript（`.js`），但推荐 TypeScript
- **缩进**：两空格
- **引号**：单引号
- **分号**：必须
- **导入别名**：使用 `@/` 指向 `src/` 目录

### 组件与文件命名

| 类型 | 命名方式 | 示例 |
|------|---------|------|
| React 组件 | PascalCase | `CameraMapPanel.tsx` |
| 自定义 Hook | `use` 前缀 + PascalCase | `useBaiduMap.ts` |
| Zustand Store | `use` 前缀 + PascalCase | `useAppStore.ts` |
| 工具函数 | camelCase | `formatTimestamp.ts` |
| 常量 | UPPER_SNAKE_CASE | `API_TIMEOUT.ts` |

### 导入示例

```typescript
// ✅ 推荐：使用 @/ 别名
import { CameraMapPanel } from '@/components';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/utils/date';

// ❌ 避免：过长的相对路径
import { CameraMapPanel } from '../../../components';
```

## 分支与提交规范

### 提交信息格式（Conventional Commits）

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 示例**：
- `feat(map)`：新增地图功能
- `feat(electron)`：Electron 特性
- `fix(player)`：修复视频播放器
- `build(deps)`：依赖更新
- `ci(workflow)`：CI 工作流调整
- `docs(readme)`：文档更新
- `test`：测试相关
- `refactor`：代码重构

**完整示例**：

```
feat(preload): add camera control API to preload context

Add camera pan/tilt/zoom controls via preload script to enable Electron
windows to manage PTZ cameras without direct network access.

Relates to #123
Tested on: Windows 10 with mock camera data
```

### Pull Request 要求

每个 PR 应包括：
1. **功能描述**：清晰的行为说明（What & Why）
2. **验证命令**：复现步骤与测试指令
3. **关联 Issue**：`Closes #xxx` 或 `Relates to #xxx`
4. **媒体附件**：UI 变更需截图或录屏
5. **检查清单**：
   - [ ] `npm run test` 通过
   - [ ] `npm run typecheck` 通过
   - [ ] `npm run build` 通过
   - [ ] 无 console 错误或警告

## 安全与部署

### 环境变量管理

⚠️ **绝不提交真实 `.env` 或 `.env.server` 文件**

- **模板文件**：`.env.example` 与 `.env.server.example` 需提交
- **敏感信息**：Qwen API Key、地图 AK 等仅在本地或 CI/CD secrets 中保存
- **浏览器隐藏**：所有 `VITE_*` 变量在前端代码中可见，不应包含真实 Key

### 百度地图安全配置

- **Referer 白名单**：在地图控制台严格限制 `http://localhost:5173`（本地）与生产域名
- **浏览器 AK** vs **服务端 AK**：浏览器端 AK 需设置 Referer 限制，服务端 AK 可设置 IP 限制
- **坐标转换**：若使用其他坐标系，在后端代理完成转换，不在前端暴露

### Qwen 代理安全

- **API Key 位置**：仅存储在服务端 `.env.server`
- **日志管理**：生产环境 `LOG_MODEL_OUTPUT=false`
- **CORS 配置**：`CORS_ORIGIN` 明确指定前端地址，不使用通配符
- **请求验证**：可扩展用户鉴权与签名验证

## 常见问题排查

### 地图不显示

| 问题 | 排查步骤 |
|------|---------|
| 白屏或加载中 | 1. 检查 `.env` 中 `VITE_BAIDU_MAP_AK` 是否填写 2. 验证浏览器网络能访问 `api.map.baidu.com` 3. 浏览器控制台查看错误信息 |
| Referer 错误 | 1. 确认 `http://localhost:5173` 已加入地图控制台白名单 2. 检查 Content-Security-Policy 头是否限制了脚本加载 |
| 点位整体偏移 | 1. 确认坐标系为 `BD09` 2. 若为 `WGS84`/`GCJ02`，在后端完成坐标转换 |

### 视频播放失败

| 问题 | 排查步骤 |
|------|---------|
| 黑屏或加载中 | 1. 检查 `.env` 中 `VITE_DEMO_STREAM_URL` 是否有效 2. 确认视频服务器 CORS 配置允许浏览器跨域访问 3. 调整 `mpegts.js` 缓冲参数 |
| 延迟高 | 1. 优先使用 `flv` 或 `mpegts` 协议而不是 `hls` 2. 检查网络带宽与服务器负载 3. 考虑使用 WebRTC 替代 HTTP 流 |

### Qwen 代理无响应

| 问题 | 排查步骤 |
|------|---------|
| 502 Bad Gateway | 1. 确认后端代理已启动 `npm run dev:server` 2. 检查 `.env.server` 中 `QWEN_BASE_URL` 与 `QWEN_API_KEY` 3. 验证本地 Qwen 服务或远程 API 可访问 |
| 超时 | 1. 增加 `QWEN_TIMEOUT` 值 2. 检查网络连接 3. 查看后端日志（可临时设置 `LOG_MODEL_OUTPUT=true`） |
| 限流错误 | 1. 检查 `CHAT_REQUESTS_PER_MINUTE` 设置 2. 确认消息历史不超过 `MAX_CHAT_MESSAGES` |

## 下一步开发方向

**短期（1-2 周）**：
- [ ] 接入真实监控网关或 RTSP/RTMP 转流服务
- [ ] 实现视频截图与关键帧抽取接口
- [ ] 增加事件趋势图表（ECharts）

**中期（2-4 周）**：
- [ ] 用户登录与权限管理（RBAC）
- [ ] 证据包导出（PDF/ZIP）与工单流转
- [ ] 事件日志与审计追踪

**长期（1 个月+）**：
- [ ] WebRTC 低延迟视频传输
- [ ] 本地 Ollama VLM 深度集成
- [ ] 多模态 AI 分析（图文视频融合）
- [ ] 移动端 React Native 适配
- [ ] 分布式部署与集群管理

## 相关资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Vite 用户指南](https://cn.vitejs.dev/)
- [React 18+ 文档](https://react.dev)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Ant Design 组件库](https://ant.design/)
- [百度地图 JSAPI GL](https://lbsyun.baidu.com/index.php?title=jspopular3.0/api)
- [Qwen API 文档](https://help.aliyun.com/zh/qwen/)

## 许可证

本项目遵循 [MIT 许可证](LICENSE)。

---

**最后更新**：2026-04-28
