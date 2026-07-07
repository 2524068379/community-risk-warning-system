# 险封·社区风险预警平台

**v0.2.0** | Electron + React + TypeScript 构建的社区风险预警桌面应用。项目以本地摄像头画面为输入，结合本地 VLM 推理、目标检测、百度地图点位联动和风险数据可视化，提供社区监控总览、实时监控和预警事件查看能力。

当前打包目标为 **Windows x64 portable zip**。浏览器开发模式可用于调试渲染进程和 Express 代理；完整的本地 VLM 自动拉起流程在 Electron 模式中运行。

## 功能概览

- **总览仪表板**：本地摄像头实时画面、VLM 状态、风险评分、风险构成、趋势折线图和百度地图点位联动。
- **实时监控**：摄像头画面、点位列表、在线状态、风险分和 VLM 检测框叠加。
- **预警事件**：按 A/B/C 风险等级筛选事件，查看事件概要、处置建议、关键证据和 VLM 研判结果。
- **本地 VLM 分析**：Electron 主进程启动 `llama-server.exe`，渲染进程定时截帧并通过 `/api/ollama/chat/completions` 获取结构化研判结果。
- **轻量目标检测预筛**：使用 TensorFlow.js COCO-SSD Lite 检测人员、车辆等目标，检测标签和置信度阈值可通过环境变量配置，并结合帧差与自适应截帧降低 VLM 调用频率。
- **双代理能力**：Express 代理同时提供 Qwen OpenAI-compatible 远程接口和本地 llama.cpp VLM 接口，统一处理 CORS、限流、超时和请求校验；本地 VLM 不可用时可自动回退到已配置的云端模型。
- **构建与发布**：GitHub Actions 在 Windows 环境运行测试、类型检查、构建和打包；应用包与 VLM 模型包分开产出。

## 技术栈

| 层级 | 技术 | 当前版本 | 说明 |
|------|------|----------|------|
| 前端框架 | React + TypeScript | 19.2 / 5.9 | 渲染进程 UI 与类型约束 |
| UI 组件 | Ant Design | 6.4 | 管理端组件体系 |
| 数据可视化 | Recharts | 3.8 | 风险构成与趋势图表 |
| 状态管理 | Zustand | 5.0 | 全局摄像头、事件和分析状态 |
| 路由 | react-router-dom | 7.17 | SPA 路由与懒加载 |
| HTTP 客户端 | Axios | 1.17 | 请求封装与拦截 |
| 视频播放 | mpegts.js | 1.8 | FLV、MPEG-TS、HLS、MP4 播放能力 |
| 目标检测 | TensorFlow.js + COCO-SSD | 4.22 / 2.2 | 浏览器侧轻量目标预筛 |
| 地图服务 | 百度地图 JSAPI GL | 3.x | WebGL 地图与摄像头标注 |
| 桌面框架 | Electron | 41.7 | 主进程窗口、代理和 VLM 子进程管理 |
| 构建工具 | electron-vite + Vite | 5.0 / 7.3 | Electron 三进程构建与浏览器调试 |
| 后端代理 | Node.js + Express | 24 / 5.2 | Qwen 和本地 VLM 代理 |
| VLM 推理 | llama.cpp `llama-server` | b9484 | Windows CUDA 12.4 构建 |

## 项目结构

