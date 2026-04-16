import { Badge, List, Tag } from 'antd';
import type { CameraPoint } from '@/types';
import { riskLevelTextMap } from '@/utils/risk';

interface CameraListPanelProps {
  cameras: CameraPoint[];
  activeCameraId: string;
  onSelect: (cameraId: string) => void;
}

export function CameraListPanel({ cameras, activeCameraId, onSelect }: CameraListPanelProps) {
  return (
    <List
      className="camera-list"
      dataSource={cameras}
      renderItem={(item) => (
        <List.Item
          className={`camera-list-item ${item.id === activeCameraId ? 'selected' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <List.Item.Meta
            title={
              <div className="camera-list-title">
                <span>{item.name}</span>
                <Tag color={item.status === 'online' ? 'success' : 'default'}>
                  {item.status === 'online' ? '在线' : '离线'}
                </Tag>
              </div>
            }
            description={`${item.area} · ${item.scene} · 最后告警 ${item.lastAlertTime}`}
          />
          <div className="camera-list-side">
            <Badge status={item.level === 'high' ? 'error' : item.level === 'medium' ? 'warning' : item.level === 'offline' ? 'default' : 'success'} text={riskLevelTextMap[item.level]} />
            <strong>{item.riskScore}</strong>
          </div>
        </List.Item>
      )}
    />
  );
}
