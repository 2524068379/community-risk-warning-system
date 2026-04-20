export {};

declare global {
  interface BaiduMapPoint {
    lng: number;
    lat: number;
  }

  interface BaiduMapInstance {
    centerAndZoom(point: BaiduMapPoint, zoom: number): void;
    setMapType?(mapType: unknown): void;
    setMapStyleV2?(style: { styleId: string }): void;
    disableDragging?(): void;
    disableScrollWheelZoom?(): void;
    disableDoubleClickZoom?(): void;
    enableScrollWheelZoom(): void;
    addControl(control: unknown): void;
    checkResize?(): void;
    clearOverlays(): void;
    addOverlay(overlay: unknown): void;
    openInfoWindow(infoWindow: unknown, point: BaiduMapPoint): void;
    panTo(point: BaiduMapPoint): void;
    getCenter?(): BaiduMapPoint;
    getZoom?(): number;
  }

  interface BaiduMapMarker {
    addEventListener(type: string, listener: () => void): void;
  }

  interface BaiduMapLabel extends BaiduMapMarker {
    setStyle(style: Record<string, string>): void;
  }

  interface BaiduMapNamespace {
    Map: new (container: HTMLElement) => BaiduMapInstance;
    Point: new (lng: number, lat: number) => BaiduMapPoint;
    Size: new (width: number, height: number) => unknown;
    Icon: new (imageUrl: string, size: unknown) => unknown;
    Marker: new (point: BaiduMapPoint, options: { icon: unknown }) => BaiduMapMarker;
    Label: new (content: string, options: { position: BaiduMapPoint; offset: unknown }) => BaiduMapLabel;
    InfoWindow: new (content: string, options: { width: number; title: string }) => unknown;
    ScaleControl: new () => unknown;
    ZoomControl: new () => unknown;
  }

  interface Window {
    BMapGL?: BaiduMapNamespace;
    BMAP_NORMAL_MAP?: unknown;
    BMAP_EARTH_MAP?: unknown;
    __baiduMapSdkInit__?: () => void;
  }
}
