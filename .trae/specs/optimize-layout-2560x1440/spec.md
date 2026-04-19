# 2560×1440 分辨率界面布局优化 Spec

## Why
当前界面在小分辨率下存在组件堆叠问题，且"在线设备数"等四个指标卡片占据整行显示空间，地图作为静态展示也占用了过多区域，VLM 分析面板未得到突出展示。需要针对 2560×1440 分辨率重新优化整体布局，提升信息密度和视觉层级。

## What Changes
- 将 OverviewPage 中的四个指标卡片（在线设备数、今日风险事件、待处置工单、平均预警时延）从独立整行移入顶部导航栏 `screen-header` 中，作为紧凑的内联状态指示器
- 移除 `overview-status-strip` 整行区域，释放垂直空间给主要内容区
- 缩小地图展示区域高度（静态展示模式，仅保留最小可视范围）
- 扩大 VLM 实时研判面板的展示区域，使其成为右侧主视觉焦点
- 重新调整 OverviewPage 主内容区的网格比例，左侧为视频、右侧以 VLM 为主、地图为辅
- 针对 2560×1440 优化 CSS 网格尺寸和间距

## Impact
- Affected code:
  - `src/layouts/MainLayout.tsx` — 在 header 中新增指标数据展示位
  - `src/pages/OverviewPage.tsx` — 移除 status-strip，重构主内容布局
  - `src/styles.css` — 新增/修改 header 指标样式、overview 布局样式、VLM 面板样式、地图面板样式
  - `src/data/mock.ts` — 指标数据导出方式不变，仅在 header 中消费
  - `src/store/useAppStore.ts` — 无需变更

## ADDED Requirements

### Requirement: Header 内联指标展示
系统应在顶部导航栏（screen-header）的右侧区域（header-right）中，以紧凑的内联指标条（header-metrics-strip）形式展示四个关键指标（在线设备数、今日风险事件、待处置工单、平均预警时延），每个指标仅显示数值和简短标签，不占用独立行高。

#### Scenario: 用户打开任意页面
- **WHEN** 用户导航到平台任意页面
- **THEN** 顶部导航栏右侧可见四个紧凑指标，显示为 `标签 数值` 的内联形式
- **AND** 指标条不换行，与现有的运行状态、时间、通知铃铛等元素水平排列

### Requirement: OverviewPage 主内容区重新布局
系统应将 OverviewPage 主内容区（overview-stage）重新设计为三区域布局：左侧视频面板占约 45% 宽度，右侧上部 VLM 面板占约 60% 高度，右侧下部为缩小版地图 + 当前点位摘要占约 40% 高度。

#### Scenario: 用户查看风险总览页面
- **WHEN** 用户访问风险总览指挥台页面
- **THEN** 页面不显示独立的指标卡片行（overview-status-strip 已移除）
- **AND** 左侧显示视频监控面板，占据约 45% 宽度
- **AND** 右侧上部显示 VLM 实时研判面板，高度约为右侧的 60%
- **AND** 右侧下部显示缩小的静态地图和当前点位摘要，高度约为右侧的 40%
- **AND** 所有组件无堆叠、无溢出、无遮挡

### Requirement: VLM 面板突出展示
VLM 实时研判面板应获得更大的展示空间，风险分数仪表盘、洞察网格、风险构成/趋势图、证据时间轴等子组件均应完整可见且不被压缩。

#### Scenario: VLM 面板在 OverviewPage 中展示
- **WHEN** 用户查看风险总览页面
- **THEN** VLM 面板完整展示所有 full variant 内容（风险分数、洞察、构成、趋势、时间轴）
- **AND** 面板内部各元素间距合理，文字不被截断

### Requirement: 地图面板最小化展示
地图面板在 OverviewPage 中仅作为静态参考展示，高度应缩小至仅能看清点位标记和区域概况的最小尺寸。

#### Scenario: 地图在 OverviewPage 中展示
- **WHEN** 用户查看风险总览页面
- **THEN** 地图以静态模式（display mode）展示，无交互控件
- **AND** 地图高度不超过右侧区域的 40%

## MODIFIED Requirements

### Requirement: 顶部导航栏布局
顶部导航栏（screen-header）应扩展为包含指标展示的三段式布局：左侧品牌、中间导航、右侧指标+状态+时间+用户。在 2560×1440 分辨率下，header 高度保持 64px，右侧新增的指标条应与现有元素在同一行内排列。
