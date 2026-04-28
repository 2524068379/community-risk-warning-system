# 险封·社区风险预警平台

**v0.2.0** | 基于 **Electron 41 + React 19 + TypeScript + Vite 7 + Express 5** 构建的跨平台社区风险预警系统，集成本地摄像头实时画面、VLM 视觉分析（llama.cpp + Qwen3.5-4B）、百度地图联动与风险数据可视化。

## 核心功能

- **总览仪表板**：本地摄像头实时画面 + VLM 实时分析 + 百度地图联动 + 风险构成/趋势图表（Recharts）
- **监控管理**：实时视频流 + 检测框叠加 + 点位列表快速切换
- **风险预警**：事件等级分类（A/B/C）、VLM 研判详情、证据时间轴
- **VLM 分析引擎**：本地 llama-server.exe 推理，帧采集 → 多模态分析 → 结构化输出，全链路本地运行
- **双 AI 代理**：Qwen OpenAI 兼容代理（远程）+ Ollama 代理（本地 VLM），请求限流与验证
- **跨平台部署**：Electron 桌面应用与浏览器开发模式，CI/CD 自动构建发布

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | React + TypeScript | 19 / 5.8 | 高性能渲染与类型安全 |
| **UI 组件** | Ant Design | 6 | 企业级设计系统 |
| **数据可视化** | Recharts | 3 | 风险饼图、趋势折线图 |
| **状态管理** | Zustand | 5 | 轻量级全局状态 |
| **路由** | react-router-dom | 7 | SPA 路由管理（懒加载） |
| **HTTP 客户端** | Axios | 1.15 | 请求封装与拦截 |
| **实时视频** | mpegts.js | 1.8 | 低延迟视频播放（FLV/MPEG-TS/HLS/MP4） |
| **地图服务** | 百度地图 JSAPI GL | — | WebGL 地图与点位标注 |
| **桌面框架** | Electron | 41 | 跨平台可执行程序（含 VLM 子进程管理） |
| **构建工具** | electron-vite + Vite | 5 / 7 | Electron 三进程（main/preload/renderer）集成构建 |
| **后端代理** | Node.js + Express | 22 / 5 | Qwen/Ollama API 代理、限流、验证 |
| **VLM 推理** | llama.cpp (llama-server) | b8864 | 本地 CUDA 加速视觉推理 |

## 项目结构