```text
.
├─ src/                         # React 渲染进程
│  ├─ components/                # 复用组件
│  │  ├─ player/                 # LiveVideoPlayer 与播放状态工具
│  │  ├─ CameraMapPanel.tsx      # 百度地图点位面板
│  │  ├─ VlmAnalysisPanel.tsx    # VLM 结果展示
│  │  ├─ VideoPanel.tsx          # 视频面板封装
│  │  └─ MetricCard.tsx          # 指标卡片
│  ├─ data/                      # Mock 摄像头与事件数据
│  ├─ hooks/                     # 自定义 Hook
│  │  ├─ useFrameCapture.ts      # 截帧、帧差和自适应间隔
│  │  ├─ useLocalCamera.ts       # 本地摄像头媒体流
│  │  ├─ useVlmAnalysis.ts       # VLM 调度与状态轮询
│  │  ├─ useBaiduMap.ts          # 百度地图实例管理
│  │  └─ useCameraMarkers.ts     # 地图标注管理
│  ├─ layouts/                   # 页面布局
│  ├─ pages/                     # Overview、Monitor、Alerts、NotFound
│  ├─ router/                    # 路由定义与页面懒加载
│  ├─ services/                  # API、地图、LLM、检测服务
│  │  ├─ detection/              # TensorFlow.js 目标检测
│  │  ├─ llm/                    # Qwen 与本地 VLM 客户端
│  │  ├─ map/                    # 百度地图 SDK 和 InfoWindow
│  │  └─ http.ts                 # Axios 实例
│  ├─ store/                     # Zustand 全局状态
│  ├─ types/                     # 业务类型和 Electron/Baidu 声明
│  ├─ utils/                     # 风险、检测框、帧差、HTML 转义工具
│  ├─ App.tsx                    # 应用入口组件
│  └─ main.tsx                   # Vite 挂载入口
├─ electron/                     # Electron 主进程与 preload
│  ├─ main.ts                    # 窗口、内嵌代理、VLM 启停
│  ├─ preload.ts                 # IPC 桥接
│  ├─ ollamaManager.ts           # llama-server 生命周期管理
│  └─ vlmResourcePath.ts         # 开发/打包资源路径解析
├─ server/                       # Express 代理
│  ├─ index.js                   # 独立代理入口
│  ├─ qwenProxy.js               # Qwen 与本地 VLM 代理路由
│  └─ ollamaHealthStatus.js      # VLM 健康状态转换
├─ shared/                       # 三端共享常量与配置解析
│  ├─ apiRoutes.js
│  ├─ vlmModelConfig.js
│  └─ vlmRuntimeConfig.js
├─ scripts/
│  └─ download-model.js          # 下载 llama-server、模型和 mmproj
├─ public/                       # 静态资源
├─ example/                      # 示例媒体
├─ resources/vlm/                # 本地 VLM 资源目录，运行时生成，不提交模型
├─ build/                        # Electron 图标
├─ .github/                      # CI、发布和 Dependabot 配置
├─ .env.example                  # 前端、代理与 VLM 统一环境变量模板
├─ electron.vite.config.ts       # Electron 三进程构建配置
├─ vite.config.ts                # 浏览器模式 Vite 配置
├─ vitest.config.ts              # Vitest 配置
├─ package.json                  # 脚本、依赖和 electron-builder 配置
└─ package-lock.json
```

## 快速开始

### 环境要求

- Node.js 24.x（仓库通过 `.nvmrc` 与 `package.json#engines` 固定为 `>=24 <25`）
- npm 11.x 或更高版本
- Windows 10/11 x64（完整桌面打包和内置 `llama-server.exe` 流程）
- 可用摄像头（用于总览和监控页面实时画面）
- 百度地图浏览器端 AK（地图功能需要）
- NVIDIA CUDA 12.4 兼容环境（本地 VLM GPU 推理推荐；也可配置为 CPU）

### 安装依赖

```bash
npm ci
```

### 配置环境

```bash
cp .env.example .env
```

关键字段：

