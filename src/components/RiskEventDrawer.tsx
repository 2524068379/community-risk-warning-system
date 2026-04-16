import { Button, Descriptions, Drawer, Space, Tag } from 'antd';
import type { RiskEvent } from '@/types';
import { VlmAnalysisPanel } from './VlmAnalysisPanel';
import { eventStatusTextMap } from '@/utils/risk';

interface RiskEventDrawerProps {
  open: boolean;
  event?: RiskEvent;
  onClose: () => void;
  onMarkDone: (eventId: string) => void;
}

export function RiskEventDrawer({ open, event, onClose, onMarkDone }: RiskEventDrawerProps) {
  return (
    <Drawer
      title={event?.title ?? '事件详情'}
      open={open}
      onClose={onClose}
      width={620}
      extra={
        event ? (
          <Space>
            <Tag color={event.level === 'A' ? 'error' : event.level === 'B' ? 'warning' : 'processing'}>
              {event.level}级
            </Tag>
            <Tag>{eventStatusTextMap[event.status]}</Tag>
          </Space>
        ) : null
      }
    >
      {event ? (
        <div className="drawer-body">
          <div className="snapshot-box">{event.snapshot}</div>

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="事件类型">{event.eventType}</Descriptions.Item>
            <Descriptions.Item label="发生时间">{event.occurredAt}</Descriptions.Item>
            <Descriptions.Item label="监控点位">{event.cameraName}</Descriptions.Item>
            <Descriptions.Item label="区域">{event.area}</Descriptions.Item>
            <Descriptions.Item label="事件摘要">{event.summary}</Descriptions.Item>
            <Descriptions.Item label="处置建议">{event.suggestion}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            <VlmAnalysisPanel analysis={event.analysis} compact />
          </div>

          <div className="drawer-footer">
            <Button>生成证据包</Button>
            <Button type="primary">推送处置</Button>
            <Button onClick={() => onMarkDone(event.id)}>标记已处置</Button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