```
.
├─ src/                          # 前端渲染进程
│  ├─ components/               # React 组件
│  │  ├─ player/               # 实时视频播放器（LiveVideoPlayer）
│  │  ├─ CameraMapPanel.tsx    # 百度地图与摄像头标注
│  │  ├── VlmAnalysisPanel.tsx # VLM 分析结果面板
│  │  ├── VideoPanel.tsx       # 视频面板封装
│  │  └── MetricCard.tsx       # 数据指标卡片
│  ├─ hooks/                    # 自定义 Hooks
│  │  ├─ useVlmAnalysis.ts     # VLM 分析调度（帧采集→推理→状态更新）
│  │  ├─ useFrameCapture.ts    # 视频/摄像头帧定时截取
│  │  ├─ useLocalCamera.ts     # 本地摄像头媒体流管理
│  │  ├─ useBaiduMap.ts        # 百度地图实例管理
│  │  └── useCameraMarkers.ts  # 地图摄像头标注管理
│  ├─ pages/                    # 路由页面
│  │  ├─ OverviewPage.tsx      # 总览仪表板（视频+VLM+地图+图表）
│  │  ├─ MonitorPage.tsx       # 实时监控（视频+检测框+点位列表）
│  │  └── AlertsPage.tsx       # 预警事件（列表+详情+VLM研判）
│  ├─ layouts/                  # 布局组件（MainLayout）
│  ├─ router/                   # 路由定义与懒加载配置
│  ├─ services/                 # API 与第三方服务集成
│  │  ├─ llm/                  # LLM 客户端
│  │  │  ├─ ollamaClient.ts    # Ollama VLM 调用与响应解析
│  │  │  └── qwenClient.ts     # Qwen 远程调用
│  │  ├─ map/                  # 百度地图 SDK 加载与 InfoWindow
│  │  └── http.ts              # Axios 实例与拦截器
│  ├─ store/                    # Zustand 全局状态（useAppStore）
│  ├─ data/                     # 模拟数据（mock 摄像头/事件）
│  ├─ types/                    # TypeScript 类型定义
│  ├─ utils/                    # 工具函数
│  │  ├─ risk.ts               # 风险等级颜色/文本映射
│  │  ├─ vlmStatusView.ts      # VLM 状态视图配置
│  │  ├─ detectionBoxView.ts   # 检测框渲染样式
│  │  ├── cameraFilter.ts      # 摄像头过滤
│  │  └── escapeHtml.ts        # HTML 转义
│  ├─ App.tsx                   # 应用入口
│  └── main.tsx                 # Vite 应用挂载
├─ electron/                     # Electron 主进程
│  ├─ main.ts                   # 主进程入口（窗口+代理+VLM启动）
│  ├─ preload.ts               # 预加载脚本（IPC桥接）
│  └── ollamaManager.ts        # VLM 子进程生命周期管理（llama-server）
├─ server/                       # Node/Express 代理服务
│  ├─ index.js                  # 独立代理入口（浏览器模式）
│  ├─ qwenProxy.js             # Qwen/Ollama 双代理路由、限流、验证
│  └── ollamaHealthStatus.js   # Ollama 健康状态解析
├─ shared/                       # 主进程/服务端/前端共享配置
│  ├─ apiRoutes.js             # API 路由常量
│  ├─ vlmModelConfig.js       # VLM 模型名称、URL、SHA256
│  └── vlmRuntimeConfig.js    # VLM 运行时配置解析
├─ scripts/                      # 工具脚本
│  └── download-model.js       # 下载 llama-server + VLM 模型文件
├─ public/                       # 静态资源
├─ example/                      # 示例媒体文件
├─ resources/vlm/                # VLM 运行时资源（模型+可执行文件，不入库）
├─ build/                        # Electron 打包图标
├─ .github/                      # CI/CD
│  ├─ workflows/build.yml       # 构建+测试+打包+发布
│  ├─ workflows/dependabot-auto-merge.yml
│  └── dependabot.yml           # Dependabot 自动依赖更新
├─ .env.example                 # 前端环境变量模板
├─ .env.server.example          # 后端环境变量模板
├─ electron.vite.config.ts      # electron-vite 三进程构建配置
├─ vite.config.ts               # 纯浏览器 Vite 配置
├── vitest.config.ts            # Vitest 单测配置
├─ package.json                 # 项目配置（v0.2.0）
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
npm ci
```

### 3. 环境配置

#### 前端配置（`.env`）

```bash
cp .env.example .env
```

编辑 `.env`，填写关键字段：

```env
VITE_APP_TITLE=险封·社区风险预警平台

# 百度地图 JSAPI GL
VITE_BAIDU_MAP_AK=你的百度地图浏览器端AK
VITE_BAIDU_MAP_STYLE_ID=
VITE_BAIDU_MAP_CENTER_LNG=118.796877
VITE_BAIDU_MAP_CENTER_LAT=32.060255
VITE_BAIDU_MAP_ZOOM=16

# Qwen 代理配置（远程推理）
VITE_QWEN_PROXY_PATH=/api/qwen/chat/completions
VITE_QWEN_MODEL=jackrong-qwen3.5-4b-claude-4.6-opus-distilled-v2:q4_k_m

# 演示视频流配置（可选）
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
SERVER_HOST=127.0.0.1
SERVER_PORT=8787

# CORS
CORS_ORIGIN=http://localhost:5173
ALLOW_LOCAL_FILE_ORIGINS=false
REQUEST_BODY_LIMIT=8mb

# Qwen 远程接口配置
QWEN_BASE_URL=http://127.0.0.1:1234/v1
QWEN_API_KEY=
QWEN_MODEL=jackrong-qwen3.5-4b-claude-4.6-opus-distilled-v2:q4_k_m
QWEN_TIMEOUT=60000

# 限流与容量配置
CHAT_REQUESTS_PER_MINUTE=30
MAX_CHAT_MESSAGES=16
MAX_CHAT_TOKENS=2048
LOG_MODEL_OUTPUT=false

# 本地 VLM 运行配置（llama-server）
VLM_HOST=127.0.0.1
VLM_PORT=11434
VLM_FORCE_CPU=false
VLM_GPU_LAYERS=99
VLM_CONTEXT_SIZE=4096
VLM_STARTUP_TIMEOUT_MS=60000
```

