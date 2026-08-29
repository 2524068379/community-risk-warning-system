/**
 * 任务结果回传通道（materials/02 决策 D4 的"结果回传"落点）。
 *
 * ROS 侧任务执行器把 TaskAnalysisResult 信封 POST 到 /api/tasks/ingest，
 * 前端经 GET /api/tasks/results 轮询展示（D6：store 的 taskResults/taskRun 切片）。
 * 本路由为只读聚合代理：仅缓存最近若干条结果，不持久化、不转发到任何外部服务；
 * 与风险流水线（qwenProxy / shared schema）完全隔离，不改变其任何行为。
 *
 * taskId 白名单镜像 competition/code/task-contract 的 TaskId 联合类型；
 * 契约本体以 task-contract/specs.ts（单测覆盖）为单一事实源。
 */

import { Router } from 'express';
import express from 'express';

/** 与 competition/code/task-contract/types.ts 的 TaskId 保持一致（镜像，勿双处扩展）。 */
export const COMPETITION_TASK_IDS = Object.freeze([
  'traffic_light',
  'people_count',
  'sign_reading',
  'trash_bin',
  'building_fire',
  'building_temperature',
  'gauge_reading',
  'license_plate',
  'ebike_status',
  'parking'
]);

const KNOWN_RUN_STATUSES = new Set(['running', 'done']);

// 字段长度与信封总字节预算：未鉴权写入者不能靠超长字段放大内存
// （maxResults=200 条 × 上限 ≈ 6.4MB 堆，而不是 200 × 1MB body = 200MB）。
const MAX_LOCATION_LENGTH = 200;
const MAX_ANNOUNCEMENT_LENGTH = 4000;
const MAX_BOXES = 100;
const MAX_ENVELOPE_JSON_LENGTH = 32 * 1024;
const MAX_RUN_JSON_LENGTH = 8 * 1024;

/**
 * 校验任务结果信封（TaskAnalysisResult）。返回 { ok, error?, envelope? }。
 * 宽松校验：结构必须是任务信封（type/taskId/location/capturedAt/result/boxes），
 * result.task 必须等于 taskId，announcement 必须为字符串。
 */
export function validateTaskEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: '负载必须是 JSON 对象' };
  }
  if (payload.type !== 'task') {
    return { ok: false, error: "type 必须为 'task'" };
  }
  if (!COMPETITION_TASK_IDS.includes(payload.taskId)) {
    return { ok: false, error: `未知 taskId：${String(payload.taskId)}` };
  }
  if (typeof payload.location !== 'string' || !payload.location) {
    return { ok: false, error: 'location 必须为非空字符串' };
  }
  if (payload.location.length > MAX_LOCATION_LENGTH) {
    return { ok: false, error: `location 长度不能超过 ${MAX_LOCATION_LENGTH}` };
  }
  if (!Number.isFinite(payload.capturedAt)) {
    return { ok: false, error: 'capturedAt 必须为数字时间戳' };
  }
  const result = payload.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { ok: false, error: 'result 必须为对象' };
  }
  if (result.task !== payload.taskId) {
    return { ok: false, error: 'result.task 必须与 taskId 一致' };
  }
  if (typeof result.announcement !== 'string') {
    return { ok: false, error: 'result.announcement 必须为字符串' };
  }
  if (result.announcement.length > MAX_ANNOUNCEMENT_LENGTH) {
    return { ok: false, error: `announcement 长度不能超过 ${MAX_ANNOUNCEMENT_LENGTH}` };
  }
  if (payload.boxes !== undefined) {
    if (!Array.isArray(payload.boxes)) {
      return { ok: false, error: 'boxes 必须为数组' };
    }
    if (payload.boxes.length > MAX_BOXES) {
      return { ok: false, error: `boxes 数量不能超过 ${MAX_BOXES}` };
    }
  }
  if (JSON.stringify(payload).length > MAX_ENVELOPE_JSON_LENGTH) {
    return { ok: false, error: '信封负载超过大小限制' };
  }
  return { ok: true, envelope: payload };
}

/** 校验运行事件（type='run'，status: running|done）。 */
export function validateRunEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: '负载必须是 JSON 对象' };
  }
  if (payload.type !== 'run') {
    return { ok: false, error: "type 必须为 'run'" };
  }
  if (!KNOWN_RUN_STATUSES.has(payload.status)) {
    return { ok: false, error: `status 必须为 ${[...KNOWN_RUN_STATUSES].join('|')}` };
  }
  if (JSON.stringify(payload).length > MAX_RUN_JSON_LENGTH) {
    return { ok: false, error: '运行事件负载超过大小限制' };
  }
  return { ok: true, event: payload };
}

export function createTasksIngestRouter({ maxResults = 200 } = {}) {
  const router = Router();
  // qwenProxy 的 JSON 解析只作用于 chat 路由，这里自带解析器保持路由自包含
  const jsonParser = express.json({ limit: '1mb' });
  /** 最新结果在前；条目 = {...envelope, receivedAt} */
  const state = { results: [], run: null };

  router.post('/ingest', jsonParser, (req, res) => {
    const payload = req.body;
    if (payload && payload.type === 'run') {
      const checked = validateRunEvent(payload);
      if (!checked.ok) return res.status(400).json({ ok: false, error: checked.error });
      state.run = { ...checked.event, receivedAt: Date.now() };
      return res.json({ ok: true, stored: 'run' });
    }
    const checked = validateTaskEnvelope(payload);
    if (!checked.ok) return res.status(400).json({ ok: false, error: checked.error });
    state.results.unshift({ ...checked.envelope, receivedAt: Date.now() });
    if (state.results.length > maxResults) state.results.length = maxResults;
    return res.json({ ok: true, stored: 'task' });
  });

  router.get('/results', (req, res) => {
    const since = Number(req.query.since);
    const items = Number.isFinite(since)
      ? state.results.filter((item) => item.receivedAt > since)
      : state.results;
    res.json({ ok: true, count: items.length, results: items });
  });

  router.get('/results/:taskId', (req, res) => {
    const item = state.results.find((entry) => entry.taskId === req.params.taskId);
    if (!item) return res.status(404).json({ ok: false, error: '暂无该任务结果' });
    res.json({ ok: true, result: item });
  });

  router.get('/run', (_req, res) => {
    res.json({ ok: true, run: state.run });
  });

  return router;
}
