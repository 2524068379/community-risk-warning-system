import { Button, Space, Tag } from 'antd';
import { MetricCard } from '@/components/MetricCard';
import { PageHeader } from '@/components/PageHeader';
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
    <div className="page-shell overview-page">
      <PageHeader
        kicker="COMMUNITY RISK COMMAND"
        title="风险总览指挥台"
        className="overview-topbar"
        titleRowClassName="overview-title-row"
        descriptionClassName="overview-intro"
        actionsClassName="overview-actions"
        actions={
          <>
          <Tag color="processing" style={{ margin: 0 }}>
            当前焦点：{activeCamera.name}
          </Tag>
          <Tag color="success" style={{ margin: 0 }}>
            在线点位：{cameras.filter((item) => item.status === 'online').length}
          </Tag>
          <Space size={8}>
            <Button size="small" type="primary">
              进入处置
            </Button>
          </Space>
          </>
        }
      />

      <div className="metrics-grid">
        {dashboardMetrics.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>

      <div className="overview-stage">
        <SectionCard className="section-fill section-emphasis" title="重点监控总览">
          <VideoPanel camera={activeCamera} subtitle="默认播放当前风险最高的监控点位" />
        </SectionCard>

        <div className="overview-side-stack">
          <SectionCard className="section-fill" title="GIS 联动与点位态势">
            <div className="overview-map-stack">
              <CameraMapPanel
                cameras={cameras}
                activeCameraId={activeCameraId}
                onSelect={setActiveCamera}
              />

              <div className="overview-camera-summary">
                <div className="camera-brief-label">当前点位</div>
                <div className="overview-camera-summary-row">
                  <strong>{activeCamera.name}</strong>
                  <span>{activeCamera.area} · {activeCamera.scene}</span>
                  <span>最新告警 {activeCamera.lastAlertTime.slice(11)}</span>
                  <span>{activeEvent?.title ?? '暂无高危事件'}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="section-fill" title="VLM 实时研判">
            <VlmAnalysisPanel analysis={analysis} variant="compact" />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