#### 下载 VLM 模型文件（Electron 模式可选）

```bash
# 下载 llama-server.exe（CUDA 构建）+ VLM 模型 + mmproj 视觉编码器
# 约 3.2 GB，首次下载后自动跳过
npm run download-model
```

模型文件下载至 `resources/vlm/`：
- `llama-server.exe` — llama.cpp CUDA 推理服务
- `Qwen3.5-4B.Q4_K_M.gguf` (~2.55 GB) — 主模型
- `mmproj-BF16.gguf` (~644 MB) — 视觉编码器

脚本会自动验证 SHA256 完整性。

### 4. 开发运行

#### 仅前端开发（浏览器模式）

```bash
npm run dev:web
```

访问 `http://localhost:5173`，Vite 代理 `/api` 至后端。

#### 仅后端代理

```bash
npm run dev:server
```

代理服务运行在 `http://127.0.0.1:8787`，提供以下路由：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 代理健康检查 |
| POST | `/api/qwen/chat/completions` | Qwen 远程推理代理 |
| POST | `/api/ollama/chat/completions` | Ollama 本地 VLM 代理 |
| GET | `/api/ollama/status` | Ollama 运行状态查询 |

#### 前后端联调

```bash
npm run dev:all
```

同时启动浏览器 Vite 与 Express 代理。

#### Electron 桌面应用开发

```bash
npm run dev
```

启动 Electron 主进程 + 渲染进程热更新。主进程会：
1. 启动内嵌 Qwen/Ollama 代理服务（随机端口）
2. 自动启动 `llama-server.exe` 子进程（如果模型文件存在）
3. 通过 IPC 暴露 API 地址和 VLM 状态给渲染进程

### 5. 生产构建与打包

```bash
# 构建前端资源（electron-vite 三进程构建）
npm run build

# 打包成 Windows 可执行文件（生成 dist-electron/）
npm run package

# 预览打包后的应用
npm run preview
```

## 核心功能详解

### VLM 实时分析管线

全链路本地运行的视觉分析流程：

```
摄像头/视频 → useFrameCapture（定时截帧）→ useVlmAnalysis（调度分析）
    → ollamaClient（构建多模态请求）→ /api/ollama/chat/completions
    → llama-server（本地推理）→ parseVlmResponse（JSON解析+校验）
    → useAppStore（状态更新）→ UI 渲染
```

**关键文件**：
- `src/hooks/useFrameCapture.ts` — Canvas 截帧，可配置间隔/分辨率/质量
- `src/hooks/useVlmAnalysis.ts` — 分析调度，帧消费锁，VLM 状态轮询
- `src/services/llm/ollamaClient.ts` — 多模态请求构建，JSON 提取（兼容 `<think/>` 标签），DetectionBox 归一化
- `electron/ollamaManager.ts` — llama-server 子进程生命周期（启动/健康检查/超时/停止）

**分析输出**：
```typescript
interface VlmAnalysis {
  riskScore: number;       // 0-100 综合风险分
  level: 'A' | 'B' | 'C'; // A=高危 B=中危 C=低危
  hasRisk: boolean;        // 是否存在风险
  confidence: number;      // 0-1 置信度
  summary: string;         // 自然语言摘要
  breakdown: RiskBreakdown[]; // 风险构成（百分比）
  evidenceTimeline: string[]; // 证据时间轴
}
```

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

