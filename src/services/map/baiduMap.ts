declare global {
  interface Window {
    BMapGL: any;
    BMAP_NORMAL_MAP: any;
    BMAP_SATELLITE_MAP: any;
  }
}

let baiduMapLoadingPromise: Promise<any> | null = null;

export async function loadBaiduMapSdk(ak: string) {
  if (!ak) {
    throw new Error('未配置 VITE_BAIDU_MAP_AK');
  }

  if (window.BMapGL) {
    return window.BMapGL;
  }

  if (baiduMapLoadingPromise) {
    return baiduMapLoadingPromise;
  }

  baiduMapLoadingPromise = new Promise((resolve, reject) => {
    const existedScript = document.querySelector<HTMLScriptElement>('script[data-baidu-map-sdk="true"]');
    if (existedScript) {
      existedScript.addEventListener('load', () => resolve(window.BMapGL));
      existedScript.addEventListener('error', () => reject(new Error('百度地图 SDK 加载失败')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${encodeURIComponent(ak)}`;
    script.async = true;
    script.defer = true;
    script.dataset.baiduMapSdk = 'true';
    script.onload = () => resolve(window.BMapGL);
    script.onerror = () => reject(new Error('百度地图 SDK 加载失败'));
    document.body.appendChild(script);
  });

  return baiduMapLoadingPromise;
}

export function buildMarkerSvg(color: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="7" fill="${color}" stroke="white" stroke-width="2" />
      <circle cx="14" cy="14" r="12" fill="${color}" opacity="0.16" />
    </svg>
  `)}`;
}
