# 大屏可视化仪表盘重构 Spec

## Why
当前项目采用多页面路由架构（总览/监控选择/重点预警），布局风格偏常规管理系统。参考 example 目录下的两张大屏可视化效果图（产业资讯数据中心、电力智慧运维系统），需将项目重构为单页大屏仪表盘，采用深色科幻风格的三栏布局，提升视觉表现力和信息密度。

## What Changes
- **BREAKING** 移除多页面路由（OverviewPage、MonitorPage、AlertsPage），改为单页仪表盘
- 重构整体布局为：顶部标题栏 + 左/中/右三栏大屏布局
- 全面重写 CSS 样式，匹配参考图片的深蓝科幻风格（发光边框、渐变背景、辉光效果）
- 重构 MainLayout 为大屏仪表盘壳体（新标题栏、三栏容器）
- 新建 DashboardPage 作为唯一页面，整合原有三个页面的核心功能
- 左栏：设备状态分析（2×2 指标卡）、风险等级仪表盘、事件类型柱状图
- 中栏：百度地图态势（全高展示）、底部实时预警滚动条
- 右栏：VLM 实时研判摘要、预警事件排行列表、风险趋势折线图
- 移除不再需要的页面和组件（MonitorPage、AlertsPage、CameraListPanel、RiskEventDetailPanel、PageHeader、SectionCard）
- 保留并适配核心功能组件（CameraMapPanel、VlmAnalysisPanel、MetricCard、LiveVideoPlayer）

## Impact
- Affected code:
  - `src/styles.css` — 全面重写，新增大屏仪表盘布局和科幻风格样式
  - `src/layouts/MainLayout.tsx` — 重构为大屏仪表盘壳体
  - `src/main.tsx` — 简化路由配置
  - `src/router/index.tsx` — 简化为单页路由
  - `src/router/pages.tsx` — 简化为单页
  - `src/pages/OverviewPage.tsx` — 重写为 DashboardPage
  - `src/pages/MonitorPage.tsx` — 删除
  - `src/pages/AlertsPage.tsx` — 删除
  - `src/components/PageHeader.tsx` — 删除
  - `src/components/SectionCard.tsx` — 删除
  - `src/components/CameraListPanel.tsx` — 删除
  - `src/components/RiskEventDetailPanel.tsx` — 删除
  - `src/components/CameraMapPanel.tsx` — 适配大屏中栏布局
  - `src/components/VlmAnalysisPanel.tsx` — 适配右栏紧凑展示
  - `src/components/MetricCard.tsx` — 适配左栏状态卡样式
  - `src/data/mock.ts` — 扩充大屏所需的统计数据
  - `src/store/useAppStore.ts` — 保持不变
  - `src/types/index.ts` — 可能新增统计类型
  - `src/utils/risk.ts` — 保持不变

## ADDED Requirements

### Requirement: 大屏仪表盘单页布局
系统应提供一个单页大屏仪表盘，采用顶部标题栏 + 左/中/右三栏布局。左栏约占 22% 宽度，中栏约占 50% 宽度，右栏约占 28% 宽度。整体占满视口高度（100vh），不产生页面滚动。

#### Scenario: 用户打开应用
- **WHEN** 用户启动应用或刷新页面
- **THEN** 直接显示大屏仪表盘，无需页面导航
- **AND** 页面占满浏览器视口，无滚动条
- **AND** 左/中/右三栏清晰分隔，各栏内容完整可见

### Requirement: 顶部标题栏
标题栏应采用居中大标题设计，左侧显示品牌标识，右侧显示日期时间和系统状态。标题文字应有发光效果，底部有渐变分隔线。

#### Scenario: 标题栏展示
- **WHEN** 大屏仪表盘加载完成
- **THEN** 标题栏居中显示"险封·社区风险预警平台"
- **AND** 左侧显示品牌 Logo 和副标题
- **AND** 右侧显示实时时钟（HH:MM:SS）和日期（YYYY-MM-DD 星期X）
- **AND** 标题栏高度约 64px，底部有蓝色渐变分隔线

### Requirement: 左栏 — 设备状态分析
左栏顶部应展示设备状态分析面板，包含 4 个指标卡片（2×2 网格），分别显示在线设备数、离线设备数、高风险点位数、今日事件数。每个卡片包含图标、数值和标签。

#### Scenario: 设备状态展示
- **WHEN** 大屏加载完成
- **THEN** 左栏顶部可见"设备状态分析"面板标题
- **AND** 面板内 4 个指标卡片以 2×2 网格排列
- **AND** 每个卡片显示数值和描述标签

### Requirement: 左栏 — 风险等级仪表盘
左栏中部应展示风险等级分布，使用环形仪表盘或进度条展示各级别（高/中/低/离线）设备的占比。

