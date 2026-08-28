/**
 * useTaskResults：轮询机器人侧任务结果（D4/D6）。
 * 独立 hook，不进入 useLocalCamera / useVlmAnalysis（不做清单约束）。
 * 请求失败静默降级（机器人未跑/代理未启动时面板隐藏），不打扰风险演示。
 */

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { fetchTaskResults, fetchTaskRun } from '@/services/taskResults';

const POLL_INTERVAL_MS = 2000;

export function useTaskResults(enabled: boolean = true): void {
  const applyTaskResult = useAppStore((state) => state.applyTaskResult);
  const setTaskRun = useAppStore((state) => state.setTaskRun);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    const poll = async () => {
      try {
        const run = await fetchTaskRun();
        if (disposed) return;
        if (run) setTaskRun(run);
        // 每轮全量拉取并 upsert（幂等），机器人重启/换任务序列时自动自愈
        const results = await fetchTaskResults();
        if (disposed) return;
        for (const envelope of results) applyTaskResult(envelope);
      } catch {
        // 机器人/代理不在线：保持静默
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [enabled, applyTaskResult, setTaskRun]);
}
