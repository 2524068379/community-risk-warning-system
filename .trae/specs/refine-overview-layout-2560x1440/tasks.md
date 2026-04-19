# Tasks

- [x] Task 1: 重构 OverviewPage 布局结构为左(视频+地图)右(VLM全高)
  - [x] SubTask 1.1: 修改 `OverviewPage.tsx`，将 overview-stage 改为左侧堆叠（视频上+地图下）、右侧 VLM 独占全高的结构
  - [x] SubTask 1.2: 修改 `styles.css` 中 `.overview-stage` 网格为 `1.2fr 1fr`（左大右小）
  - [x] SubTask 1.3: 新增左侧堆叠样式 `.overview-left-stack`，设置 `grid-template-rows: 1.8fr 1fr`（视频约 65%，地图约 35%）
  - [x] SubTask 1.4: 移除旧的 `.overview-side-stack` 样式规则

- [x] Task 2: 优化 VLM 面板内部布局可读性
  - [x] SubTask 2.1: 调整 `.vlm-panel` 的 `grid-template-rows`，确保各子区域有合理最小高度
  - [x] SubTask 2.2: 增大 `.vlm-summary-box p` 的 `-webkit-line-clamp` 从 3 改为 5，避免摘要被过度截断
  - [x] SubTask 2.3: 增大 `.trend-line` 的 `min-height` 从 56px 到 72px，让趋势图更清晰

# Task Dependencies
- [Task 2] depends on [Task 1]（布局结构调整后才能验证 VLM 内部可读性）