```env
VITE_APP_TITLE=险封·社区风险预警平台
VITE_API_BASE_URL=

VITE_BAIDU_MAP_AK=请填写你的百度地图浏览器端AK
VITE_BAIDU_MAP_STYLE_ID=
VITE_BAIDU_MAP_CENTER_LNG=118.796877
VITE_BAIDU_MAP_CENTER_LAT=32.060255
VITE_BAIDU_MAP_ZOOM=16

VITE_QWEN_PROXY_PATH=/api/qwen/chat/completions
VITE_QWEN_MODEL=qwen3-vl-plus

VITE_DEMO_STREAM_URL=
VITE_DEMO_STREAM_TYPE=flv

VITE_DETECTION_LABELS=person,car,truck,bus,bicycle,motorcycle,dog,backpack,handbag,suitcase,chair,couch,bench,potted plant
VITE_DETECTION_MIN_SCORE=0.35

SERVER_HOST=127.0.0.1
SERVER_PORT=8787
CORS_ORIGIN=http://localhost:5173
ALLOW_LOCAL_FILE_ORIGINS=false
REQUEST_BODY_LIMIT=8mb

CHAT_REQUESTS_PER_MINUTE=30
MAX_CHAT_MESSAGES=16
MAX_CHAT_TOKENS=2048
LOG_MODEL_OUTPUT=false
LOCAL_PROXY_TOKEN=

QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=
QWEN_MODEL=qwen3-vl-plus
QWEN_TIMEOUT=60000

VLM_HOST=127.0.0.1
VLM_PORT=11434
VLM_MODEL=qwen3.5-4b-mtp:q4_k_m
VLM_FORCE_CPU=false
VLM_GPU_LAYERS=99
VLM_CONTEXT_SIZE=4096
VLM_BATCH_SIZE=512
VLM_UBATCH_SIZE=256
VLM_STARTUP_TIMEOUT_MS=60000
# KV cache 量化（f16 默认 / q8_0 省显存、8GB 推荐 / q4_0 最省）
VLM_CACHE_TYPE_K=f16
VLM_CACHE_TYPE_V=f16
# MTP 默认关闭：与视觉编码器互斥、官方预编译包不支持其参数、仅加速文本、低显存不建议
VLM_MTP_ENABLED=false
VLM_MTP_DRAFT_TOKENS=4
```

`VITE_DETECTION_LABELS` 用英文逗号分隔 COCO-SSD 标签；`VITE_DETECTION_MIN_SCORE` 取值范围为 0 到 1，配置异常时回退到 0.35。

`VITE_*` 变量会进入浏览器代码，不要放入真实密钥。Qwen API Key 只应写入 `.env` 中不带 `VITE_` 前缀的服务端变量、CI Secret 或 ESA Pages 环境变量。`LOCAL_PROXY_TOKEN` 为空时不会启用 token 校验；当独立代理绑定非本机地址时，应设置一个高熵随机值，并由调用方通过 `X-Local-Proxy-Token` 请求头传入。`QWEN_BASE_URL` 只接受代理源码中固定列出的 OpenAI-compatible 上游地址，例如本机 LM Studio/Ollama 兼容端点、DashScope 兼容模式端点或智谱 BigModel 兼容端点；如需接入其他专属域名，应先把完整 base URL 显式加入代理 endpoint 表后再部署。

### 下载本地 VLM 资源

```bash
npm run download-model
```

脚本会下载并校验：

| 文件 | 用途 |
|------|------|
| `llama-server.exe` | llama.cpp OpenAI-compatible 推理服务 |
| `Qwen3.5-4B-Q4_K_M.gguf` | 主模型，约 2.83 GB |
| `mmproj-BF16.gguf` | 视觉编码器，约 676 MB |
| CUDA 相关 DLL | Windows CUDA 推理运行时依赖 |

资源放在 `resources/vlm/`。Electron 开发模式会从该目录查找并启动 `llama-server.exe`；打包后会从应用目录下的 `resources/vlm/` 查找。

## 开发命令

### Electron 桌面模式

```bash
npm run dev
```

该模式会启动 Electron 主进程、渲染进程热更新和内嵌代理服务。若 `resources/vlm/` 中存在所需文件，主进程会自动启动本地 `llama-server.exe`。

### 浏览器渲染模式

```bash
npm run dev:web
```

访问 `http://localhost:5173`。该模式只启动 Vite 渲染进程，适合调试 UI。`/api` 请求会按 Vite 配置代理到后端。

### 独立后端代理

```bash
npm run dev:server
```

代理默认运行在 `http://127.0.0.1:8787`。注意：独立代理不会自动启动 `llama-server.exe`，如需在浏览器模式测试本地 VLM，请先确保 `VLM_HOST:VLM_PORT` 上已有兼容服务在运行。

### 前后端联调

