import { Button, Empty, Space, Tag } from 'antd';
import type { RiskEvent } from '@/types';
import { VlmAnalysisPanel } from './VlmAnalysisPanel';
import { eventStatusTextMap } from '@/utils/risk';

interface RiskEventDetailPanelProps {
  event?: RiskEvent;
  onMarkDone: (eventId: string) => void;
}

export function RiskEventDetailPanel({ event, onMarkDone }: RiskEventDetailPanelProps) {
  if (!event) {
    return (
      <div className="event-detail-empty">
        <Empty description="请选择左侧事件查看详情" />
      </div>
    );
  }

  return (
    <div className="event-detail-panel">
      <div className="event-detail-hero">
        <div>
          <div className="event-detail-label">当前处置对象</div>
          <div className="event-detail-title">{event.title}</div>
          <div className="event-detail-subtitle">
            {event.cameraName} · {event.area} · {event.occurredAt}
          </div>
        </div>

        <Space size={6} wrap>
          <Tag color={event.level === 'A' ? 'error' : event.level === 'B' ? 'warning' : 'processing'}>
            {event.level}级
          </Tag>
          <Tag>{eventStatusTextMap[event.status]}</Tag>
          <Tag color="processing">风险分 {event.riskScore}</Tag>
        </Space>
      </div>

      <div className="event-detail-grid">
        <div className="snapshot-box event-snapshot-box">{event.snapshot}</div>

        <div className="event-brief-grid">
          <div className="brief-tile">
            <span>事件类型</span>
            <strong>{event.eventType}</strong>
          </div>
          <div className="brief-tile">
            <span>监控点位</span>
            <strong>{event.cameraName}</strong>
          </div>
          <div className="brief-tile">
            <span>发生时间</span>
            <strong>{event.occurredAt}</strong>
          </div>
          <div className="brief-tile">
            <span>状态</span>
            <strong>{eventStatusTextMap[event.status]}</strong>
          </div>
        </div>
      </div>

      <div className="event-summary-grid">
        <div className="detail-note-card">
          <span>事件摘要</span>
          <p>{event.summary}</p>
        </div>
        <div className="detail-note-card">
          <span>处置建议</span>
          <p>{event.suggestion}</p>
        </div>
      </div>

      <div className="event-tag-row detail-tag-row">
        {event.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>

      <div className="event-analysis-shell">
        <VlmAnalysisPanel analysis={event.analysis} compact />
      </div>

      <div className="drawer-footer">
        <Button size="small">生成证据包</Button>
        <Button size="small" type="primary">
          推送处置
        </Button>
        <Button size="small" onClick={() => onMarkDone(event.id)}>
          标记已处置
        </Button>
      </div>
    </div>
  );
}
