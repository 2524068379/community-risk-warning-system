import { Button, Card, Col, Empty, Row, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { RiskEventDrawer } from '@/components/RiskEventDrawer';
import { useAppStore } from '@/store/useAppStore';
import { eventStatusTextMap } from '@/utils/risk';
import type { RiskEvent } from '@/types';

export function AlertsPage() {
  const { events, selectEvent, markEventStatus } = useAppStore();
  const [open, setOpen] = useState(false);
  const [currentEventId, setCurrentEventId] = useState<string>();

  const currentEvent = useMemo<RiskEvent | undefined>(
    () => events.find((item) => item.id === currentEventId),
    [events, currentEventId]
  );

  const handleOpen = (eventId: string) => {
    setCurrentEventId(eventId);
    selectEvent(eventId);
    setOpen(true);
  };

  return (
    <div className="page-container">
      <Row gutter={[16, 16]}>
        {events.length ? (
          events.map((event) => (
            <Col span={8} key={event.id}>
              <Card
                variant="borderless"
                className="event-card"
                title={event.title}
                extra={<Tag color={event.level === 'A' ? 'error' : event.level === 'B' ? 'warning' : 'processing'}>{event.level}级</Tag>}
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

                <Space className="event-action-row">
                  <Button onClick={() => handleOpen(event.id)}>处置</Button>
                  <Button type="primary" onClick={() => handleOpen(event.id)}>
                    查看详情
                  </Button>
                </Space>
              </Card>
            </Col>
          ))
        ) : (
          <Col span={24}>
            <Empty description="暂无高危事件" />
          </Col>
        )}
      </Row>

      <RiskEventDrawer
        open={open}
        event={currentEvent}
        onClose={() => setOpen(false)}
        onMarkDone={(eventId) => {
          markEventStatus(eventId, 'done');
          setOpen(false);
        }}
      />
    </div>
  );
}
