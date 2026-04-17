import { Badge, Tag } from 'antd';
import type { CameraPoint } from '@/types';
import { riskLevelTextMap } from '@/utils/risk';

interface CameraListPanelProps {
  cameras: CameraPoint[];
  activeCameraId: string;
  onSelect: (cameraId: string) => void;
}

export function CameraListPanel({ cameras, activeCameraId, onSelect }: CameraListPanelProps) {
  return (
    <div className="camera-list-wrap">
      <div className="camera-card-grid">
        {cameras.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`camera-card ${item.id === activeCameraId ? 'selected' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <div className="camera-card-header">
              <div className="camera-list-title">
                <span>{item.name}</span>
                <Tag
                  color={item.status === 'online' ? 'success' : 'default'}
                  style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}
                >
                  {item.status === 'online' ? '在线' : '离线'}
                </Tag>
              </div>
              <strong className="camera-card-score">{item.riskScore}</strong>
            </div>

            <div className="camera-card-meta">
              <span>{item.area}</span>
              <span>{item.scene}</span>
            </div>

            <div className="camera-card-footer">
              <Badge
                status={
                  item.level === 'high'
                    ? 'error'
                    : item.level === 'medium'
                      ? 'warning'
                      : item.level === 'offline'
                        ? 'default'
                        : 'success'
                }
                text={<span className="camera-badge-text">{riskLevelTextMap[item.level]}</span>}
              />
              <span className="camera-card-footnote">今日事件 {item.todayEvents}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
