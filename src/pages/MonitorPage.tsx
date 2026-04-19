import { Segmented, Tag } from 'antd';
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { CameraListPanel } from '@/components/CameraListPanel';
import { CameraMapPanel } from '@/components/CameraMapPanel';
import { VideoPanel } from '@/components/VideoPanel';
import { useAppStore } from '@/store/useAppStore';

export function MonitorPage() {
  const { cameras, activeCameraId, setActiveCamera } = useAppStore();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const activeCamera = cameras.find((item) => item.id === activeCameraId) ?? cameras[0];

  return (
    <div className="page-shell compact-page-shell monitor-page">
      <PageHeader
        kicker="LIVE MONITOR MATRIX"
        title="监控点位切换中心"
        description="通过地图或点位矩阵单击切换当前监控对象，单屏查看实时视频。"
        actions={
          <>
          <Tag color="processing" style={{ margin: 0 }}>
            当前点位：{activeCamera.id}
          </Tag>
          <Tag color="success" style={{ margin: 0 }}>
            在线设备：{cameras.filter((item) => item.status === 'online').length}
          </Tag>
          <Tag color="warning" style={{ margin: 0 }}>
            今日事件：{activeCamera.todayEvents}
          </Tag>
          </>
        }
      />

      <div className="monitor-stage">
        <SectionCard
          className="section-fill"
          title="监控选择区"
          extra={
            <Segmented
              size="small"
              value={viewMode}
              options={[
                { label: '地图定位', value: 'map' },
                { label: '设备列表', value: 'list' }
              ]}
              onChange={(value) => setViewMode(value as 'map' | 'list')}
            />
          }
        >
          {viewMode === 'map' ? (
            <CameraMapPanel
              cameras={cameras}
              activeCameraId={activeCameraId}
              onSelect={setActiveCamera}
            />
          ) : (
            <CameraListPanel
              cameras={cameras}
              activeCameraId={activeCameraId}
              onSelect={setActiveCamera}
            />
          )}
        </SectionCard>

        <SectionCard className="section-fill" title="单点实时监控详情">
          <VideoPanel
            camera={activeCamera}
            subtitle="点击地图或列表切换当前监控点位"
            density="compact"
          />
        </SectionCard>
      </div>
    </div>
  );
}
