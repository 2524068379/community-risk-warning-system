import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import type { CompetitionTaskEnvelope } from '@/types/taskResults';

const envelope = (taskId: CompetitionTaskEnvelope['taskId']): CompetitionTaskEnvelope => ({
  type: 'task',
  taskId,
  location: 'traffic_light_zone',
  capturedAt: 1756370000000,
  result: { task: taskId, announcement: `测试播报 ${taskId}` },
  boxes: []
});

describe('useAppStore 比赛任务切片（D6）', () => {
  beforeEach(() => {
    useAppStore.setState({ taskResults: {}, taskRun: { status: 'idle' } });
  });

  it('applyTaskResult upsert 最新信封并驱动运行状态', () => {
    const { applyTaskResult } = useAppStore.getState();
    applyTaskResult(envelope('traffic_light'));
    expect(useAppStore.getState().taskResults.traffic_light?.result.announcement).toBe(
      '测试播报 traffic_light'
    );
    expect(useAppStore.getState().taskRun.status).toBe('running');
    expect(useAppStore.getState().taskRun.currentTaskId).toBe('traffic_light');

    applyTaskResult(envelope('people_count'));
    expect(useAppStore.getState().taskRun.currentTaskId).toBe('people_count');
    expect(Object.keys(useAppStore.getState().taskResults)).toHaveLength(2);
  });

  it('setTaskRun 记录 startedAt/completedAt', () => {
    const { setTaskRun } = useAppStore.getState();
    setTaskRun({ status: 'running', startedAt: 1000 });
    expect(useAppStore.getState().taskRun.status).toBe('running');
    expect(useAppStore.getState().taskRun.startedAt).toBe(1000);
    setTaskRun({ status: 'done', completedAt: 2000 });
    expect(useAppStore.getState().taskRun.status).toBe('done');
    expect(useAppStore.getState().taskRun.completedAt).toBe(2000);
  });

  it('applyTaskResult 不改动风险流水线字段', () => {
    const before = useAppStore.getState().analysis;
    useAppStore.getState().applyTaskResult(envelope('traffic_light'));
    expect(useAppStore.getState().analysis).toBe(before);
  });
});
