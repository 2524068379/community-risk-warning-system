# Tasks

- [x] Task 1: 在 MainLayout header 中添加内联指标条
  - [x] SubTask 1.1: 在 `MainLayout.tsx` 中导入 `dashboardMetrics` 数据，在 `header-right` 区域的"运行状态"之前添加紧凑的指标展示元素
  - [x] SubTask 1.2: 在 `styles.css` 中新增 `.header-metrics-strip` 及 `.header-metric-item` 样式，实现内联紧凑排列

- [x] Task 2: 移除 OverviewPage 中的 status-strip 行
  - [x] SubTask 2.1: 在 `OverviewPage.tsx` 中删除 `overview-status-strip` 相关的 JSX 代码
  - [x] SubTask 2.2: 在 `styles.css` 中调整 `.page-shell.overview-page` 的 `grid-template-rows` 从 `auto auto minmax(0, 1fr)` 改为 `auto minmax(0, 1fr)`，并删除不再需要的 `.overview-status-strip`、`.overview-status-item` 样式

- [x] Task 3: 重构 OverviewPage 主内容区布局（VLM 突出 + 地图缩小）
  - [x] SubTask 3.1: 修改 `OverviewPage.tsx` 中 `overview-stage` 和 `overview-side-stack` 的结构，将 VLM 放在上方占更大比例，地图放在下方缩小
  - [x] SubTask 3.2: 在 `styles.css` 中修改 `.overview-stage` 网格比例（左侧 ~45%，右侧 ~55%），修改 `.overview-side-stack` 为 VLM 占约 60%、地图占约 40%
  - [x] SubTask 3.3: 优化 VLM 面板在更大空间下的展示效果（调整 `.vlm-panel`、`.vlm-main-grid`、`.vlm-score-box` 等样式）

- [x] Task 4: 针对 2560×1440 优化全局尺寸和间距
  - [x] SubTask 4.1: 审查并调整 `styles.css` 中 `@media (max-width: 1440px)` 和 `@media (max-width: 1600px)` 媒体查询，确保在 2560×1440 下布局最优
  - [x] SubTask 4.2: 检查 MonitorPage 和 AlertsPage 在新布局下是否也表现正常，必要时微调

# Task Dependencies
- [Task 2] depends on [Task 1]（指标移到 header 后才能删除 status-strip）
- [Task 3] depends on [Task 2]（删除 strip 后才能重构主布局）
- [Task 4] depends on [Task 3]（布局完成后进行全局调优）
