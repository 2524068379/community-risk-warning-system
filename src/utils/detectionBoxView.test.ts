import { describe, expect, it } from 'vitest';
import { formatDetectionBoxConfidence, getDetectionBoxClassName, getDetectionBoxStyle } from './detectionBoxView';
import type { DetectionBox } from '@/types';

const baseBox: DetectionBox = {
  x: 0.1,
  y: 0.2,
  width: 0.3,
  height: 0.4,
  label: 'person',
  confidence: 0.87,
  risk: true
};

describe('detectionBoxView', () => {
  it('keeps detection box percentage style unchanged', () => {
    expect(getDetectionBoxStyle(baseBox)).toEqual({
      top: '20%',
      left: '10%',
      width: '30%',
      height: '40%'
    });
  });

  it('maps detection boxes into a measured video content frame', () => {
    expect(getDetectionBoxStyle(baseBox, {
      left: 40,
      top: 0,
      width: 320,
      height: 240
    })).toEqual({
      top: 48,
      left: 72,
      width: 96,
      height: 96
    });
  });

  it('keeps class name selection unchanged', () => {
    expect(getDetectionBoxClassName({ ...baseBox, risk: true })).toBe('detection-box danger-box');
    expect(getDetectionBoxClassName({ ...baseBox, risk: false })).toBe('detection-box notice-box');
  });

  it('keeps confidence text formatting unchanged', () => {
    expect(formatDetectionBoxConfidence(baseBox)).toBe('87%');
  });
});
