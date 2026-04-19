# Tasks

- [x] Task 1: 安装 Electron 相关依赖
  - [x] SubTask 1.1: 安装运行时依赖 `electron`
  - [x] SubTask 1.2: 安装开发依赖 `electron-vite`、`electron-builder`、`@electron-toolkit/preload`、`@electron-toolkit/utils`
  - [x] SubTask 1.3: 安装 TypeScript 类型 `@types/express`（主进程需要）

- [x] Task 2: 创建 Electron 主进程入口文件
  - [x] SubTask 2.1: 创建 `electron/main.ts`，实现 BrowserWindow 创建和生命周期管理
  - [x] SubTask 2.2: 在主进程中内嵌 Express HTTP 服务（移植 `server/index.js` 逻辑），监听随机端口
  - [x] SubTask 2.3: 通过 preload 脚本将 API 服务地址暴露给渲染进程
  - [x] SubTask 2.4: 创建 `electron/preload.ts`，使用 `contextBridge` 暴露 `electronAPI.getApiBase()`

- [x] Task 3: 配置 electron-vite 构建系统
  - [x] SubTask 3.1: 创建 `electron/tsconfig.json` 用于主进程和预加载脚本的 TypeScript 编译
  - [x] SubTask 3.2: 将 `vite.config.ts` 重构为 `electron.vite.config.ts`，包含 main / preload / renderer 三部分配置
  - [x] SubTask 3.3: 更新 `tsconfig.node.json` 以包含 `electron/` 目录

- [x] Task 4: 更新 package.json
  - [x] SubTask 4.1: 设置 `"main"` 指向编译后的主进程入口（`./dist/main/main.cjs`）
  - [x] SubTask 4.2: 更新 scripts：`dev` → `electron-vite dev`，`build` → `electron-vite build`，新增 `package` → `electron-builder`
  - [x] SubTask 4.3: 添加 `electron-builder` 的 `build` 配置段（Windows NSIS 打包、appId、文件包含/排除规则）

- [x] Task 5: 适配前端代码
  - [x] SubTask 5.1: 修改 `src/services/http.ts`，在 Electron 环境下从 `window.electronAPI.getApiBase()` 获取 API 基址
  - [x] SubTask 5.2: 确保 Vite 开发代理 `/api` 仍然可用（开发模式下 electron-vite renderer 的 proxy 配置）

- [x] Task 6: 更新项目配置文件
  - [x] SubTask 6.1: 更新 `.gitignore`，新增 `dist-electron/`、`release/`、`out/` 等 Electron 构建产物目录
  - [x] SubTask 6.2: 确认 `.env.server` 相关配置在 Electron 打包后可通过用户配置或环境变量加载

- [x] Task 7: 创建 GitHub Actions CI 工作流
  - [x] SubTask 7.1: 创建 `.github/workflows/build.yml`
  - [x] SubTask 7.2: 配置触发条件：`push tag v*` 触发打包发布，`pull_request` 触发构建验证
  - [x] SubTask 7.3: 配置 Windows 构建步骤：checkout → Node.js 安装 → npm ci → build → package
  - [x] SubTask 7.4: 配置 Release 步骤：使用 `softprops/action-gh-release` 上传 NSIS 安装包到 GitHub Release

- [x] Task 8: 验证构建与运行
  - [x] SubTask 8.1: 执行 `npm run build` 验证构建无错误
  - [x] SubTask 8.2: 执行 `npm run package` 验证打包生成 Windows 安装程序

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 2]
- [Task 7] depends on [Task 4]
- [Task 8] depends on [Task 4, Task 5, Task 6]
