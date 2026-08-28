/**
 * 比赛任务结果回传客户端（D4"结果回传"前端侧）。
 * 数据通道：ROS 任务执行器 → server /api/tasks/*（只读聚合代理）→ 本模块。
 * 与风险流水线（useVlmAnalysis/qwenProxy）完全隔离。
 */

import { http } from '@/services/http';
import type {
  CompetitionTaskEnvelope,
  CompetitionTaskRun,
  TaskResultsResponse
} from '@/types/taskResults';

export async function fetchTaskResults(since?: number): Promise<CompetitionTaskEnvelope[]> {
  const query = since !== undefined ? `?since=${encodeURIComponent(String(since))}` : '';
  const { data } = await http.get<TaskResultsResponse>(`/api/tasks/results${query}`);
  return data.ok ? data.results : [];
}

export async function fetchTaskRun(): Promise<CompetitionTaskRun | null> {
  const { data } = await http.get<{ ok: boolean; run: CompetitionTaskRun | null }>('/api/tasks/run');
  return data.ok ? data.run : null;
}
