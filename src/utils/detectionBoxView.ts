import type { CSSProperties } from 'react';
import type { DetectionBox } from '@/types';

export interface DetectionOverlayFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getDetectionBoxStyle(box: DetectionBox, frame?: DetectionOverlayFrame | null): CSSProperties {
  if (frame) {
    return {
      top: frame.top + box.y * frame.height,
      left: frame.left + box.x * frame.width,
      width: box.width * frame.width,
      height: box.height * frame.height
    };
  }

  return {
    top: `${box.y * 100}%`,
    left: `${box.x * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`
  };
}

export function getDetectionBoxClassName(box: DetectionBox): string {
  return `detection-box ${box.risk ? 'danger-box' : 'notice-box'}`;
}

export function formatDetectionBoxConfidence(box: DetectionBox): string {
  return `${Math.round(box.confidence * 100)}%`;
}
