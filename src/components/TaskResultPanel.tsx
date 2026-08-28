/**
 * TaskResultPanel：比赛任务结果面板（D6 消费端）。
 * 展示巡检运行状态与 10 个任务的结构化结果/播报；无数据时渲染 null，
 * 不影响风险演示页面。
 */

import { Tag } from 'antd';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store/useAppStore';
import type { CompetitionTaskEnvelope } from '@/types/taskResults';

const TASK_DISPLAY_NAME: Record<string, string> = {
  traffic_light: '红绿灯状态',
  people_count: '人偶数量',
  sign_reading: '指示牌识别',
  trash_bin: '垃圾桶状态',
  building_fire: '楼宇火灾',
  building_temperature: '楼宇异常温度',
  gauge_reading: '站房仪表',
  license_plate: '车辆车牌',
  ebike_status: '电动车状态',
  parking: '泊车'
};

function resultValue(envelope: CompetitionTaskEnvelope): string {
  const r = envelope.result;
  switch (r.task) {
    case 'traffic_light':
      return `灯色 ${String(r.state)}`;
    case 'people_count':
      return `共 ${String(r.total)} 人（A 街 ${String(r.streetA)} / B 街 ${String(r.streetB)}）`;
    case 'sign_reading':
      return `类型 ${String(r.signType)}`;
    case 'trash_bin':
      return `${String(r.category)} · ${r.lidOpen ? '打开' : '关闭'} · 投放${r.correct ? '正确' : '错误'}`;
    case 'building_fire':
      return `隐患 ${String(r.fireHazards)} 个`;
    case 'building_temperature':
      return r.abnormal ? `${String(r.floor)} 楼高温` : '温度正常';
    case 'gauge_reading':
      return `${String(r.meterName)} ${String(r.reading)}`;
    case 'license_plate':
      return (Array.isArray(r.plates) ? r.plates : []).map(String).join('、') || '未识别';
    case 'ebike_status':
      return `违停 A${String(r.streetAIllegal)}/B${String(r.streetBIllegal)} · 正常 ${String(r.normal)} · 倒伏 ${String(r.tipped)}`;
    case 'parking':
      return r.parked ? (r.headingCorrect ? '已泊车，朝向正确' : '已泊车，朝向不正确') : '未泊车';
    default:
      return '—';
  }
}

export function TaskResultPanel() {
  const { taskResults, taskRun } = useAppStore(
    useShallow((state) => ({ taskResults: state.taskResults, taskRun: state.taskRun }))
  );

  const entries = Object.values(taskResults);
  if (entries.length === 0 && taskRun.status === 'idle') return null;

  return (
    <div className="panel task-result-panel" data-testid="task-result-panel">
      <div className="panel-title">
        巡检任务结果
        <Tag
          color={taskRun.status === 'running' ? 'processing' : taskRun.status === 'done' ? 'success' : 'default'}
          style={{ marginLeft: 8, fontSize: 11 }}
        >
          {taskRun.status === 'running' ? '巡检中' : taskRun.status === 'done' ? '已完成' : '待启动'}
        </Tag>
      </div>
      <div className="task-result-list">
        {entries.map((envelope) => (
          <div key={envelope.taskId} className="task-result-item">
            <div className="task-result-item-head">
              <span className="task-result-item-name">
                {TASK_DISPLAY_NAME[envelope.taskId] ?? envelope.taskId}
              </span>
              <span className="task-result-item-time">
                {new Date(envelope.capturedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="task-result-item-value">{resultValue(envelope)}</div>
            <div className="task-result-item-announce">{envelope.result.announcement}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
