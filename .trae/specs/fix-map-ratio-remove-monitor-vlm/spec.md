# 地图比例修复与监控页面精简 Spec

## Why
OverviewPage 中的地图面板仍然呈现为扁长条形（宽高比约 4:1），未达到近正方形的预期效果。MonitorPage 中包含的"VLM 实时分析"面板与 OverviewPage 功能重复，需要移除并让视频监控独占右侧全部空间。

## What Changes
- 将 OverviewPage 的地图面板从左侧堆叠中移出，改为横跨底部全宽的独立行，使地图获得更大高度形成近正方形比例
- OverviewPage 主内容区从两栏布局改为"上双栏 + 下全宽地图"的三行布局
- 从 MonitorPage 中移除"VLM 实时分析"SectionCard
- MonitorPage 右侧由视频监控独占全高
- 移除 `monitor-detail-stack` 包装器，视频面板成为 `monitor-stage` 的直接子元素

## Impact
- Affected code:
  - `src/pages/OverviewPage.tsx` — 地图从左侧堆叠移到独立底部行
  - `src/pages/MonitorPage.tsx` — 移除 VLM 面板和 detail-stack 包装器
  - `src/styles.css` — 修改 overview-stage 为三行布局，修改 monitor-stage 为两栏无堆叠

## ADDED Requirements

### Requirement: OverviewPage 地图横跨底部全宽
地图面板应从左侧堆叠中独立出来，横跨 overview-stage 的底部全宽行，获得更大的高度空间以形成近正方形比例。

#### Scenario: 用户查看风险总览页面
- **WHEN** 用户访问风险总览指挥台
- **THEN** 上部左侧显示视频监控面板（占上部约 55% 宽度）
- **AND** 上部右侧显示 VLM 面板（占上部约 45% 宽度）
- **AND** 下部横跨全宽显示地图面板和当前点位摘要
- **AND** 地图面板的宽度与高度比约在 2:1 至 3:1 之间（显著优于之前的 4:1 长条）

### Requirement: MonitorPage 移除 VLM 面板
MonitorPage 应移除"VLM 实时分析"面板，让视频监控详情独占右侧全部高度。

#### Scenario: 用户查看监控点位切换中心
- **WHEN** 用户访问监控点位切换中心页面
- **THEN** 左侧显示监控选择区（地图或设备列表）
- **AND** 右侧显示视频监控详情，独占右侧全部高度
- **AND** 页面中不包含 VLM 实时分析面板

## MODIFIED Requirements

### Requirement: OverviewPage 主内容区布局
主内容区从"左(视频上/地图下) + 右VLM全高"改为"上(左视频+右VLM) + 下(全宽地图)"的三区域布局。地图独立横跨底部，解决长条形问题。

### Requirement: MonitorPage 布局
MonitorPage 从"左选择+右(视频上/VLM下)"改为"左选择+右视频全高"的两栏布局，移除冗余的 VLM 面板。