```bash
npm run dev:all
```

同时启动浏览器渲染进程与 Express 代理。

## ESA Pages 部署

仓库根目录已提供 `esa.jsonc`，ESA Pages 会执行 `npm ci` 与 `npm run build:pages`，将 Vite 构建产物 `dist/` 作为 SPA 静态资源发布，并使用 `esa/index.js` 作为边缘函数入口处理 `/api/*` 请求。

在 ESA Pages 控制台的环境变量中至少配置：

```env
QWEN_API_KEY=你的百炼API Key
QWEN_MODEL=qwen3-vl-plus
```

这些变量会在 ESA Pages 构建阶段写入边缘函数私有配置文件；修改环境变量后必须重新构建并重新发布当前版本，再通过 `/api/health` 确认 `qwenConfigured` 为 `true`。

`QWEN_BASE_URL` 可不填，默认使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`；使用智谱 BigModel 时设置：

```env
QWEN_BASE_URL=https://open.bigmodel.cn/api/paas/v4
QWEN_MODEL=glm-4v-flash
```

出于 SSRF 防护，ESA Pages 边缘函数只会请求源码中固定列出的 endpoint；如需接入其他专属域名，应先把完整 base URL 显式加入 ESA endpoint 表后再部署。`/api/ollama/chat/completions` 在 ESA Pages 上会被边缘函数转发到 Qwen VLM API，以保持前端调用路径不变。

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 代理健康检查，返回 Qwen 配置状态和默认模型 |
| POST | `/api/qwen/chat/completions` | Qwen OpenAI-compatible 远程接口代理 |
| POST | `/api/ollama/chat/completions` | 本地 llama.cpp VLM 代理；本地 404/5xx 或连接失败时回退到云端 Qwen/BigModel；ESA Pages 中作为云端 Qwen VLM 兼容别名 |
| GET | `/api/ollama/status` | 本地 VLM 健康状态查询；本地不可用但云端已配置时返回可用；ESA Pages 中返回 Qwen VLM API 配置状态 |

代理层会统一执行请求体大小限制、消息数量限制、`max_tokens` 上限校验、每 IP 每分钟限流、CORS 白名单和上游请求超时控制。

## 核心流程

### 本地 VLM 实时分析

```text
本地摄像头
  -> useFrameCapture：缩放截帧、帧差判断、自适应采样
  -> objectDetector：COCO-SSD Lite 预筛人员/车辆等目标
  -> useVlmAnalysis：高优先级目标触发、空闲兜底触发、请求取消、未变化帧锁释放
  -> /api/ollama/chat/completions：Express 代理
  -> llama-server.exe：本地模型推理
  -> parseVlmResponse：剥离 think 标签、提取 JSON、归一化 detectionBoxes
  -> useAppStore：更新风险分析、检测框和趋势数据
  -> Overview / Monitor / Alerts UI
```

关键文件：

- `src/hooks/useFrameCapture.ts`：截帧、帧差和动态采样间隔。
- `src/services/detection/objectDetector.ts`：动态加载 TensorFlow.js 与 COCO-SSD Lite。
- `src/hooks/useVlmAnalysis.ts`：VLM 连接状态检查、检测预筛、请求调度、中断和未变化帧消费。
- `src/services/llm/ollamaClient.ts`：多模态请求构建、模型响应解析和检测框归一化。
- `electron/ollamaManager.ts`：`llama-server.exe` 启停、健康检查、超时和最多 3 次重启。

VLM 结构化结果类型：

```typescript
interface VlmAnalysis {
  riskScore: number;
  level: 'A' | 'B' | 'C';
  hasRisk: boolean;
  confidence: number;
  summary: string;
  evidenceTimeline: string[];
  breakdown: RiskBreakdown[];
  trend: TrendPoint[];
}
```

### 地图联动

百度地图相关代码位于 `src/components/CameraMapPanel.tsx`、`src/hooks/useBaiduMap.ts`、`src/hooks/useCameraMarkers.ts` 和 `src/services/map/`。

使用前需要：

1. 在 `.env` 中配置 `VITE_BAIDU_MAP_AK`。
2. 在百度地图控制台为浏览器 AK 配置 Referer 白名单，例如 `http://localhost:5173`。
3. 确认点位坐标使用 BD09 坐标系。

