import { Space, Tag } from 'antd';
import type { CameraPoint } from '@/types';
import { riskColorMap, riskLevelTextMap } from '@/utils/risk';
import { LiveVideoPlayer } from '@/components/player/LiveVideoPlayer';
import { useAppStore } from '@/store/useAppStore';

interface VideoPanelProps {
  camera: CameraPoint;
  subtitle?: string;
  density?: 'default' | 'compact';
  showInfoStrip?: boolean;
}

export function VideoPanel({
  camera,
  subtitle,
  density = 'default',
  showInfoStrip
}: VideoPanelProps) {
  const isCompact = density === 'compact';
  const shouldShowInfoStrip = showInfoStrip ?? !isCompact;
  const detectionBoxes = useAppStore((s) => s.detectionBoxes);

  return (
    <div className={`video-panel ${isCompact ? 'compact' : ''} ${shouldShowInfoStrip ? '' : 'condensed'}`}>
      <div className="video-toolbar">
        <div>
          <div className="video-title">{camera.name}</div>
          <div className="video-subtitle">{subtitle ?? `${camera.area} · ${camera.scene}`}</div>
        </div>
        <Space size={4}>
          <Tag color={camera.status === 'online' ? 'success' : 'default'}>
            {camera.status === 'online' ? '实时在线' : '设备离线'}
          </Tag>
          <Tag color={riskColorMap[camera.level]}>{riskLevelTextMap[camera.level]}</Tag>
        </Space>
      </div>

      <div className="video-frame real-video-frame">
        <LiveVideoPlayer
          url={camera.streamUrl}
          type={camera.streamType}
          posterText={`当前点位：${camera.streamCover}。后续可替换为真实 ${String(camera.streamType || 'flv').toUpperCase()} 实时流。`}
        />
        {detectionBoxes.map((box, i) => (
          <div
            key={i}
            className={`detection-box ${box.risk ? 'danger-box' : 'notice-box'}`}
            style={{
              top: `${box.y * 100}%`,
              left: `${box.x * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`
            }}
          >
            <span>{box.label} {Math.round(box.confidence * 100)}%</span>
          </div>
        ))}
      </div>

      {shouldShowInfoStrip ? (
        <div className="video-info-strip">
          <div className="video-info-pill">
            <span>所属分区</span>
            <strong>{camera.area}</strong>
          </div>
          <div className="video-info-pill">
            <span>场景类型</span>
            <strong>{camera.scene}</strong>
          </div>
          <div className="video-info-pill">
            <span>今日事件</span>
            <strong>{camera.todayEvents}</strong>
          </div>
          <div className="video-info-pill">
            <span>最近告警</span>
            <strong>{camera.lastAlertTime.slice(11)}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
