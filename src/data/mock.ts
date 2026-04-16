import type { CameraPoint, DashboardMetric, RiskEvent, TrendPoint, VlmAnalysis } from '@/types';

const demoStreamUrl = import.meta.env.VITE_DEMO_STREAM_URL || '';
const demoStreamType = (import.meta.env.VITE_DEMO_STREAM_TYPE || 'flv') as CameraPoint['streamType'];

const commonTrend: TrendPoint[] = [
  { time: '00:00', value: 22 },
  { time: '04:00', value: 35 },
  { time: '08:00', value: 41 },
  { time: '12:00', value: 53 },
  { time: '16:00', value: 68 },
  { time: '20:00', value: 80 }
];

export const dashboardMetrics: DashboardMetric[] = [
  { label: '在线设备数', value: 128, extra: '离线 6 台' },
  { label: '今日风险事件', value: 42, extra: '高危 8 起' },
  { label: '待处置工单', value: 13, extra: '超时 2 单' },
  { label: '平均预警时延', value: '1.8s', extra: '较昨日 -0.2s' }
];

export const cameras: CameraPoint[] = [
  {
    id: 'CAM-001',
    name: '阳光小区西门',
    area: 'A区',
    riskScore: 86,
    level: 'high',
    status: 'online',
    todayEvents: 4,
    lastAlertTime: '2026-04-16 18:32:05',
    coordinates: [24, 30],
    mapPoint: { lng: 118.7935, lat: 32.0606 },
    streamCover: '社区入口与人车混行区域',
    streamUrl: demoStreamUrl,
    streamType: demoStreamType,
    scene: '主入口'
  },
  {
    id: 'CAM-002',
    name: '2号楼消防通道',
    area: 'B区',
    riskScore: 78,
    level: 'high',
    status: 'online',
    todayEvents: 5,
    lastAlertTime: '2026-04-16 17:22:11',
    coordinates: [48, 45],
    mapPoint: { lng: 118.7967, lat: 32.0614 },
    streamCover: '楼栋消防通道',
    streamUrl: demoStreamUrl,
    streamType: demoStreamType,
    scene: '消防通道'
  },
  {
    id: 'CAM-003',
    name: '地下车库电梯厅',
    area: 'B区',
    riskScore: 62,
    level: 'medium',
    status: 'online',
    todayEvents: 3,
    lastAlertTime: '2026-04-16 16:09:41',
    coordinates: [64, 62],
    mapPoint: { lng: 118.7981, lat: 32.0589 },
    streamCover: '电梯厅与非机动车停放区',
    streamUrl: demoStreamUrl,
    streamType: demoStreamType,
    scene: '电梯厅'
  },
  {
    id: 'CAM-004',
    name: '3号楼单元门口',
    area: 'C区',
    riskScore: 34,
    level: 'low',
    status: 'online',
    todayEvents: 1,
    lastAlertTime: '2026-04-16 10:18:31',
    coordinates: [76, 28],
    mapPoint: { lng: 118.8002, lat: 32.061 },
    streamCover: '单元门口重点通行区域',
    streamUrl: demoStreamUrl,
    streamType: demoStreamType,
    scene: '单元门'
  },
  {
    id: 'CAM-005',
    name: '东侧花园步道',
    area: 'C区',
    riskScore: 57,
    level: 'medium',
    status: 'online',
    todayEvents: 2,
    lastAlertTime: '2026-04-16 15:06:18',
    coordinates: [80, 76],
    mapPoint: { lng: 118.8011, lat: 32.0581 },
    streamCover: '步道与休闲活动区域',
    streamUrl: demoStreamUrl,
    streamType: demoStreamType,
    scene: '公共步道'
  },
  {
    id: 'CAM-006',
    name: '北门停车区',
    area: 'D区',
    riskScore: 0,
    level: 'offline',
    status: 'offline',
    todayEvents: 0,
    lastAlertTime: '2026-04-15 23:59:12',
    coordinates: [16, 72],
    mapPoint: { lng: 118.7928, lat: 32.0579 },
    streamCover: '外围停车区',
    streamType: demoStreamType,
    scene: '停车区'
  }
];

