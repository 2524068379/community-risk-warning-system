# 使用 Electron 重构项目并配置 GitHub CI 打包

## Why
当前项目是一个基于 Vite + React 的纯 Web SPA，依赖外部 Express 服务器代理 Qwen AI 接口。将其重构为 Electron 桌面应用可以：
- 将前端和后端代理整合为一个独立的桌面应用，简化部署
- 利用 Electron 主进程内置 HTTP 服务，消除对独立 Node 服务器的依赖
- 通过 GitHub CI 自动构建 Windows 安装包，实现自动化发布

## What Changes
- 引入 `electron` 和 `electron-builder` 作为核心依赖
- 引入 `electron-vite` 替代原生 Vite 配置，管理主进程、预加载脚本和渲染进程的构建
- 将现有 Express 代理服务器逻辑迁移到 Electron 主进程中
- 新增 Electron 主进程入口文件 (`electron/main.ts`)
- 新增预加载脚本 (`electron/preload.ts`)，提供安全的 IPC 通信桥接
- 修改 Vite 配置为 `electron-vite` 兼容格式
- 调整 `package.json` 的 `main` 字段和构建脚本
- 新增 GitHub Actions 工作流，自动在 Windows 环境下打包并发布
- **BREAKING**: 开发方式从 `npm run dev` 变为 `electron-vite dev`，生产环境不再需要单独启动 Express 服务器

## Impact
- Affected code:
  - `vite.config.ts` → 拆分为 `electron.vite.config.ts`（含 main / preload / renderer 三部分配置）
  - `server/index.js` → 逻辑迁移至 `electron/main.ts`，原文件保留但不再用于生产
  - `package.json` → 新增 Electron 相关依赖、脚本和构建配置
  - `tsconfig.app.json` / `tsconfig.node.json` → 需适配 Electron 主进程和预加载脚本的 TS 配置
  - `.gitignore` → 新增 Electron 构建产物忽略规则
- New files:
  - `electron/main.ts` — Electron 主进程入口
  - `electron/preload.ts` — 预加载脚本
  - `electron/tsconfig.json` — 主进程/预加载脚本 TS 配置
  - `.github/workflows/build.yml` — GitHub Actions CI 工作流

## ADDED Requirements

### Requirement: Electron 桌面应用框架
系统 SHALL 基于 Electron 将现有 Web 应用封装为 Windows 桌面应用。

#### Scenario: 启动桌面应用
- **WHEN** 用户双击运行打包后的 exe 或执行 `electron-vite dev`
- **THEN** 应用以原生窗口形式启动，加载 React 渲染进程界面，同时主进程在后台提供 API 代理服务

#### Scenario: 窗口配置
- **WHEN** Electron 主进程创建 BrowserWindow
- **THEN** 窗口标题为"险封·社区风险预警平台"，使用 shield.svg 作为图标，初始尺寸为 1440×900，支持最小化/最大化/关闭

### Requirement: 主进程内置 API 代理
系统 SHALL 在 Electron 主进程中启动 HTTP 服务，替代独立的 Express 服务器，提供与原 `server/index.js` 相同的 API 代理功能。

#### Scenario: 主进程启动 API 代理
- **WHEN** Electron 主进程初始化完成
- **THEN** 在本地随机可用端口启动 HTTP 服务，提供 `/api/health` 和 `/api/qwen/chat/completions` 端点

#### Scenario: 渲染进程访问 API
- **WHEN** 渲染进程（前端）发起 `/api/*` 请求
- **THEN** 请求被代理到主进程的内置 HTTP 服务，行为与原 Express 代理一致

### Requirement: 预加载脚本安全桥接
系统 SHALL 通过预加载脚本（preload script）向渲染进程暴露主进程 API 服务的基址。

#### Scenario: 渲染进程获取 API 地址
- **WHEN** 渲染进程通过 `window.electronAPI` 访问 API 基址
- **THEN** 返回主进程 HTTP 服务的实际地址（如 `http://localhost:PORT`）

### Requirement: GitHub Actions CI 自动构建
系统 SHALL 通过 GitHub Actions 在 Windows 环境下自动构建 Electron 应用并生成安装包。

#### Scenario: 推送 tag 触发构建
- **WHEN** 推送 `v*` 格式的 tag 到仓库
- **THEN** GitHub Actions 自动执行：安装依赖 → 构建 → 打包为 Windows 安装程序（NSIS .exe）→ 创建 GitHub Release 并上传安装包

#### Scenario: Pull Request 触发验证构建
- **WHEN** 创建或更新 Pull Request
- **THEN** GitHub Actions 执行构建验证（不打包安装程序），确保代码可以正常编译

### Requirement: 开发与构建脚本
系统 SHALL 提供完整的开发和构建 npm scripts。

#### Scenario: 开发模式
- **WHEN** 执行 `npm run dev`
- **THEN** 启动 electron-vite 开发模式，支持热更新，同时启动主进程和渲染进程

#### Scenario: 生产构建
- **WHEN** 执行 `npm run build`
- **THEN** 编译主进程、预加载脚本和渲染进程代码，输出到 `dist` 目录

#### Scenario: 打包安装程序
- **WHEN** 执行 `npm run package`
- **THEN** 使用 electron-builder 将构建产物打包为 Windows 安装程序，输出到 `dist-electron` 目录

## MODIFIED Requirements

### Requirement: 项目构建配置
项目构建配置 SHALL 从单一 Vite 配置迁移到 `electron-vite` 多目标配置：
- **main**: 编译 `electron/main.ts`（Node.js 环境，CJS 格式）
- **preload**: 编译 `electron/preload.ts`（Node.js 环境，CJS 格式）
- **renderer**: 编译 `src/` 下的 React 应用（浏览器环境，ESM 格式，保留原有 Vite 插件和分块策略）

## REMOVED Requirements

### Requirement: 独立 Express 服务器进程
**Reason**: Express 代理逻辑已迁移至 Electron 主进程，不再需要独立运行服务器
**Migration**: `server/index.js` 保留用于参考，但 `dev:server` 和 `dev:all` 脚本不再需要
