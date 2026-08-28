/**
 * 比赛任务结果类型（materials/02 决策 D6 的 store 侧类型面）。
 * ------------------------------------------------------------------
 * 单一事实源是 competition/code/task-contract/types.ts（含 Vitest 单测）；
 * competition/ 目录不参与构建，故在此维护 store/页面依赖的最小子集镜像。
 * 修改契约时同步此文件（字段为宽松镜像：超集兼容，不阻断展示）。
 * ------------------------------------------------------------------
 */

export type CompetitionTaskId =
  | 'traffic_light'
  | 'people_count'
  | 'sign_reading'
  | 'trash_bin'
  | 'building_fire'
  | 'building_temperature'
  | 'gauge_reading'
  | 'license_plate'
  | 'ebike_status'
  | 'parking';

/** 任务结果（宽松镜像：契约各任务结果 + 公共字段）。 */
export interface CompetitionTaskResult {
  task: CompetitionTaskId;
  /** 赛题播报文本（对应"播报和输出范例"）。 */
  announcement: string;
  summary?: string;
  [field: string]: unknown;
}

/** 机器人侧检测框（归一化，镜像 DetectionBoxLike）。 */
export interface CompetitionTaskBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

/** TaskAnalysisResult 信封（镜像 competition 契约同名接口）。 */
export interface CompetitionTaskEnvelope {
  type: 'task';
  taskId: CompetitionTaskId;
  location: string;
  capturedAt: number;
  result: CompetitionTaskResult;
  boxes: CompetitionTaskBox[];
  /** server/tasksIngest 附加的服务端接收时间。 */
  receivedAt?: number;
}

/** 巡检运行状态（对应 /api/tasks/run）。 */
export interface CompetitionTaskRun {
  type: 'run';
  status: 'running' | 'done';
  startedAt?: number;
  completedAt?: number;
  detail?: Array<{ id: string; ok: boolean }>;
  receivedAt?: number;
}

/** /api/tasks/results 响应。 */
export interface TaskResultsResponse {
  ok: boolean;
  count: number;
  results: CompetitionTaskEnvelope[];
}
