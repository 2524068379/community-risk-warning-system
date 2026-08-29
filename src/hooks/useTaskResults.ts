/**
 * useTaskResults：轮询机器人侧任务结果（D4/D6）。
 * 独立 hook，不进入 useLocalCamera / useVlmAnalysis（不做清单约束）。
 * 请求失败静默降级（机器人未跑/代理未启动时面板隐藏），不打扰风险演示。
 */

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { fetchTaskResults, fetchTaskRun } from '@/services/taskResults';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5000;

export function useTaskResults(enabled: boolean = true): void {
  const applyTaskResults = useAppStore((state) => state.applyTaskResults);
  const setTaskRun = useAppStore((state) => state.setTaskRun);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let inFlight = false;

    const poll = async () => {
      // 上一轮未返回时跳过本 tick，避免代理卡顿时轮询堆积
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
      const requestConfig = { timeout: POLL_TIMEOUT_MS, signal: controller.signal };
      try {
        const run = await fetchTaskRun(requestConfig);
        if (disposed) return;
        if (run) setTaskRun(run);
        // 每轮全量拉取并批量 upsert（幂等），机器人重启/换任务序列时自动自愈
        const results = await fetchTaskResults(undefined, requestConfig);
        if (disposed) return;
        applyTaskResults(results);
      } catch {
        // 机器人/代理不在线：保持静默
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [enabled, applyTaskResults, setTaskRun]);
}
