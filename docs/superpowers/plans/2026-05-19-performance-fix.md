# 性能与配置修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复扫描发现的 14 项中高优先级性能与配置问题，确保 typecheck、测试、构建全部通过。

**架构：** 修改分为三组——前端性能优化（动态导入、memo、定时器去重）、后端健壮性提升（超时、压缩、错误处理、限流清理）、Electron 进程管理（自动重启、优雅关闭）。每组独立可测，互不依赖。

**技术栈：** React 19、Vite 7、Express 5、Electron 41、Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/services/detection/objectDetector.ts` | 修改 | TF.js 动态导入 |
| `src/services/detection/objectDetector.test.ts` | 修改 | 补充动态导入测试 |
| `electron.vite.config.ts` | 修改 | 添加 TF/recharts 分包 |
| `src/hooks/useBaiduMap.ts` | 修改 | 销毁地图实例 |
| `src/components/VlmAnalysisPanel.tsx` | 修改 | useMemo 优化 |
| `src/components/VideoPanel.tsx` | 修改 | React.memo 包裹 |
| `src/pages/AlertsPage.tsx` | 修改 | useMemo 优化 |
| `src/pages/MonitorPage.tsx` | 修改 | 去除重复定时器 |
| `server/qwenProxy.js` | 修改 | 限流清理、超时配置、压缩、全局错误处理 |
| `server/qwenProxy.test.js` | 修改 | 补充限流清理测试 |
| `server/index.js` | 修改 | HTTP timeout、压缩导入 |
| `electron/ollamaManager.ts` | 修改 | VLM 自动重启 |
| `electron/main.ts` | 修改 | 优雅关闭 |
| `package.json` | 修改 | 添加 compression 依赖 |

---

## 任务 1：TensorFlow 动态导入 + 分包配置

**文件：**
- 修改：`src/services/detection/objectDetector.ts:1-2, 43-45`
- 修改：`electron.vite.config.ts:47-69`

### 步骤 1：修改 objectDetector.ts，将静态导入改为动态导入

将 `import * as tf` 和 `import * as cocoSsd` 改为类型导入 + 函数内动态 import：

```typescript
// 删除顶部的两行静态导入：
// import * as tf from '@tensorflow/tfjs'
// import * as cocoSsd from '@tensorflow-models/coco-ssd'

// 替换为类型导入（不产生运行时代码）：
import type { DetectionResult } from '@/types'

type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error'

const ALLOWED_LABELS = new Set(['person', 'car', 'bicycle', 'motorcycle', 'dog'])
const DEFAULT_MIN_SCORE = 0.4

interface RawDetection {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export function filterDetections(
  detections: RawDetection[],
  allowedLabels: Set<string> = ALLOWED_LABELS,
  minScore: number = DEFAULT_MIN_SCORE
): DetectionResult[] {
  return detections
    .filter((d) => d.score >= minScore && allowedLabels.has(d.class))
    .map((d) => ({
      label: d.class,
      score: d.score,
      bbox: d.bbox
    }))
}

let model: import('@tensorflow-models/coco-ssd').ObjectDetection | null = null
let status: DetectorStatus = 'idle'

export function getDetectorStatus(): DetectorStatus {
  return status
}

export async function detect(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult[]> {
  if (!model) {
    if (status === 'loading') return []
    status = 'loading'
    try {
      const [tf, cocoSsd] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('@tensorflow-models/coco-ssd')
      ])
      await tf.ready()
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
      status = 'ready'
    } catch {
      status = 'error'
      return []
    }
  }
  const predictions = await model.detect(source)
  return filterDetections(predictions as RawDetection[])
}

