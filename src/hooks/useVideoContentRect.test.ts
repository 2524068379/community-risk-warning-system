import { describe, expect, it } from 'vitest';
import { calculateContainedMediaRect } from './useVideoContentRect';

function rect(input: Partial<DOMRect>): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...input
  };
}

describe('calculateContainedMediaRect', () => {
  it('centers wide video content inside a taller display box', () => {
    expect(calculateContainedMediaRect(
      rect({ left: 0, top: 0, width: 400, height: 300 }),
      rect({ left: 0, top: 0, width: 400, height: 300 }),
      1920,
      1080
    )).toEqual({
      left: 0,
      top: 37.5,
      width: 400,
      height: 225
    });
  });

  it('accounts for nested video elements relative to the overlay container', () => {
    expect(calculateContainedMediaRect(
      rect({ left: 100, top: 50, width: 500, height: 400 }),
      rect({ left: 120, top: 90, width: 320, height: 240 }),
      640,
      480
    )).toEqual({
      left: 20,
      top: 40,
      width: 320,
      height: 240
    });
  });

  it('returns null for missing media dimensions', () => {
    expect(calculateContainedMediaRect(
      rect({ left: 0, top: 0, width: 400, height: 300 }),
      rect({ left: 0, top: 0, width: 400, height: 300 }),
      0,
      1080
    )).toBeNull();
  });
});
