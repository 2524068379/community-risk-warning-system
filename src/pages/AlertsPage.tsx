import { Card, Empty, Tag } from 'antd';
import { useMemo } from 'react';
import { RiskEventDetailPanel } from '@/components/RiskEventDetailPanel';
import { SectionCard } from '@/components/SectionCard';
import { useAppStore } from '@/store/useAppStore';
import { eventStatusTextMap } from '@/utils/risk';
import type { RiskEvent } from '@/types';

export function AlertsPage() {
  const { events, selectedEventId, selectEvent, markEventStatus } = useAppStore();

  const currentEvent = useMemo<RiskEvent | undefined>(
    () => events.find((item) => item.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  const handleSelect = (eventId: string) => {
    selectEvent(eventId);
  };

  return (
    <div className="page-shell compact-page-shell">
      <div className="page-topbar">
        <div className="page-title-block">
          <div className="page-kicker">ALERT DISPATCH BOARD</div>
          <div className="page-title-row">
            <h2>重点预警处置面板</h2>
            <p>左侧按风险等级快速切换事件，右侧固定展示证据、摘要、处置建议与 VLM 研判详情。</p>
          </div>
        </div>

        <div className="page-actions">
          <Tag color="error" style={{ margin: 0 }}>
            A级事件：{events.filter((item) => item.level === 'A').length}
          </Tag>
          <Tag color="warning" style={{ margin: 0 }}>
            待处置：{events.filter((item) => item.status === 'pending').length}
          </Tag>
          <Tag color="processing" style={{ margin: 0 }}>
            当前事件：{currentEvent?.id ?? '暂无'}
          </Tag>
        </div>
      </div>

      {events.length ? (
        <div className="alerts-stage">
          <div className="alerts-board">
            {events.map((event) => (
              <Card
                key={event.id}
                variant="borderless"
                className={`event-card ${event.id === currentEvent?.id ? 'selected' : ''}`}
                title={event.title}
                extra={
                  <Tag color={event.level === 'A' ? 'error' : event.level === 'B' ? 'warning' : 'processing'}>
                    {event.level}级
                  </Tag>
                }
                onClick={() => handleSelect(event.id)}
              >
                <div className="event-score">{event.riskScore}</div>
                <div className="event-summary">{event.summary}</div>
                <div className="event-meta">{event.occurredAt}</div>
                <div className="event-meta">{event.cameraName}</div>
                <div className="event-tag-row">
                  {event.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
                <div className="event-status">状态：{eventStatusTextMap[event.status]}</div>
              </Card>
            ))}
          </div>

          <SectionCard className="section-fill" title="事件详情与处置">
            <RiskEventDetailPanel
              event={currentEvent}
              onMarkDone={(eventId) => markEventStatus(eventId, 'done')}
            />
          </SectionCard>
        </div>
      ) : (
        <div className="empty-panel">
          <Empty description="暂无高危事件" />
        </div>
      )}
    </div>
  );
}
