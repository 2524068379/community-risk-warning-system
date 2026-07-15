import { Alert, Button, Input, Segmented, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { CameraPoint } from '@/types';
import { useBaiduMap } from '@/hooks/useBaiduMap';
import { useCameraMarkers } from '@/hooks/useCameraMarkers';
import { filterCamerasByKeyword } from '@/utils/cameraFilter';

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

  const { containerRef, instance, ready: mapReady, error: mapError } = useBaiduMap({
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
            <Segmented
              size="small"
              options={['标准路网', '卫星图']}
              value={mapType}
              onChange={(value) => setMapType(value as '标准路网' | '卫星图')}
            />
          </div>

          <div className="map-tags-row">
            <Tag color="success" style={{ margin: 0 }}>
              百度地图 SDK
            </Tag>
            <Tag style={{ margin: 0 }}>点位数：{filteredCameras.length}</Tag>
            <Tag color="processing" style={{ margin: 0 }}>
              当前选中：{activeCameraId}
            </Tag>
          </div>
        </>
      ) : null}

      {mapError ? <Alert type="warning" showIcon message="地图配置提示" description={mapError} /> : null}

      <div className="map-stage baidu-map-stage">
        <div ref={containerRef} className="baidu-map-container" />
      </div>
    </div>
  );
}