export const defaultAnalysis: VlmAnalysis = {
  riskScore: 86,
  level: 'A',
  hasLeash: false,
  hasBark: undefined,
  hasMuzzle: undefined,
  hasRisk: true,
  confidence: 0.96,
  summary: '消防通道内出现电动自行车违规停放并存在疑似飞线充电风险，建议立即核查并通知物业处置。',
  evidenceTimeline: [
    '18:30:18 目标进入消防通道',
    '18:31:02 电动车停靠在楼道口',
    '18:31:46 疑似充电线缆出现',
    '18:32:05 达到高危告警阈值'
  ],
  breakdown: [
    { label: '规则触发', value: 40 },
    { label: '场景敏感度', value: 25 },
    { label: '持续时长', value: 20 },
    { label: '历史重复性', value: 15 }
  ],
  trend: commonTrend
};

export const events: RiskEvent[] = [
  {
    id: 'EVT-1001',
    title: '消防通道占用并疑似充电',
    cameraId: 'CAM-002',
    cameraName: '2号楼消防通道',
    area: 'B区',
    eventType: '消防风险',
    riskScore: 92,
    level: 'A',
    status: 'pending',
    occurredAt: '2026-04-16 18:32:05',
    summary: '2号楼消防通道检测到电动自行车违规停放，且疑似存在飞线充电行为。',
    suggestion: '立即通知物业清障；如反复发生，建议生成重点巡查任务。',
    snapshot: '关键证据帧：电动车 + 线缆 + 楼道环境',
    tags: ['消防通道', '电动车', '疑似充电'],
    analysis: {
      ...defaultAnalysis,
      riskScore: 92,
      level: 'A'
    }
  },
  {
    id: 'EVT-1002',
    title: '夜间可疑徘徊',
    cameraId: 'CAM-004',
    cameraName: '3号楼单元门口',
    area: 'C区',
    eventType: '治安风险',
    riskScore: 79,
    level: 'A',
    status: 'processing',
    occurredAt: '2026-04-16 00:46:12',
    summary: '同一人员在单元门口连续往返徘徊超过 12 分钟，触发异常停留规则。',
    suggestion: '建议调取前后 30 分钟片段进行复核，并结合门禁记录交叉分析。',
    snapshot: '关键证据帧：目标多次折返靠近门禁',
    tags: ['徘徊', '夜间', '门禁联动'],
    analysis: {
      riskScore: 79,
      level: 'A',
      hasRisk: true,
      confidence: 0.91,
      summary: '目标在夜间高频靠近门禁并反复折返，具备可疑徘徊特征。',
      evidenceTimeline: [
        '00:34:05 目标首次出现',
        '00:38:21 往返次数达到 4 次',
        '00:43:48 逗留超过时长阈值',
        '00:46:12 升级高危告警'
      ],
      breakdown: [
        { label: '停留时长', value: 35 },
        { label: '异常轨迹', value: 30 },
        { label: '夜间权重', value: 20 },
        { label: '历史相似事件', value: 15 }
      ],
      trend: commonTrend
    }
  },
  {
    id: 'EVT-1003',
    title: '人员摔倒求助',
    cameraId: 'CAM-005',
    cameraName: '东侧花园步道',
    area: 'C区',
    eventType: '救助预警',
    riskScore: 68,
    level: 'B',
    status: 'pending',
    occurredAt: '2026-04-16 14:11:26',
    summary: '步道区域检测到疑似人员摔倒，持续未起身约 38 秒。',
    suggestion: '建议先由值班员语音确认，再派近端安保人员到场查看。',
    snapshot: '关键证据帧：目标倒地未移动',
    tags: ['摔倒', '求助', '公共步道'],
    analysis: {
      riskScore: 68,
      level: 'B',
      hasRisk: true,
      confidence: 0.88,
      summary: '目标倒地后长时间无明显移动，符合跌倒辅助判断条件。',
      evidenceTimeline: [
        '14:10:52 目标进入步道',
        '14:11:08 姿态急剧变化',
        '14:11:26 连续静止超过阈值',
        '14:11:46 建议启动求助确认'
      ],
      breakdown: [
        { label: '姿态变化', value: 45 },
        { label: '静止时长', value: 35 },
        { label: '场景风险', value: 10 },
        { label: '历史基线', value: 10 }
      ],
      trend: commonTrend
    }
  }
];
