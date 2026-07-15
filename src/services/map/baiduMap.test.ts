import { describe, expect, it } from 'vitest';
import { buildBaiduMapSdkUrl } from './baiduMap';

describe('Baidu map SDK URL', () => {
  it('uses the HTTPS WebGL SDK in every renderer runtime', () => {
    expect(buildBaiduMapSdkUrl('desktop-ak')).toBe(
      'https://api.map.baidu.com/api?v=1.0&type=webgl&ak=desktop-ak&callback=__baiduMapSdkInit__'
    );
  });

  it('encodes the AK instead of allowing query-string injection', () => {
    expect(buildBaiduMapSdkUrl('ak&callback=attacker')).toContain(
      'ak=ak%26callback%3Dattacker&callback=__baiduMapSdkInit__'
    );
  });
});
