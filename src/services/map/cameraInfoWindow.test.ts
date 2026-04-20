import { describe, expect, it } from 'vitest';
import { buildCameraInfoHtml } from './cameraInfoWindow';
import type { CameraPoint } from '@/types';

const camera: CameraPoint = {
  id: 'CAM-<001>',
  name: '<script>alert(1)</script>',
  area: 'A & B',
  riskScore: 86,
  level: 'high',
  status: 'online',
  todayEvents: 4,
  lastAlertTime: '2026-04-16 18:32:05',
  coordinates: [24, 30],
  mapPoint: { lng: 118.7935, lat: 32.0606 },
  streamCover: '入口',
  streamType: 'flv',
  scene: '主入口 "西"'
};

describe('buildCameraInfoHtml', () => {
  it('escapes camera fields before inserting them into the info window', () => {
    const html = buildCameraInfoHtml(camera);

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('CAM-&lt;001&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('主入口 &quot;西&quot;');
    expect(html).not.toContain('<script>');
  });
});
