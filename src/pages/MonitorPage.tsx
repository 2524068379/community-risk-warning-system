import { Tag } from 'antd';
import { SectionCard } from '@/components/SectionCard';
import { CameraListPanel } from '@/components/CameraListPanel';
import { CameraMapPanel } from '@/components/CameraMapPanel';
import { VideoPanel } from '@/components/VideoPanel';
import { VlmAnalysisPanel } from '@/components/VlmAnalysisPanel';
import { useAppStore } from '@/store/useAppStore';

export function MonitorPage() {
  const { cameras, activeCameraId, analysis, setActiveCamera } = useAppStore();
  const activeCamera = cameras.find((item) => item.id === activeCameraId) ?? cameras[0];

  return (
    <div className="page-shell compact-page-shell">
      <div className="page-topbar">
        <div className="page-title-block">
          <div className="page-kicker">LIVE MONITOR MATRIX</div>
          <div className="page-title-row">
            <h2>监控点位切换中心</h2>
            <p>通过地图或点位矩阵单击切换当前监控对象，单屏查看实时视频与 VLM 分析结果。</p>
          </div>
        </div>

        <div className="page-actions">
          <Tag color="processing" style={{ margin: 0 }}>
            当前点位：{activeCamera.id}
          </Tag>
          <Tag color="success" style={{ margin: 0 }}>
            在线设备：{cameras.filter((item) => item.status === 'online').length}
          </Tag>
          <Tag color="warning" style={{ margin: 0 }}>
            今日事件：{activeCamera.todayEvents}
          </Tag>
        </div>
      </div>

      <div className="monitor-stage">
        <SectionCard className="section-fill" title="监控点位地图">
          <CameraMapPanel
            cameras={cameras}
            activeCameraId={activeCameraId}
            onSelect={setActiveCamera}
          />
        </SectionCard>

        <SectionCard className="section-fill" title="监控点位列表">
          <CameraListPanel
            cameras={cameras}
            activeCameraId={activeCameraId}
            onSelect={setActiveCamera}
          />
        </SectionCard>
        <SectionCard className="section-fill" title="单点实时监控详情">
          <VideoPanel camera={activeCamera} subtitle="点击地图或列表切换当前监控点位" />
        </SectionCard>

        <SectionCard className="section-fill" title="VLM 实时分析">
          <VlmAnalysisPanel analysis={analysis} compact />
        </SectionCard>
      </div>
    </div>
  );
}
