const BAIDU_MAP_SCRIPT_SELECTOR = 'script[data-baidu-map-sdk="true"]';
const BAIDU_MAP_CALLBACK_NAME = '__baiduMapSdkInit__';
const BAIDU_MAP_LOAD_TIMEOUT = 15000;

let baiduMapLoadingPromise: Promise<any> | null = null;

function isMapNamespaceReady(BMapGL?: BaiduMapNamespace) {
  return Boolean(
    BMapGL &&
      typeof BMapGL.Map === 'function' &&
      typeof BMapGL.Point === 'function' &&
      typeof BMapGL.Marker === 'function'
  );
}

function getMapNamespace(): BaiduMapNamespace | null {
  if (!isMapNamespaceReady(window.BMapGL)) {
    return null;
  }

  return window.BMapGL ?? null;
}

function getAkConfigError(rawAk: string) {
  const ak = rawAk.trim();

  if (!ak) {
    return new Error('未配置可用的百度地图浏览器端 AK，请在 .env 中填写 VITE_BAIDU_MAP_AK。');
  }

  if (/请填写|百度地图浏览器端AK|your[_-\s]?baidu|your[_-\s]?ak/i.test(ak)) {
    return new Error('当前 VITE_BAIDU_MAP_AK 仍是占位文本，请替换为真实的百度地图浏览器端 AK。');
  }

  if (!/^[A-Za-z0-9_-]{10,}$/.test(ak)) {
    return new Error('VITE_BAIDU_MAP_AK 格式看起来无效，请填写真实的百度地图浏览器端 AK。');
  }

  return null;
}

function createSdkInitError() {
  return new Error(
    '百度地图 SDK 已返回但未完成初始化，请检查 VITE_BAIDU_MAP_AK 是否有效，并确认当前域名（如 http://localhost:5173）已加入百度地图控制台的 Referer 白名单。'
  );
}

function createSdkNetworkError() {
  return new Error('百度地图 SDK 加载失败，请检查网络连接后重试。');
}

function createSdkTimeoutError() {
  return new Error(
    '百度地图 SDK 加载超时，请检查网络连接，或确认 VITE_BAIDU_MAP_AK 与 Referer 白名单配置是否正确。'
  );
}

function clearSdkCallback() {
  delete window.__baiduMapSdkInit__;
}

export async function loadBaiduMapSdk(rawAk: string) {
  const akError = getAkConfigError(rawAk);
  if (akError) {
    throw akError;
  }

  if (getMapNamespace()) {
    return getMapNamespace();
  }

  if (baiduMapLoadingPromise) {
    return baiduMapLoadingPromise;
  }

  const ak = rawAk.trim();

  baiduMapLoadingPromise = new Promise((resolve, reject) => {
    const existedScript = document.querySelector<HTMLScriptElement>(BAIDU_MAP_SCRIPT_SELECTOR);
    const script = existedScript ?? document.createElement('script');
    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      script.removeEventListener('load', handleScriptLoad);
      script.removeEventListener('error', handleScriptError);
      clearSdkCallback();
    };

    const finalize = (handler: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler();
    };

    const handleSdkReady = () => {
      finalize(() => {
        const BMapGL = getMapNamespace();
        if (!BMapGL) {
          script.dataset.status = 'error';
          reject(createSdkInitError());
          return;
        }

        script.dataset.status = 'loaded';
        resolve(BMapGL);
      });
    };

    const handleScriptLoad = () => {
      if (getMapNamespace()) {
        handleSdkReady();
      }
    };

    const handleScriptError = () => {
      finalize(() => {
        script.dataset.status = 'error';
        reject(createSdkNetworkError());
      });
    };

    if (script.dataset.status === 'loaded') {
      handleSdkReady();
      return;
    }

    if (script.dataset.status === 'error') {
      reject(createSdkNetworkError());
      return;
    }

    window.__baiduMapSdkInit__ = handleSdkReady;

    script.addEventListener('load', handleScriptLoad, { once: true });
    script.addEventListener('error', handleScriptError, { once: true });

    timeoutId = window.setTimeout(() => {
      finalize(() => {
        script.dataset.status = 'error';

        if (getMapNamespace()) {
          resolve(getMapNamespace());
          return;
        }

        reject(createSdkTimeoutError());
      });
    }, BAIDU_MAP_LOAD_TIMEOUT);

    if (!existedScript) {
      script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${encodeURIComponent(ak)}&callback=${BAIDU_MAP_CALLBACK_NAME}`;
      script.async = true;
      script.defer = true;
      script.dataset.baiduMapSdk = 'true';
      script.dataset.status = 'loading';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    baiduMapLoadingPromise = null;
    throw error;
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
