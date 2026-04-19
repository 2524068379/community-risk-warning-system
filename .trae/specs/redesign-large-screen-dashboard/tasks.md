# Tasks

- [x] Task 1: 全面重写 `src/styles.css` 为大屏仪表盘科幻风格
  - [x] SubTask 1.1: 重写全局变量和基础样式（深蓝背景、科幻色系、发光边框变量）
  - [x] SubTask 1.2: 编写标题栏样式（居中标题、发光效果、底部渐变线）
  - [x] SubTask 1.3: 编写三栏布局样式（左 22%、中 50%、右 28%，全高无滚动）
  - [x] SubTask 1.4: 编写左栏面板样式（设备状态卡、风险等级仪表、事件柱状图）
  - [x] SubTask 1.5: 编写中栏地图样式（全高地图、底部预警滚动条）
  - [x] SubTask 1.6: 编写右栏面板样式（VLM 摘要、事件排行、趋势折线图）
  - [x] SubTask 1.7: 清理不再需要的旧样式（page-shell、nav-tab、overview-stage 等）

- [x] Task 2: 扩充 `src/data/mock.ts` 添加大屏所需统计数据
  - [x] SubTask 2.1: 添加设备状态统计（在线/离线/高风险/今日事件数量）
  - [x] SubTask 2.2: 添加风险等级分布数据
  - [x] SubTask 2.3: 添加事件类型统计数据

- [x] Task 3: 更新 `src/types/index.ts` 添加新类型定义
  - [x] SubTask 3.1: 添加设备状态统计类型 `EquipmentStats`
  - [x] SubTask 3.2: 添加事件类型统计类型 `EventTypeStat`

- [x] Task 4: 重写 `src/layouts/MainLayout.tsx` 为大屏仪表盘壳体
  - [x] SubTask 4.1: 移除导航标签和路由 Outlet，改为直接渲染 DashboardPage
  - [x] SubTask 4.2: 实现新标题栏（居中标题、左侧品牌、右侧时间）
  - [x] SubTask 4.3: 实现三栏容器结构

- [x] Task 5: 重写 `src/pages/OverviewPage.tsx` 为 DashboardPage
  - [x] SubTask 5.1: 实现左栏内容（设备状态分析、风险等级分布、事件类型柱状图）
  - [x] SubTask 5.2: 实现中栏内容（地图态势、底部预警滚动条）
  - [x] SubTask 5.3: 实现右栏内容（VLM 摘要、事件排行列表、风险趋势折线图）

- [x] Task 6: 适配 CameraMapPanel 为纯展示模式
  - [x] SubTask 6.1: 确保地图在 display 模式下无工具栏和搜索栏，占满容器全高

- [x] Task 7: 适配 VlmAnalysisPanel 为紧凑展示模式
  - [x] SubTask 7.1: 确保 summary variant 仅展示核心信息（分数、等级、摘要）

- [x] Task 8: 简化路由和入口文件
  - [x] SubTask 8.1: 简化 `src/router/pages.tsx` 为仅导出 DashboardPage
  - [x] SubTask 8.2: 简化 `src/router/index.tsx` 为单页路由
  - [x] SubTask 8.3: 更新 `src/main.tsx` 适配新路由

- [x] Task 9: 清理不再需要的文件
  - [x] SubTask 9.1: 删除 `src/pages/MonitorPage.tsx`
  - [x] SubTask 9.2: 删除 `src/pages/AlertsPage.tsx`
  - [x] SubTask 9.3: 删除 `src/components/PageHeader.tsx`
  - [x] SubTask 9.4: 删除 `src/components/SectionCard.tsx`
  - [x] SubTask 9.5: 删除 `src/components/CameraListPanel.tsx`
  - [x] SubTask 9.6: 删除 `src/components/RiskEventDetailPanel.tsx`

- [x] Task 10: 验证构建通过
  - [x] SubTask 10.1: 运行 TypeScript 类型检查确保无错误
  - [x] SubTask 10.2: 运行开发服务器验证页面可正常加载

# Task Dependencies
- Task 2 和 Task 3 可并行执行
- Task 1 (CSS) 应先完成，为后续组件开发提供样式基础
- Task 4 (MainLayout) 依赖 Task 1 (CSS)
- Task 5 (DashboardPage) 依赖 Task 1、Task 2、Task 3、Task 4
- Task 6 和 Task 7 可并行执行，且依赖 Task 1
- Task 8 依赖 Task 4 和 Task 5
- Task 9 在 Task 5 和 Task 8 完成后执行
- Task 10 在所有其他任务完成后执行