监控页面额外支持本地摄像头直连（`useLocalCamera`），画面上叠加 VLM 检测框（`detectionBoxView.ts`）。

### 百度地图集成

**位置**：`src/components/CameraMapPanel.tsx`、`src/hooks/useBaiduMap.ts`、`src/services/map/baiduMap.ts`

功能：
- 动态加载百度地图 JSAPI GL
- 摄像头点位标注（风险等级色彩分类）
- 搜索定位与地图中心联动
- 点击点位切换监控视角
- InfoWindow 弹窗（`cameraInfoWindow.ts`）

接入要求：
1. 在 `.env` 中配置 `VITE_BAIDU_MAP_AK`
2. 在百度地图控制台添加本地开发域名 `http://localhost:5173`
3. 确保数据坐标为 `BD09`

### 双 AI 代理架构

**后端入口**：`server/qwenProxy.js`

```
前端
 ├─ /api/qwen/*  →  Qwen 远程推理（OpenAI 兼容，需 QWEN_BASE_URL + QWEN_API_KEY）
 └─ /api/ollama/* →  Ollama 本地 VLM（llama-server，无需外部 API）
```

共享特性：
- **请求限流**：每 IP 每分钟 `CHAT_REQUESTS_PER_MINUTE` 次
- **Payload 验证**：消息数量、max_tokens 上限
- **CORS 白名单**：精确指定前端域名，支持 `file://` 协议（Electron）
- **健康检查**：`/api/health` 与 `/api/ollama/status`

### 数据可视化

**位置**：`src/pages/OverviewPage.tsx`

- **风险构成环形图**：Recharts PieChart，按类别展示风险占比
- **风险趋势折线图**：Recharts LineChart，滚动显示最近 30 个时间点
- **VLM 面板**：三种模式（full/compact/summary），展示风险分、等级、置信度、摘要

## 测试与质量检查

```bash
# 运行 Vitest 单测
npm run test

# 监听模式
npm run test:watch

# TypeScript 类型检查
npm run typecheck

# 完整构建流程
npm run build && npm run package
```

测试文件与源码同目录放置（`*.test.ts` / `*.test.tsx` / `*.test.js`）。

**提交代码前必须执行**：

```bash
npm run test && npm run typecheck && npm run build
```

## CI/CD

### GitHub Actions（`.github/workflows/build.yml`）

- **触发条件**：push to main、PR to main、tag `v*`
- **构建步骤**：安装依赖 → 测试 → 类型检查 → VLM 模型缓存/下载 → SHA256 验证 → 构建 → 打包
- **产物**：`windows-portable.zip`（应用）+ `vlm-models.zip`（模型文件）
- **自动发布**：tag push 时创建 GitHub Release，附带应用和模型包
- **Dependabot 优化**：Dependabot PR 跳过模型下载和打包步骤

### Dependabot

- 自动检测 npm 和 GitHub Actions 依赖更新
- 配置自动合并工作流（`.github/workflows/dependabot-auto-merge.yml`）

## 编码规范

### TypeScript 与 JavaScript

- **前端与 Electron**：必须使用 TypeScript（`.ts` / `.tsx`）
- **后端代理与 shared**：JavaScript（`.js`），可被主进程和服务端直接引用
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
| 工具函数 | camelCase | `escapeHtml.ts` |

### 导入示例

```typescript
// ✅ 推荐：使用 @/ 别名
import { CameraMapPanel } from '@/components/CameraMapPanel';
import { useAppStore } from '@/store/useAppStore';

// shared 模块使用相对路径引用
import { OLLAMA_CHAT_COMPLETIONS_ROUTE } from '../../shared/apiRoutes.js';
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

**绝不提交真实 `.env` 或 `.env.server` 文件**

- **模板文件**：`.env.example` 与 `.env.server.example` 需提交
- **敏感信息**：Qwen API Key、地图 AK 等仅在本地或 CI/CD secrets 中保存
- **浏览器隐藏**：所有 `VITE_*` 变量在前端代码中可见，不应包含真实 Key
- **CI/CD**：通过 GitHub Secrets `ENV_FILE` 注入环境变量

### 百度地图安全配置

- **Referer 白名单**：在地图控制台严格限制 `http://localhost:5173`（本地）与生产域名
- **浏览器 AK** 需设置 Referer 限制
- **坐标系**：确保数据坐标为 `BD09`，若为 `WGS84` 或 `GCJ02` 需在后端完成转换

