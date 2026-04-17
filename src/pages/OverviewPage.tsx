import { Button, Space, Tag } from 'antd';
import { MetricCard } from '@/components/MetricCard';
import { SectionCard } from '@/components/SectionCard';
import { VideoPanel } from '@/components/VideoPanel';
import { VlmAnalysisPanel } from '@/components/VlmAnalysisPanel';
import { CameraMapPanel } from '@/components/CameraMapPanel';
import { dashboardMetrics } from '@/data/mock';
import { useAppStore } from '@/store/useAppStore';

export function OverviewPage() {
  const { cameras, activeCameraId, analysis, events, setActiveCamera } = useAppStore();
  const activeCamera = cameras.find((item) => item.id === activeCameraId) ?? cameras[0];
  const activeEvent = events.find((item) => item.cameraId === activeCamera.id);

  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-title-block">
          <div className="page-kicker">COMMUNITY RISK COMMAND</div>
          <div className="page-title-row">
            <h2>风险总览指挥台</h2>
            <p>聚焦当前高风险点位、模型研判结果与 GIS 联动状态，面向大屏值守场景优化展示。</p>
          </div>
        </div>

        <div className="page-actions">
          <Tag color="processing" style={{ margin: 0 }}>
            当前焦点：{activeCamera.name}
          </Tag>
          <Tag color="success" style={{ margin: 0 }}>
            在线点位：{cameras.filter((item) => item.status === 'online').length}
          </Tag>
          <Space size={8}>
            <Button size="small">生成快照</Button>
            <Button size="small" type="primary">
              进入处置
            </Button>
          </Space>
        </div>
      </div>

      <div className="metrics-grid">
        {dashboardMetrics.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>

      <div className="overview-stage">
        <SectionCard className="section-fill section-emphasis" title="重点监控总览">
          <VideoPanel camera={activeCamera} subtitle="默认播放当前风险最高的监控点位" />
        </SectionCard>

        <SectionCard className="section-fill" title="VLM 实时研判">
          <VlmAnalysisPanel analysis={analysis} />
        </SectionCard>

        <SectionCard className="section-fill" title="GIS 联动与点位态势">
          <div className="overview-map-stack">
            <CameraMapPanel
              cameras={cameras}
              activeCameraId={activeCameraId}
              onSelect={setActiveCamera}
            />

            <div className="camera-brief-card">
              <div className="camera-brief-header">
                <div>
                  <div className="camera-brief-label">当前点位</div>
                  <div className="camera-brief-title">{activeCamera.name}</div>
                </div>
                <Tag color="warning" style={{ margin: 0 }}>
                  今日事件 {activeCamera.todayEvents}
                </Tag>
              </div>

              <div className="camera-brief-grid">
                <div className="brief-tile">
                  <span>设备编号</span>
                  <strong>{activeCamera.id}</strong>
                </div>
                <div className="brief-tile">
                  <span>区域 / 场景</span>
                  <strong>{activeCamera.area} · {activeCamera.scene}</strong>
                </div>
                <div className="brief-tile">
                  <span>最新告警</span>
                  <strong>{activeCamera.lastAlertTime}</strong>
                </div>
                <div className="brief-tile">
                  <span>重点事件</span>
                  <strong>{activeEvent?.title ?? '暂无高危事件'}</strong>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