#### Scenario: 风险等级展示
- **WHEN** 大屏加载完成
- **THEN** 左栏中部可见风险等级分布可视化
- **AND** 各等级以不同颜色区分（高=红、中=橙、低=绿、离线=灰）

### Requirement: 左栏 — 事件类型统计柱状图
左栏底部应展示事件类型统计柱状图，按事件类型（消防风险、治安风险、救助预警等）显示发生次数。

#### Scenario: 事件类型统计展示
- **WHEN** 大屏加载完成
- **THEN** 左栏底部可见事件类型统计面板
- **AND** 以柱状图形式展示各类型事件数量
- **AND** 柱状图使用 CSS 实现，无需第三方图表库

### Requirement: 中栏 — 地图态势全屏展示
中栏应展示百度地图全高态势图，显示所有监控点位标记。地图以展示模式运行（禁用拖拽缩放），点位以不同颜色标记风险等级。底部叠加实时预警滚动条。

#### Scenario: 地图态势展示
- **WHEN** 大屏加载完成
- **THEN** 中栏显示百度地图，占满中栏全高
- **AND** 各监控点位以颜色标记显示（高=红、中=橙、低=绿）
- **AND** 地图底部叠加一条实时预警滚动信息条

### Requirement: 右栏 — VLM 实时研判摘要
右栏顶部应展示 VLM 实时研判摘要，包含风险分数、风险等级标签、置信度和模型摘要。使用紧凑布局，不展示完整时间轴和趋势图。

#### Scenario: VLM 摘要展示
- **WHEN** 大屏加载完成
- **THEN** 右栏顶部可见 VLM 实时研判面板
- **AND** 显示当前风险分数（大号数字）和等级标签
- **AND** 显示模型摘要文本

### Requirement: 右栏 — 预警事件排行列表
右栏中部应展示预警事件排行列表，按风险分数降序排列。每条事件显示序号、标题、风险分数和等级标签。

#### Scenario: 事件排行展示
- **WHEN** 大屏加载完成
- **THEN** 右栏中部可见"预警事件排行"面板
- **AND** 事件按风险分数从高到低排列
- **AND** 每条事件显示排名序号、标题、风险分数和等级标签
- **AND** 当前选中事件高亮显示

### Requirement: 右栏 — 风险趋势折线图
右栏底部应展示风险趋势折线图，使用 CSS 实现的简易折线图，显示近 6 个时段的风险分数变化。

#### Scenario: 风险趋势展示
- **WHEN** 大屏加载完成
- **THEN** 右栏底部可见风险趋势图
- **AND** 折线图显示近 6 个时段的数值变化
- **AND** 各数据点有标签显示时间

### Requirement: 科幻视觉风格
整体视觉应匹配参考图片的深蓝科幻风格：深蓝背景（#06101f ~ #0a192f）、发光蓝色边框、渐变面板背景、橙色高亮数据、白色标题文字。

#### Scenario: 视觉风格一致性
- **WHEN** 大屏加载完成
- **THEN** 背景为深蓝色渐变
- **AND** 面板边框有蓝色辉光效果
- **AND** 标题文字为白色，数据高亮为橙色或蓝色
- **AND** 整体风格与参考图片一致

## MODIFIED Requirements

### Requirement: CameraMapPanel 适配展示模式
CameraMapPanel 在大屏中栏使用时，应以纯展示模式运行（无搜索栏、无工具栏、无标签行），地图占满中栏全高。

### Requirement: VlmAnalysisPanel 适配紧凑模式
VlmAnalysisPanel 在右栏使用时，应使用 summary variant，仅展示风险分数、等级、置信度和摘要，不展示完整趋势图和时间轴。

## REMOVED Requirements

### Requirement: 多页面路由导航
**Reason**: 大屏仪表盘采用单页布局，不再需要多页面路由和导航标签。
**Migration**: 移除 OverviewPage、MonitorPage、AlertsPage 三个页面和对应的路由配置，所有内容整合到 DashboardPage。

### Requirement: PageHeader 组件
**Reason**: 大屏标题栏直接在 MainLayout 中实现，各页面不再需要独立的 PageHeader。
**Migration**: 删除 PageHeader 组件。

### Requirement: SectionCard 组件
**Reason**: 大屏面板使用自定义 CSS 样式实现卡片效果，不再使用 Ant Design Card。
**Migration**: 删除 SectionCard 组件，面板样式直接在 CSS 中定义。

### Requirement: CameraListPanel 组件
**Reason**: 大屏不显示独立的设备列表面板，设备信息通过地图标记展示。
**Migration**: 删除 CameraListPanel 组件。

### Requirement: RiskEventDetailPanel 组件
**Reason**: 大屏右栏以排行列表形式展示事件，不再需要详细的处置面板。
**Migration**: 删除 RiskEventDetailPanel 组件，事件排行直接在 DashboardPage 中实现。
