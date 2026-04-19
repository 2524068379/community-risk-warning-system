# Tasks

- [x] Task 1: OverviewPage 地图移至底部全宽行
  - [x] SubTask 1.1: 修改 `OverviewPage.tsx`，将地图 SectionCard 从 `overview-left-stack` 中移出，放在 `overview-stage` 底部作为独立的全宽行
  - [x] SubTask 1.2: 修改 `styles.css` 中 `.overview-stage` 为三行网格布局，地图用 `.overview-map-row { grid-column: 1 / -1 }` 横跨底部
  - [x] SubTask 1.3: 移除 `.overview-left-stack` 规则，替换为 `.overview-map-row`

- [x] Task 2: MonitorPage 移除 VLM 面板并调整布局
  - [x] SubTask 2.1: 修改 `MonitorPage.tsx`，删除"VLM 实时分析"SectionCard 和 `monitor-detail-stack` 包装器，让视频面板成为 `monitor-stage` 的直接子元素
  - [x] SubTask 2.2: 修改 `styles.css` 中 `.monitor-stage` 为简单的两栏布局，移除 `.monitor-detail-stack` 规则

# Task Dependencies
- 无依赖，Task 1 和 Task 2 可并行执行
