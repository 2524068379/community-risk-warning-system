import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import {
  COMPETITION_TASK_IDS,
  createTasksIngestRouter,
  validateRunEvent,
  validateTaskEnvelope
} from './tasksIngest.js';

const servers = [];

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: data ? { 'content-type': 'application/json' } : {} },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

const validEnvelope = {
  type: 'task',
  taskId: 'traffic_light',
  location: 'traffic_light_zone',
  capturedAt: 1756370000000,
  result: { task: 'traffic_light', state: 'green', announcement: '前方交通灯为绿色，可以通行。' },
  boxes: []
};

describe('validateTaskEnvelope', () => {
  it('接受合法任务信封', () => {
    const checked = validateTaskEnvelope(validEnvelope);
    expect(checked.ok).toBe(true);
  });

  it('拒绝非对象/类型错误/taskId 白名单外', () => {
    expect(validateTaskEnvelope(null).ok).toBe(false);
    expect(validateTaskEnvelope([validEnvelope]).ok).toBe(false);
    expect(validateTaskEnvelope({ ...validEnvelope, type: 'risk' }).ok).toBe(false);
    expect(validateTaskEnvelope({ ...validEnvelope, taskId: 'unknown_task' }).ok).toBe(false);
  });

  it('拒绝 result.task 与 taskId 不一致 / 缺 announcement', () => {
    expect(validateTaskEnvelope({ ...validEnvelope, result: { task: 'people_count' } }).ok).toBe(false);
    expect(validateTaskEnvelope({ ...validEnvelope, result: { task: 'traffic_light' } }).ok).toBe(false);
    expect(validateTaskEnvelope({ ...validEnvelope, boxes: 'nope' }).ok).toBe(false);
  });

  it('拒绝超长字段与超限 boxes（内存放大防护）', () => {
    expect(validateTaskEnvelope({
      ...validEnvelope,
      location: 'x'.repeat(201)
    }).ok).toBe(false);
    expect(validateTaskEnvelope({
      ...validEnvelope,
      result: { ...validEnvelope.result, announcement: 'x'.repeat(4001) }
    }).ok).toBe(false);
    expect(validateTaskEnvelope({
      ...validEnvelope,
      boxes: Array.from({ length: 101 }, () => ({ x: 0, y: 0, width: 1, height: 1, label: 'a', confidence: 1 }))
    }).ok).toBe(false);
    expect(validateTaskEnvelope({
      ...validEnvelope,
      // 各字段本身合规，但任意额外字段把总负载顶破字节预算
      padding: 'x'.repeat(33 * 1024)
    }).ok).toBe(false);
  });
});

describe('validateRunEvent', () => {
  it('接受 running/done，拒绝其他 status', () => {
    expect(validateRunEvent({ type: 'run', status: 'running' }).ok).toBe(true);
    expect(validateRunEvent({ type: 'run', status: 'done', detail: [] }).ok).toBe(true);
    expect(validateRunEvent({ type: 'run', status: 'paused' }).ok).toBe(false);
    expect(validateRunEvent({ type: 'task' }).ok).toBe(false);
  });
});

describe('createTasksIngestRouter', () => {
  it('POST /ingest 存储信封并按 receivedAt 倒序返回', async () => {
    const port = await listen(express().use('/api/tasks', createTasksIngestRouter()));
    const post = await request(port, 'POST', '/api/tasks/ingest', validEnvelope);
    expect(post.status).toBe(200);
    expect(post.body).toEqual({ ok: true, stored: 'task' });

    await request(port, 'POST', '/api/tasks/ingest',
      { ...validEnvelope, taskId: 'people_count', result: { ...validEnvelope.result, task: 'people_count' } });

    const list = await request(port, 'GET', '/api/tasks/results');
    expect(list.body.count).toBe(2);
    expect(list.body.results[0].taskId).toBe('people_count');
    expect(typeof list.body.results[0].receivedAt).toBe('number');
  });

  it('since 过滤与单任务查询', async () => {
    const port = await listen(express().use('/api/tasks', createTasksIngestRouter()));
    await request(port, 'POST', '/api/tasks/ingest', validEnvelope);
    const before = Date.now() + 1;
    const list = await request(port, 'GET', `/api/tasks/results?since=${before}`);
    expect(list.body.count).toBe(0);
    const list2 = await request(port, 'GET', '/api/tasks/results?since=0');
    expect(list2.body.count).toBe(1);

    const one = await request(port, 'GET', '/api/tasks/results/traffic_light');
    expect(one.body.ok).toBe(true);
    expect(one.body.result.taskId).toBe('traffic_light');
    const missing = await request(port, 'GET', '/api/tasks/results/parking');
    expect(missing.status).toBe(404);
  });

  it('非法负载返回 400，run 事件存入 /run', async () => {
    const port = await listen(express().use('/api/tasks', createTasksIngestRouter()));
    const bad = await request(port, 'POST', '/api/tasks/ingest', { type: 'task', taskId: 'nope' });
    expect(bad.status).toBe(400);
    expect(bad.body.ok).toBe(false);

    await request(port, 'POST', '/api/tasks/ingest', { type: 'run', status: 'running', startedAt: 1 });
    const run = await request(port, 'GET', '/api/tasks/run');
    expect(run.body.run.status).toBe('running');
  });

  it('maxResults 截断缓存', async () => {
    const port = await listen(express().use('/api/tasks', createTasksIngestRouter({ maxResults: 3 })));
    for (let i = 0; i < 5; i++) {
      await request(port, 'POST', '/api/tasks/ingest',
        { ...validEnvelope, capturedAt: i, result: { ...validEnvelope.result } });
    }
    const list = await request(port, 'GET', '/api/tasks/results');
    expect(list.body.count).toBe(3);
  });

  it('taskId 白名单覆盖 10 个赛题任务', () => {
    expect(COMPETITION_TASK_IDS).toHaveLength(10);
    expect(COMPETITION_TASK_IDS).toContain('traffic_light');
    expect(COMPETITION_TASK_IDS).toContain('parking');
  });
});
