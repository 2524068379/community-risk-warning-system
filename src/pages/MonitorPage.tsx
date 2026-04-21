import { useEffect, useRef, useState } from 'react';
import { Tag } from 'antd';
import { useLocalCamera } from '@/hooks/useLocalCamera';
import { useAppStore } from '@/store/useAppStore';
import { useVlmAnalysis } from '@/hooks/useVlmAnalysis';
import { riskColorMap, riskLevelTextMap } from '@/utils/risk';

export function MonitorPage() {
  const { stream, loading, error } = useLocalCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [timestamp, setTimestamp] = useState(() => new Date().toLocaleString());

  const { cameras, activeCameraId, setActiveCamera, vlmStatus, vlmError, detectionBoxes } = useAppStore();
  const activeCamera = cameras.find((c) => c.id === activeCameraId);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useVlmAnalysis({
    videoRef,
    cameraId: activeCamera?.id ?? 'LOCAL',
    scene: activeCamera?.scene ?? '本地摄像头',
    enabled: !!stream
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(new Date().toLocaleString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const statusText = vlmStatus === 'analyzing' ? '分析中'
    : vlmStatus === 'ready' ? 'VLM 在线'
    : vlmStatus === 'error' ? 'VLM 异常'
    : '等待连接';
  const statusColor = vlmStatus === 'ready' ? 'success'
    : vlmStatus === 'analyzing' ? 'processing'
    : vlmStatus === 'error' ? 'error'
    : 'default';

  return (
    <div className="monitor-layout">
      {/* 左栏：视频画面 */}
      <div className="panel monitor-video-col">
        <div className="monitor-video-toolbar">
          <div>
            <div className="monitor-video-toolbar-title">实时监控</div>
            <div className="monitor-video-toolbar-sub">
              {activeCamera?.name ?? '本地摄像头'} · {activeCamera?.area ?? ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Tag color={activeCamera?.status === 'online' ? 'success' : 'default'}>
              {activeCamera?.status === 'online' ? '在线' : '离线'}
            </Tag>
            <Tag color={statusColor} style={{ fontSize: 11 }}>{statusText}</Tag>
          </div>
        </div>

        <div className="monitor-video-stage">
          {loading && (
            <div className="monitor-video-loading">正在启动摄像头…</div>
          )}
          {error && (
            <div className="monitor-video-error">{error}</div>
          )}
          {stream && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="monitor-video-element"
            />
          )}
          {stream && (
            <div className="monitor-video-overlay">
              <span className="monitor-video-overlay-name">
                {activeCamera?.name ?? '本地摄像头'}
              </span>
              <span className="monitor-video-overlay-time">{timestamp}</span>
            </div>
          )}
          {vlmStatus === 'error' && vlmError && (
            <div style={{ position: 'absolute', bottom: 40, left: 8, right: 8, background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#f43f5e' }}>
              {vlmError}
            </div>
          )}
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
      </div>

      {/* 右栏：点位列表 */}
      <div className="panel monitor-list-col">
        <div className="panel-title">监控点位列表</div>
        <div className="monitor-camera-list">
          {cameras.map((camera) => (
            <div
              key={camera.id}
              className={`monitor-camera-item ${camera.id === activeCameraId ? 'active' : ''}`}
              onClick={() => setActiveCamera(camera.id)}
            >
              <div className="monitor-camera-info">
                <div className="monitor-camera-name">{camera.name}</div>
                <div className="monitor-camera-meta">
                  {camera.area} · {camera.scene}
                </div>
              </div>
              <Tag color={camera.status === 'online' ? 'success' : 'default'}>
                {camera.status === 'online' ? '在线' : '离线'}
              </Tag>
              <div className="monitor-camera-score">
                <span className="monitor-camera-score-value" style={{ color: riskColorMap[camera.level] }}>
                  {camera.riskScore}
                </span>
                <span className="monitor-camera-score-label">{riskLevelTextMap[camera.level]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
