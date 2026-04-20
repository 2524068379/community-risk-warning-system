import { useEffect, useRef, useState } from 'react';
import { loadBaiduMapSdk } from '@/services/map/baiduMap';

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

export interface UseBaiduMapOptions {
  ak: string;
  centerLng: number;
  centerLat: number;
  zoom: number;
  styleId?: string;
  interactive?: boolean;
  mapType?: '标准路网' | '卫星图';
}

export function useBaiduMap(options: UseBaiduMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<BaiduMapInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (!containerRef.current) return;

      try {
        setError(undefined);
        await waitForMapContainerReady(containerRef.current);

        const BMapGL = await loadBaiduMapSdk(options.ak);
        if (disposed || !containerRef.current) return;

        const map = new BMapGL.Map(containerRef.current);
        const point = new BMapGL.Point(options.centerLng, options.centerLat);
        map.centerAndZoom(point, options.zoom);

        if (window.BMAP_NORMAL_MAP) {
          map.setMapType(window.BMAP_NORMAL_MAP);
        }

        if (options.styleId) {
          map.setMapStyleV2?.({ styleId: options.styleId });
        }

        if (!options.interactive) {
          map.disableDragging?.();
          map.disableScrollWheelZoom?.();
          map.disableDoubleClickZoom?.();
        } else {
          map.enableScrollWheelZoom();
          map.addControl(new BMapGL.ScaleControl());
          map.addControl(new BMapGL.ZoomControl());
        }

        instanceRef.current = map;
        setReady(true);

        requestAnimationFrame(() => {
          map.checkResize?.();
          map.centerAndZoom(point, options.zoom);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '百度地图初始化失败');
      }
    }

    void initMap();

    return () => {
      disposed = true;
      instanceRef.current?.clearOverlays?.();
      instanceRef.current = null;
      setReady(false);
    };
  }, [options.ak, options.centerLng, options.centerLat, options.zoom, options.styleId, options.interactive]);

  useEffect(() => {
    const map = instanceRef.current;
    const element = containerRef.current;
    if (!ready || !map || !element || !('ResizeObserver' in window)) return;

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
  }, [ready]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!ready || !map) return;

    if (!options.interactive) {
      map.setMapType?.(window.BMAP_NORMAL_MAP);
      return;
    }

    if (options.mapType === '卫星图' && window.BMAP_EARTH_MAP) {
      map.setMapType?.(window.BMAP_EARTH_MAP);
    } else if (window.BMAP_NORMAL_MAP) {
      map.setMapType?.(window.BMAP_NORMAL_MAP);
    }
  }, [ready, options.interactive, options.mapType]);

  return { containerRef, instance: instanceRef.current, ready, error };
}
