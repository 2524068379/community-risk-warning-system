import { Alert, Button, Input, Segmented, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { CameraPoint } from '@/types';
import { useBaiduMap } from '@/hooks/useBaiduMap';
import { useCameraMarkers } from '@/hooks/useCameraMarkers';
import { filterCamerasByKeyword } from '@/utils/cameraFilter';
import { riskColorMap } from '@/utils/risk';

interface CameraMapPanelProps {
  cameras: CameraPoint[];
  activeCameraId: string;
  onSelect: (cameraId: string) => void;
  mode?: 'interactive' | 'display';
}

const mapAk = (import.meta.env.VITE_BAIDU_MAP_AK || '').trim();
const mapStyleId = import.meta.env.VITE_BAIDU_MAP_STYLE_ID;
const mapCenterLng = Number(import.meta.env.VITE_BAIDU_MAP_CENTER_LNG || 118.796877);
const mapCenterLat = Number(import.meta.env.VITE_BAIDU_MAP_CENTER_LAT || 32.060255);
const mapZoom = Number(import.meta.env.VITE_BAIDU_MAP_ZOOM || 16);

export function CameraMapPanel({
  cameras,
  activeCameraId,
  onSelect,
  mode = 'interactive'
}: CameraMapPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [mapType, setMapType] = useState<'标准路网' | '卫星图'>('标准路网');
  const isDisplayMode = mode === 'display';
  const isElectronRenderer = Boolean(window.electronAPI);

  const { containerRef, instance, ready: mapReady, error: mapError } = useBaiduMap({
    enabled: !isElectronRenderer,
    ak: mapAk,
    centerLng: mapCenterLng,
    centerLat: mapCenterLat,
    zoom: mapZoom,
    styleId: mapStyleId,
    interactive: !isDisplayMode,
    mapType
  });

  const filteredCameras = useMemo(
    () => filterCamerasByKeyword(cameras, keyword),
    [cameras, keyword]
  );

  const localMapPoints = useMemo(() => {
    const points = filteredCameras.filter((camera) => camera.mapPoint);
    const lngs = points.map((camera) => camera.mapPoint!.lng);
    const lats = points.map((camera) => camera.mapPoint!.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    return points.map((camera) => ({
      camera,
      left: maxLng === minLng ? 50 : 12 + ((camera.mapPoint!.lng - minLng) / (maxLng - minLng)) * 76,
      top: maxLat === minLat ? 50 : 12 + ((maxLat - camera.mapPoint!.lat) / (maxLat - minLat)) * 76
    }));
  }, [filteredCameras]);

  useCameraMarkers({
    map: instance,
    mapReady,
    cameras: filteredCameras,
    interactive: !isDisplayMode,
    onSelect,
    activeCameraId,
    allCameras: cameras
  });

  const handleSearch = () => {
    const matched = filteredCameras[0];
    if (matched) {
      onSelect(matched.id);
    }
  };

  return (
    <div className={`map-panel ${isDisplayMode ? 'display' : 'interactive'}`}>
      {!isDisplayMode ? (
        <>
          <div className="map-toolbar">
            <Input
              size="small"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              placeholder="搜索小区、街道或设备 ID"
              suffix={<Button size="small" type="link" onClick={handleSearch}>定位</Button>}
            />
            {!isElectronRenderer ? (
              <Segmented
                size="small"
                options={['标准路网', '卫星图']}
                value={mapType}
                onChange={(value) => setMapType(value as '标准路网' | '卫星图')}
              />
            ) : null}
          </div>

          <div className="map-tags-row">
            <Tag color="success" style={{ margin: 0 }}>
              {isElectronRenderer ? '本地安全点位图' : '百度地图 SDK'}
            </Tag>
            <Tag style={{ margin: 0 }}>点位数：{filteredCameras.length}</Tag>
            <Tag color="processing" style={{ margin: 0 }}>
              当前选中：{activeCameraId}
            </Tag>
          </div>
        </>
      ) : null}

      {!isElectronRenderer && mapError ? <Alert type="warning" showIcon message="地图配置提示" description={mapError} /> : null}

      <div className="map-stage baidu-map-stage">
        {isElectronRenderer ? (
          <div className="secure-local-map" aria-label="本地摄像头点位示意图">
            <div className="secure-local-map-grid" />
            {localMapPoints.map(({ camera, left, top }) => (
              <button
                type="button"
                key={camera.id}
                className={`secure-local-map-point ${camera.id === activeCameraId ? 'active' : ''}`}
                style={{ left: `${left}%`, top: `${top}%`, borderColor: riskColorMap[camera.level] }}
                onClick={() => onSelect(camera.id)}
                aria-pressed={camera.id === activeCameraId}
                aria-label={`${camera.name}，风险等级 ${camera.level}`}
              >
                <span style={{ background: riskColorMap[camera.level] }} />
                <strong>{camera.name}</strong>
              </button>
            ))}
            <div className="secure-local-map-note">Electron 安全模式 · 未加载第三方远程脚本</div>
          </div>
        ) : (
          <div ref={containerRef} className="baidu-map-container" />
        )}
      </div>
    </div>
  );
}