export function disposeDetector(): void {
  model?.dispose()
  model = null
  status = 'idle'
}
```

### 步骤 2：修改 electron.vite.config.ts，添加 TF 和 recharts 分包

在 `manualChunks` 函数中，在 `mpegts.js` 判断之后添加：

```typescript
if (id.includes('@tensorflow')) {
  return 'tf-vendor'
}
if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
  return 'charts-vendor'
}
```

### 步骤 3：运行测试验证

```bash
npx vitest run src/services/detection/objectDetector.test.ts
```

预期：PASS（filterDetections 纯函数测试不受动态导入影响）

### 步骤 4：运行 typecheck 验证

```bash
npm run typecheck
```

预期：无错误

---

## 任务 2：百度地图实例销毁

**文件：**
- 修改：`src/hooks/useBaiduMap.ts:120-125`

### 步骤 1：修改 cleanup 逻辑

将 cleanup 中的 `clearOverlays` + 置空改为先 clear 再 destroy：

```typescript
return () => {
  disposed = true
  if (instanceRef.current) {
    instanceRef.current.clearOverlays?.()
    // BMapGL.Map 实例必须销毁，否则泄漏 DOM 节点和内部状态
    if (typeof instanceRef.current.destroy === 'function') {
      instanceRef.current.destroy()
    }
  }
  instanceRef.current = null
  setReady(false)
}
```

### 步骤 2：确认 `BaiduMapInstance` 类型声明包含 `destroy`

检查 `src/types` 或全局类型中是否有 `BaiduMapInstance` 声明。如果没有，在 `useBaiduMap.ts` 顶部添加局部类型：

```typescript
interface BaiduMapInstance {
  clearOverlays?: () => void
  destroy?: () => void
  checkResize?: () => void
  centerAndZoom?: (point: unknown, zoom: number) => void
  getCenter?: () => unknown
  getZoom?: () => number
  setMapType?: (type: unknown) => void
  setMapStyleV2?: (style: { styleId: string }) => void
  disableDragging?: () => void
  disableScrollWheelZoom?: () => void
  disableDoubleClickZoom?: () => void
  enableScrollWheelZoom?: () => void
  addControl?: (control: unknown) => void
}
```

### 步骤 3：运行 typecheck 验证

```bash
npm run typecheck
```

预期：无错误

---

## 任务 3：VlmAnalysisPanel useMemo 优化

**文件：**
- 修改：`src/components/VlmAnalysisPanel.tsx:1, 10-26`

### 步骤 1：添加 useMemo 导入并包裹 insightItems

```typescript
import { useMemo } from 'react';
import { Progress, Space, Tag } from 'antd';
import type { VlmAnalysis } from '@/types';
import { riskGradeColorMap } from '@/utils/risk';

interface VlmAnalysisPanelProps {
  analysis: VlmAnalysis;
  variant?: 'full' | 'compact' | 'summary';
}

export function VlmAnalysisPanel({ analysis, variant = 'full' }: VlmAnalysisPanelProps) {
  const insightItems = useMemo(() => [
    { label: '是否存在风险', value: analysis.hasRisk ? '是' : '否' },
    { label: '置信度', value: `${Math.round(analysis.confidence * 100)}%` },
    {
      label: '人员徘徊',
      value: typeof analysis.hasLoitering === 'boolean' ? (analysis.hasLoitering ? '是' : '否') : '待分析'
    },
    {
      label: '异常聚集',
      value: typeof analysis.hasGathering === 'boolean' ? (analysis.hasGathering ? '是' : '否') : '待分析'
    },
    {
      label: '人员跌倒',
      value: typeof analysis.hasFallen === 'boolean' ? (analysis.hasFallen ? '是' : '否') : '待分析'
    }
  ], [analysis.hasRisk, analysis.confidence, analysis.hasLoitering, analysis.hasGathering, analysis.hasFallen]);

  // ... 其余代码不变
```

### 步骤 2：运行测试验证

```bash
npm run test
```

预期：全部 PASS

---

## 任务 4：VideoPanel React.memo 包裹

**文件：**
- 修改：`src/components/VideoPanel.tsx:1, 19`

### 步骤 1：用 React.memo 包裹组件

```typescript
import { memo } from 'react';
import { Space, Tag } from 'antd';
import type { CameraPoint } from '@/types';
import { riskColorMap, riskLevelTextMap } from '@/utils/risk';
import { LiveVideoPlayer } from '@/components/player/LiveVideoPlayer';
import { useAppStore } from '@/store/useAppStore';
import {
  formatDetectionBoxConfidence,
  getDetectionBoxClassName,
  getDetectionBoxStyle
} from '@/utils/detectionBoxView';

interface VideoPanelProps {
  camera: CameraPoint;
  subtitle?: string;
  density?: 'default' | 'compact';
  showInfoStrip?: boolean;
}

export const VideoPanel = memo(function VideoPanel({
  camera,
  subtitle,
  density = 'default',
  showInfoStrip
}: VideoPanelProps) {
  // ... 函数体不变
});
```

### 步骤 2：运行 typecheck 验证

```bash
npm run typecheck
```

预期：无错误

---

## 任务 5：AlertsPage useMemo 优化

**文件：**
- 修改：`src/pages/AlertsPage.tsx:1, 21-26`

### 步骤 1：添加 useMemo 并包裹 filteredEvents

```typescript
import { useMemo, useState } from 'react';
import { Tag, Badge } from 'antd';
import { useAppStore } from '@/store/useAppStore';

// ... levelConfig, statusConfig 不变

export function AlertsPage() {
  const { events, selectedEventId, selectEvent } = useAppStore();
  const [filter, setFilter] = useState<string>('全部');

  const filteredEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => b.riskScore - a.riskScore)
      .filter((event) => {
        if (filter === '全部') return true;
        return `${event.level}级` === filter;
      });
  }, [events, filter]);

  // ... 其余代码不变
