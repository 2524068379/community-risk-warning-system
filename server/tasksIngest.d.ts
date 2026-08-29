/**
 * server/tasksIngest.js 的类型声明（JS 服务端模块被 Electron 主进程消费）。
 * 完整实现以 tasksIngest.js 为准。
 */
import type { Router } from 'express';

export const COMPETITION_TASK_IDS: readonly string[];

export function createTasksIngestRouter(options?: { maxResults?: number }): Router;

export function validateTaskEnvelope(payload: unknown): {
  ok: boolean;
  error?: string;
  envelope?: Record<string, unknown>;
};

export function validateRunEvent(payload: unknown): {
  ok: boolean;
  error?: string;
  event?: Record<string, unknown>;
};
