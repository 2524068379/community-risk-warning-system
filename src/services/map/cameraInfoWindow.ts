import type { CameraPoint } from '@/types';
import { riskLevelTextMap } from '@/utils/risk';
import { escapeHtml } from '@/utils/escapeHtml';

export function buildCameraInfoHtml(camera: CameraPoint) {
  return `
    <div style="min-width:220px;padding:4px 2px;line-height:1.8;">
      <div style="font-weight:700;font-size:15px;color:#0f172a;">${escapeHtml(camera.name)}</div>
      <div>设备 ID：${escapeHtml(camera.id)}</div>
      <div>区域：${escapeHtml(camera.area)} · ${escapeHtml(camera.scene)}</div>
      <div>今日风险事件：${escapeHtml(camera.todayEvents)}</div>
      <div>风险等级：${escapeHtml(riskLevelTextMap[camera.level])}</div>
    </div>
  `;
}