```

### 步骤 2：运行测试验证

```bash
npm run test
```

预期：全部 PASS

---

## 任务 6：去除 MonitorPage 重复定时器

**文件：**
- 修改：`src/pages/MonitorPage.tsx:17, 35-40`

### 步骤 1：移除 MonitorPage 中的重复时钟定时器

MonitorPage 有自己的 `setInterval(1000)` 来更新 `timestamp`，而 MainLayout 也有一个更新时钟的定时器。MonitorPage 的 timestamp 只用于视频叠加层显示时间，可以复用 MainLayout 的时钟或保留一个更轻量的方案。

保留 MonitorPage 的定时器（因为它显示的是视频叠加时间戳，与 header 时钟不同），但将间隔从 1000ms 改为 5000ms，减少 re-render 频率：

```typescript
useEffect(() => {
  const timer = setInterval(() => {
    setTimestamp(new Date().toLocaleString());
  }, 5000);
  return () => clearInterval(timer);
}, []);
```

### 步骤 2：运行 typecheck 验证

```bash
npm run typecheck
```

预期：无错误

---

## 任务 7：Rate limiter 定期清理

**文件：**
- 修改：`server/qwenProxy.js:169-200`
- 修改：`server/qwenProxy.test.js`

### 步骤 1：添加定期清理逻辑

在 `createChatRateLimiter` 中，添加一个 `setInterval` 来清理过期 bucket：

```javascript
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
```

### 步骤 2：运行现有测试

```bash
npx vitest run server/qwenProxy.test.js
```

预期：PASS

---

## 任务 8：HTTP Server timeout + 全局错误处理

**文件：**
- 修改：`server/index.js:12-14`
- 修改：`electron/main.ts:38-44`
- 修改：`server/qwenProxy.js` — 在 `createQwenProxyApp` 返回前添加全局错误处理

### 步骤 1：在 server/index.js 设置 timeout

```javascript
const config = loadQwenProxyConfig();
const app = createQwenProxyApp(config);

const server = app.listen(config.port, config.host, () => {
  console.log(`Qwen proxy server is running at http://${config.host}:${config.port}`);
});

// 设置 5 分钟超时，防止慢客户端无限占用连接
server.timeout = 300_000;
```

### 步骤 2：在 electron/main.ts 设置 timeout

```typescript
const httpServer = server.listen(0, proxyConfig.host, () => {
  const addr = httpServer.address()
  if (addr && typeof addr === 'object') {
    apiPort = addr.port
  }
  console.log(`Qwen proxy server is running at http://${proxyConfig.host}:${apiPort}`)
})