### 实时视频播放

`src/components/player/LiveVideoPlayer.tsx` 支持 `flv`、`mpegts`、`hls` 和 `mp4`。当前总览和监控页面默认使用 `useLocalCamera` 接入本地摄像头，播放组件保留给演示流或后续网关接入场景。

```typescript
<LiveVideoPlayer
  url="http://localhost:8080/stream.flv"
  type="flv"
  autoplay={true}
  controls={true}
/>
```

## 构建、测试与打包

```bash
# 单元测试
npm run test

# 监听模式
npm run test:watch

# TypeScript 类型检查
npm run typecheck

# Electron/Vite 生产构建
npm run build

# ESA Pages 静态构建
npm run build:pages

# Windows portable zip 打包
npm run package

# 预览构建后的 Electron 应用
npm run preview
```

`npm run package` 会先执行 `npm run download-model`。打包配置位于 `package.json` 的 `build` 字段；portable 应用包会携带 `llama-server.exe` 与 CPU 通用运行时 DLL（`ggml-cpu-*.dll`、`llama.dll`、`mtmd.dll` 等），但不包含 CUDA-only DLL（`ggml-cuda.dll`、`cudart64_12.dll`、`cublas64_12.dll`、`cublasLt64_12.dll`）和 `Qwen3.5-4B-Q4_K_M.gguf`、`mmproj-BF16.gguf` 两个大模型文件。CI 会额外生成 `vlm-models.zip`，把模型文件与 CUDA 运行时一并分发；CPU 推理只需解压 `.gguf` 模型，GPU 加速则需把 CUDA DLL 一同解压到 `resources\vlm\` 目录下。

提交行为变更前建议运行：

```bash
npm run test
npm run typecheck
npm run build
```

## CI/CD

GitHub Actions 工作流位于 `.github/workflows/build.yml`：

- 触发：push 到 `main`、PR 到 `main`、`v*` 标签和手动触发。
- 环境：`windows-latest`，Node.js 24。
- 步骤：`npm ci`、测试、类型检查、VLM 资源缓存/下载、SHA256 校验、构建、打包。
- Dependabot PR：跳过 VLM 下载和 Windows 打包，只执行必要质量检查。
- VLM 模型包：仅在 `v*` 标签发布或手动触发时生成，普通 `main` push 不再打包数 GB 模型产物。
- Release：推送 `v*` 标签时上传 `windows-portable` 与 `vlm-models` 两类产物。

Dependabot 配置位于 `.github/dependabot.yml`，npm 和 GitHub Actions 依赖每天检查，每类最多保留 2 个开放 PR，避免待审核的主版本更新占满唯一槽位。小版本和补丁版本更新会尝试自动合并，主版本更新会打上 `needs-review` 与 `dependencies` 标签。

## 编码约定

- 前端与 Electron 使用 TypeScript，后端代理和 shared 配置使用 ESM JavaScript。
- React 应用级 Provider 与 Router 统一放在 `src/App.tsx`，`src/main.tsx` 只负责挂载。
- 使用两空格缩进、单引号和分号。
- React 组件使用 PascalCase，例如 `CameraMapPanel.tsx`。
- Hook 使用 `use` 前缀，例如 `useVlmAnalysis.ts`。
- 从 `src` 导入优先使用 `@/` 别名。
- 测试文件与源码就近放置，命名为 `*.test.ts`、`*.test.tsx` 或 `*.test.js`。

## 安全与配置

- 不要提交真实 `.env`。
- Qwen API Key 只放在服务端环境或 CI Secret 中。
- 百度地图浏览器 AK 必须配置 Referer 白名单；本地开发通常需要加入 `http://localhost:5173`。
- `ALLOW_LOCAL_FILE_ORIGINS` 仅在 Electron 内嵌代理场景由主进程覆盖为 `true`，普通浏览器代理默认关闭。
- 独立代理若绑定到非本机地址，应配置 `LOCAL_PROXY_TOKEN` 并要求调用方携带 `X-Local-Proxy-Token`。
- `CORS_ORIGIN` 必须配置为明确的来源白名单；出于安全考虑，`*` 会回退到默认本地开发来源。
- 生产环境保持 `LOG_MODEL_OUTPUT=false`，避免记录模型输出内容。
- VLM 模型文件下载后会校验 SHA256，哈希配置集中在 `shared/vlmModelConfig.js`。