### VLM 模型安全

- 模型文件通过 `scripts/download-model.js` 下载，自动验证 SHA256
- CI/CD 构建中同样执行 SHA256 校验
- 模型配置集中在 `shared/vlmModelConfig.js`，三端共享

### Qwen 代理安全

- **API Key 位置**：仅存储在服务端 `.env.server`
- **日志管理**：生产环境 `LOG_MODEL_OUTPUT=false`
- **CORS 配置**：`CORS_ORIGIN` 精确指定前端域名，Electron 模式通过 `allowLocalFileOrigins` 支持 `file://` 协议

## 常见问题排查

### 地图不显示

| 问题 | 排查步骤 |
|------|---------|
| 白屏或加载中 | 1. 检查 `VITE_BAIDU_MAP_AK` 是否填写 2. 验证浏览器能访问 `api.map.baidu.com` 3. 查看浏览器控制台错误 |
| Referer 错误 | 1. 确认 `http://localhost:5173` 已加入地图控制台白名单 2. 检查 CSP 头是否限制脚本加载 |
| 点位整体偏移 | 1. 确认坐标系为 `BD09` 2. 若为其他坐标系，在后端完成转换 |

### 视频播放失败

| 问题 | 排查步骤 |
|------|---------|
| 黑屏或加载中 | 1. 检查 `VITE_DEMO_STREAM_URL` 是否有效 2. 确认视频服务器 CORS 配置 3. 调整 `mpegts.js` 缓冲参数 |
| 延迟高 | 1. 优先使用 `flv` 或 `mpegts` 协议 2. 检查网络带宽 3. 考虑 WebRTC 替代 |

### VLM 分析不工作

| 问题 | 排查步骤 |
|------|---------|
| 状态持续"等待连接" | 1. 检查 `resources/vlm/` 下模型文件是否存在 2. 运行 `npm run download-model` 3. 检查 Electron 控制台 `[vlm]` 日志 |
| GPU 不可用 | 1. 设置 `VLM_FORCE_CPU=true` 2. 检查 CUDA 12.4 驱动 3. 降低 `VLM_GPU_LAYERS` |
| 推理超时 | 1. 增大 `VLM_STARTUP_TIMEOUT_MS` 2. 降低 `VLM_CONTEXT_SIZE` 3. 检查显存占用 |

### Qwen 代理无响应

| 问题 | 排查步骤 |
|------|---------|
| 502 Bad Gateway | 1. 确认 `npm run dev:server` 已启动 2. 检查 `QWEN_BASE_URL` 与 `QWEN_API_KEY` 3. 验证远程 API 可访问 |
| 超时 | 1. 增加 `QWEN_TIMEOUT` 值 2. 临时设置 `LOG_MODEL_OUTPUT=true` 查看日志 |
| 限流错误 | 1. 检查 `CHAT_REQUESTS_PER_MINUTE` 设置 2. 确认消息历史不超过 `MAX_CHAT_MESSAGES` |

## 相关资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-vite 构建工具](https://electron-vite.org/)
- [Vite 用户指南](https://cn.vitejs.dev/)
- [React 文档](https://react.dev)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Ant Design 组件库](https://ant.design/)
- [Recharts 图表库](https://recharts.org/)
- [百度地图 JSAPI GL](https://lbsyun.baidu.com/index.php?title=jspopular3.0/api)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [Qwen 模型](https://huggingface.co/Jackrong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-v2-GGUF)

## 许可证

本项目遵循 [Apache License 2.0](LICENSE)。

---

**最后更新**：2026-04-28