// 设置 5 分钟超时
httpServer.timeout = 300_000
```

### 步骤 3：在 qwenProxy.js 添加全局错误处理

在 `createQwenProxyApp` 函数末尾、`return app` 之前添加：

```javascript
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
```

### 步骤 4：运行测试

```bash
npx vitest run server/qwenProxy.test.js
```

预期：PASS

---

## 任务 9：Ollama 超时可配置 + compression 中间件

**文件：**
- 修改：`server/qwenProxy.js:69-88`（config 添加 ollamaTimeout）
- 修改：`server/qwenProxy.js:278`（使用 config 替代硬编码）
- 修改：`server/qwenProxy.js:202-213`（添加 compression）
- 修改：`package.json`（添加 compression 依赖）

### 步骤 1：安装 compression

```bash
npm install compression && npm install -D @types/compression
```

### 步骤 2：在 config 中添加 ollamaTimeout

在 `loadQwenProxyConfig` 返回对象中添加：

```javascript
ollamaTimeout: parseInteger(env.OLLAMA_TIMEOUT, 120000),
```

### 步骤 3：替换硬编码超时

将 `createOllamaProxyRoutes` 中的：
```javascript
const timer = setTimeout(() => controller.abort(), 120000);
```
改为：
```javascript
const timer = setTimeout(() => controller.abort(), config.ollamaTimeout);
```

### 步骤 4：添加 compression 中间件

在 `createQwenProxyApp` 中，cors 之后、json 之前添加：

```javascript
import compression from 'compression';

// ... 在 createQwenProxyApp 内部：
app.use(compression());
app.use(cors({ ... }));
app.use(express.json({ limit: config.requestBodyLimit }));
```

### 步骤 5：降低 body limit 默认值

将 config 默认值从 `'8mb'` 改为 `'2mb'`：

```javascript
requestBodyLimit: env.REQUEST_BODY_LIMIT || '2mb',
```

### 步骤 6：运行测试

```bash
npx vitest run server/qwenProxy.test.js
```

预期：PASS（测试不涉及 compression 和实际超时）

---

## 任务 10：VLM 进程崩溃自动重启

**文件：**
- 修改：`electron/ollamaManager.ts:130-169`

### 步骤 1：添加自动重启逻辑

在 `serverProcess.on('exit', ...)` 回调中添加重启逻辑：

```typescript
let restartAttempts = 0
const MAX_RESTART_ATTEMPTS = 3
const RESTART_DELAY_MS = 3000

// 将现有的 exit handler 替换为：
serverProcess.on('exit', (code) => {
  console.log('[vlm] Process exited with code', code)
  serverProcess = null
  ready = false

  if (code !== 0 && restartAttempts < MAX_RESTART_ATTEMPTS) {
    restartAttempts++
    console.log(`[vlm] Restarting in ${RESTART_DELAY_MS}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`)
    status = 'starting'
    setTimeout(() => {
      if (!serverProcess) {
        startOllama().catch((err) => {
          console.error('[vlm] Restart failed:', err)
          status = 'error'
        })
      }
    }, RESTART_DELAY_MS).unref()
  } else {
    status = 'error'
  }
})

// 在 startOllama 成功时重置计数器：
// 在 `ready = true` 之后添加：
restartAttempts = 0
```

### 步骤 2：运行测试

```bash
npx vitest run electron/ollamaManager.test.ts
```

预期：PASS

---

## 任务 11：优雅关闭

**文件：**
- 修改：`electron/main.ts:84-88`

### 步骤 1：修改 window-all-closed 处理

```typescript
app.on('window-all-closed', async () => {
  await stopOllama()

  // 等待 in-flight 请求完成，最多 5 秒
  await new Promise<void>((resolve) => {
    const forceExit = setTimeout(() => resolve(), 5000)
    forceExit.unref()
    httpServer.close(() => {
      clearTimeout(forceExit)
      resolve()
    })
  })

  app.quit()
})
```

### 步骤 2：运行 typecheck

```bash
npm run typecheck
```

预期：无错误

---

## 任务 12：最终验证

### 步骤 1：运行全量测试

```bash
npm run test
```

预期：23 文件全部 PASS，69 用例全部通过

### 步骤 2：运行 typecheck

```bash
npm run typecheck
```

预期：无错误

### 步骤 3：运行构建

```bash
npm run build
```

预期：构建成功，无错误

### 步骤 4：验证分包效果

检查 `dist/renderer/assets/` 目录，确认存在 `tf-vendor-*.js` 和 `charts-vendor-*.js` chunk 文件。

---

## 注意事项

- 任务 1-6 互相独立，可并行执行
- 任务 9 需要先 `npm install`，是任务 7-8 的前置
- 任务 10-11 互相独立
- 任务 12 必须最后执行
- 所有修改必须通过 typecheck + 测试 + 构建
