import { Button, Space, Tag } from 'antd';
import { CameraPoint } from '@/types';
import { FullscreenOutlined, PictureOutlined } from '@ant-design/icons';
import { riskColorMap, riskLevelTextMap } from '@/utils/risk';
import { LiveVideoPlayer } from '@/components/player/LiveVideoPlayer';

interface VideoPanelProps {
  camera: CameraPoint;
  subtitle?: string;
}

export function VideoPanel({ camera, subtitle }: VideoPanelProps) {
  return (
    <div className="video-panel">
      <div className="video-toolbar">
        <div>
          <div className="video-title">{camera.name}</div>
          <div className="video-subtitle">{subtitle ?? `${camera.area} · ${camera.scene}`}</div>
        </div>
        <Space>
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
        <div className="detection-box danger-box">
          <span>疑似风险目标 92%</span>
        </div>
        <div className="detection-box notice-box">
          <span>重点区域</span>
        </div>
      </div>

      <div className="video-actions">
        <Button icon={<FullscreenOutlined />}>全屏查看</Button>
        <Button icon={<PictureOutlined />}>生成快照</Button>
      </div>
    </div>
  );
}
