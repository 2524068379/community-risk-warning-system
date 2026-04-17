import { Alert, Button, Input, Segmented, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CameraPoint } from '@/types';
import { riskColorMap, riskLevelTextMap } from '@/utils/risk';
import { buildMarkerSvg, loadBaiduMapSdk } from '@/services/map/baiduMap';

interface CameraMapPanelProps {
  cameras: CameraPoint[];
  activeCameraId: string;
  onSelect: (cameraId: string) => void;
}

const mapAk = (import.meta.env.VITE_BAIDU_MAP_AK || '').trim();
const mapStyleId = import.meta.env.VITE_BAIDU_MAP_STYLE_ID;
const mapCenterLng = Number(import.meta.env.VITE_BAIDU_MAP_CENTER_LNG || 118.796877);
const mapCenterLat = Number(import.meta.env.VITE_BAIDU_MAP_CENTER_LAT || 32.060255);
const mapZoom = Number(import.meta.env.VITE_BAIDU_MAP_ZOOM || 16);
const MAP_READY_WAIT_TIMEOUT = 3000;

function waitForMapContainerReady(element: HTMLDivElement) {
  if (element.clientWidth > 0 && element.clientHeight > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;
    let observer: ResizeObserver | null = null;

    const finalize = () => {
      if (settled) return;
      settled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      observer?.disconnect();
      resolve();
    };

    timeoutId = window.setTimeout(finalize, MAP_READY_WAIT_TIMEOUT);

    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(() => {
        if (element.clientWidth > 0 && element.clientHeight > 0) {
          finalize();
        }
      });
      observer.observe(element);
      return;
    }

    const poll = () => {
      if (settled) return;

      if (element.clientWidth > 0 && element.clientHeight > 0) {
        finalize();
        return;
      }

      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  });
}

export function CameraMapPanel({ cameras, activeCameraId, onSelect }: CameraMapPanelProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [keyword, setKeyword] = useState('');
  const [mapType, setMapType] = useState<'标准路网' | '卫星图'>('标准路网');
  const [mapError, setMapError] = useState<string>();
  const [mapReady, setMapReady] = useState(false);

  const filteredCameras = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return cameras;

    return cameras.filter((camera) =>
      [camera.id, camera.name, camera.area, camera.scene].some((item) => item.toLowerCase().includes(value))
    );
  }, [cameras, keyword]);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (!mapRef.current) return;

      try {
        setMapError(undefined);
        await waitForMapContainerReady(mapRef.current);

        const BMapGL = await loadBaiduMapSdk(mapAk);
        if (disposed || !mapRef.current) return;

        const map = new BMapGL.Map(mapRef.current);
        const point = new BMapGL.Point(mapCenterLng, mapCenterLat);
        map.centerAndZoom(point, mapZoom);
        map.enableScrollWheelZoom();
        map.addControl(new BMapGL.ScaleControl());
        map.addControl(new BMapGL.ZoomControl());
        if (window.BMAP_NORMAL_MAP) {
          map.setMapType(window.BMAP_NORMAL_MAP);
        }
        if (mapStyleId) {
          map.setMapStyleV2?.({ styleId: mapStyleId });
        }

        instanceRef.current = map;
        setMapReady(true);

        requestAnimationFrame(() => {
          map.checkResize?.();
          map.centerAndZoom(point, mapZoom);
        });
      } catch (error) {
        setMapError(error instanceof Error ? error.message : '百度地图初始化失败');
      }
    }

    void initMap();

    return () => {
      disposed = true;
      instanceRef.current?.clearOverlays?.();
      markersRef.current.clear();
      instanceRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = instanceRef.current;
    const element = mapRef.current;
    if (!mapReady || !map || !element || !('ResizeObserver' in window)) return;

    const resizeMap = () => {
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();

      map.checkResize?.();

      if (center && typeof zoom === 'number') {
        map.centerAndZoom(center, zoom);
      }
    };

    const observer = new ResizeObserver(() => {
      resizeMap();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [mapReady]);

  useEffect(() => {
    const map = instanceRef.current;
    const BMapGL = window.BMapGL;
    if (!mapReady || !map || !BMapGL) return;

    map.clearOverlays();
    markersRef.current.clear();

    filteredCameras.forEach((camera) => {
      if (!camera.mapPoint) return;

      const point = new BMapGL.Point(camera.mapPoint.lng, camera.mapPoint.lat);
      const icon = new BMapGL.Icon(buildMarkerSvg(riskColorMap[camera.level]), new BMapGL.Size(28, 28));
      const marker = new BMapGL.Marker(point, { icon });
      const label = new BMapGL.Label(camera.name, {
        position: point,
        offset: new BMapGL.Size(18, -12)
      });

      label.setStyle({
        color: '#fff',
        background: 'rgba(7, 13, 24, 0.88)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '999px',
        padding: '4px 10px',
        fontSize: '12px'
      });

      const infoHtml = `
        <div style="min-width:220px;padding:4px 2px;line-height:1.8;">
          <div style="font-weight:700;font-size:15px;color:#0f172a;">${camera.name}</div>
          <div>设备 ID：${camera.id}</div>
          <div>区域：${camera.area} · ${camera.scene}</div>
          <div>今日风险事件：${camera.todayEvents}</div>
          <div>风险等级：${riskLevelTextMap[camera.level]}</div>
        </div>
      `;
      const infoWindow = new BMapGL.InfoWindow(infoHtml, { width: 260, title: '摄像头详情' });

      marker.addEventListener('click', () => {
        onSelect(camera.id);
        map.openInfoWindow(infoWindow, point);
      });
      label.addEventListener('click', () => {
        onSelect(camera.id);
        map.openInfoWindow(infoWindow, point);
      });

      map.addOverlay(marker);
      map.addOverlay(label);
      markersRef.current.set(camera.id, marker);
    });
  }, [filteredCameras, mapReady, onSelect]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!mapReady || !map) return;

    if (mapType === '卫星图' && window.BMAP_EARTH_MAP) {
      map.setMapType(window.BMAP_EARTH_MAP);
    } else if (window.BMAP_NORMAL_MAP) {
      map.setMapType(window.BMAP_NORMAL_MAP);
    }
  }, [mapReady, mapType]);

  useEffect(() => {
    const map = instanceRef.current;
    const BMapGL = window.BMapGL;
    const activeCamera = cameras.find((camera) => camera.id === activeCameraId);
    if (!mapReady || !map || !BMapGL || !activeCamera?.mapPoint) return;

    const activePoint = new BMapGL.Point(activeCamera.mapPoint.lng, activeCamera.mapPoint.lat);
    map.panTo(activePoint);
  }, [activeCameraId, cameras, mapReady]);

  const handleSearch = () => {
    const matched = filteredCameras[0];
    if (matched) {
      onSelect(matched.id);
    }
  };

  return (
    <div className="map-panel">
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

      {mapError ? <Alert type="warning" showIcon message="地图配置提示" description={mapError} /> : null}

      <div className="map-stage baidu-map-stage">
        <div ref={mapRef} className="baidu-map-container" />
      </div>
    </div>
  );
}
