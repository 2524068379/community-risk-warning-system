import { useEffect, useRef, useState } from 'react';
import { Button, Tag } from 'antd';
import { useLocalCamera } from '@/hooks/useLocalCamera';
import { useAppStore } from '@/store/useAppStore';
import { useVlmAnalysis } from '@/hooks/useVlmAnalysis';
import { riskColorMap, riskLevelTextMap } from '@/utils/risk';
import { getVlmStatusView } from '@/utils/vlmStatusView';
import {
  formatDetectionBoxConfidence,
  getDetectionBoxClassName,
  getDetectionBoxStyle
} from '@/utils/detectionBoxView';

export function MonitorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, loading, error, retry } = useLocalCamera(videoRef);
  const [timestamp, setTimestamp] = useState(() => new Date().toLocaleString());

  const {
    cameras,
    activeCameraId,
    analysisContext,
    analysisFrameDataUrl,
    analysisValidity,
    setActiveCamera,
    vlmStatus,
    vlmError,
    detectionBoxes
  } = useAppStore();

  useVlmAnalysis({
    videoRef,
    cameraId: 'LOCAL',
    scene: '本地摄像头演示源',
    enabled: !!stream
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(new Date().toLocaleString());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const statusView = getVlmStatusView(vlmStatus, 'monitor');

  return (
    <div className="monitor-layout">
      {/* 左栏：视频画面 */}
      <div className="panel monitor-video-col">
        <div className="monitor-video-toolbar">
          <div>
            <div className="monitor-video-toolbar-title">实时监控</div>
            <div className="monitor-video-toolbar-sub">
              本地摄像头 · 演示源（点位选择不会改变视频来源）
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Tag color={stream ? 'success' : 'default'}>{stream ? '摄像头在线' : '摄像头离线'}</Tag>
            <Tag color={statusView.color} style={{ fontSize: 11 }}>{statusView.text}</Tag>
            {analysisContext?.modelSource && analysisContext.modelSource !== 'unknown' ? (
              <Tag color={analysisContext.modelSource === 'local' ? 'processing' : 'warning'}>
                {analysisContext.modelSource === 'local' ? '本地模型' : '云端模型'}
              </Tag>
            ) : null}
          </div>
        </div>

        <div className="monitor-video-stage">
          {loading && (
            <div className="monitor-video-loading">正在启动摄像头…</div>
          )}
          {error && (
            <div className="monitor-video-error">
              <span>{error}</span>
              <Button size="small" onClick={retry}>重试摄像头</Button>
            </div>
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
                本地摄像头 · LOCAL
              </span>
              <span className="monitor-video-overlay-time">{timestamp}</span>
            </div>
          )}
          {(vlmStatus === 'error' || vlmStatus === 'response-error') && vlmError && (
            <div style={{ position: 'absolute', bottom: 40, left: 8, right: 8, background: vlmStatus === 'response-error' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)', border: `1px solid ${vlmStatus === 'response-error' ? 'rgba(245,158,11,0.3)' : 'rgba(244,63,94,0.3)'}`, borderRadius: 4, padding: '4px 8px', fontSize: 11, color: vlmStatus === 'response-error' ? '#f59e0b' : '#f43f5e' }}>
              {vlmError}
            </div>
          )}
          {analysisValidity === 'valid' && analysisFrameDataUrl ? (
            <div className="monitor-analysis-snapshot" aria-label="VLM 抓拍证据">
              <div className="monitor-analysis-snapshot-title">
                VLM 抓拍 · {analysisContext
                  ? new Date(analysisContext.capturedAt).toLocaleTimeString()
                  : '时间未知'}
              </div>
              <div className="monitor-analysis-snapshot-frame">
                <img src={analysisFrameDataUrl} alt="用于本次 VLM 分析的摄像头抓拍帧" />
                {detectionBoxes.map((box, i) => (
                  <div
                    key={`${box.label}-${i}`}
                    className={getDetectionBoxClassName(box)}
                    style={getDetectionBoxStyle(box)}
                  >
                    <span>{box.label} {formatDetectionBoxConfidence(box)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 右栏：点位列表 */}
      <div className="panel monitor-list-col">
        <div className="panel-title">模拟点位列表</div>
        <div className="monitor-camera-list">
          {cameras.map((camera) => (
            <button
              type="button"
              key={camera.id}
              className={`monitor-camera-item ${camera.id === activeCameraId ? 'active' : ''}`}
              onClick={() => setActiveCamera(camera.id)}
              aria-pressed={camera.id === activeCameraId}
              aria-label={`选择模拟点位 ${camera.name}`}
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
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