## 常见问题

### 地图不显示

| 现象 | 排查 |
|------|------|
| 白屏或一直加载 | 检查 `VITE_BAIDU_MAP_AK`、网络访问 `api.map.baidu.com` 的能力和浏览器控制台错误 |
| Referer 错误 | 确认 `http://localhost:5173` 或当前域名已加入百度地图控制台白名单 |
| 点位偏移 | 确认数据坐标为 BD09；如为 WGS84 或 GCJ02，需先转换 |

### 摄像头或视频不可用

| 现象 | 排查 |
|------|------|
| 本地摄像头无法启动 | 检查系统摄像头权限、浏览器或 Electron 权限提示，以及是否被其他程序占用 |
| 演示流黑屏 | 检查 `VITE_DEMO_STREAM_URL`、流协议类型和视频服务 CORS |
| 延迟较高 | 优先使用 `flv` 或 `mpegts`，并检查网关缓冲配置 |

### VLM 分析不工作

| 现象 | 排查 |
|------|------|
| 状态停留在连接中 | 检查 `resources/vlm/` 是否包含 `llama-server.exe`、主模型和 `mmproj`，必要时运行 `npm run download-model` |
| 浏览器模式调用失败 | 独立代理不会自动启动 VLM；请使用 `npm run dev` 或自行启动兼容 `VLM_HOST:VLM_PORT` 的服务 |
| GPU 不可用 | 设置 `VLM_FORCE_CPU=true`，或检查 CUDA 12.4 运行时和显卡驱动 |
| 推理超时 | 增大 `VLM_STARTUP_TIMEOUT_MS`，降低 `VLM_CONTEXT_SIZE` 或 `VLM_GPU_LAYERS` |
| 显存不足（8GB 如 RTX 4060） | 保持 `VLM_MTP_ENABLED=false`（避免重复加载模型），将 `VLM_CACHE_TYPE_K/V` 设为 `q8_0`，必要时调低 `VLM_CONTEXT_SIZE`；仍不足可减小 `VLM_GPU_LAYERS` 做部分 CPU 卸载 |
| 启动即退出 / 反复重启 | 多为传入了当前 `llama-server` 不支持的参数；确认 `VLM_MTP_ENABLED=false`（MTP 仅在 llama.cpp 的 MTP 专用构建上可用，官方预编译包不支持） |

### Qwen 代理异常

| 现象 | 排查 |
|------|------|
| 500 配置错误 | 检查 `.env` 中的 `QWEN_BASE_URL` 是否为源码内置 endpoint，以及 `QWEN_API_KEY` 是否存在 |
| 504 超时 | 增大 `QWEN_TIMEOUT`，并确认上游 OpenAI-compatible 服务可访问 |
| 429 限流 | 调整 `CHAT_REQUESTS_PER_MINUTE`，或降低前端请求频率 |

## 相关资源

- [Electron 文档](https://www.electronjs.org/docs/latest)
- [electron-vite](https://electron-vite.org/)
- [Vite 文档](https://cn.vitejs.dev/)
- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Ant Design](https://ant.design/)
- [Recharts](https://recharts.org/)
- [百度地图 JSAPI GL](https://lbsyun.baidu.com/index.php?title=jspopular3.0/api)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [Unsloth Qwen3.5-4B MTP GGUF 模型与 mmproj](https://huggingface.co/unsloth/Qwen3.5-4B-MTP-GGUF)

## 许可证

本项目遵循 [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](LICENSE)。

---

**最后更新**：2026-05-20
