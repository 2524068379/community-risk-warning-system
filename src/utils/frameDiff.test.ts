import { describe, expect, it } from 'vitest'
import { computeFrameDiff, toGrayscale } from './frameDiff'

describe('toGrayscale', () => {
  it('converts RGBA pixel data to single-channel grayscale', () => {
    const rgba = new Uint8ClampedArray([100, 150, 200, 255])
    const gray = toGrayscale(rgba)
    expect(gray).toHaveLength(1)
    expect(gray[0]).toBe(Math.round(0.299 * 100 + 0.587 * 150 + 0.114 * 200))
  })

  it('converts multiple pixels', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255
    ])
    const gray = toGrayscale(rgba)
    expect(gray).toHaveLength(2)
    expect(gray[0]).toBe(255)
    expect(gray[1]).toBe(0)
  })
})

describe('computeFrameDiff', () => {
  it('returns 0 for identical frames', () => {
    const data = new Uint8ClampedArray([100, 100, 100])
    expect(computeFrameDiff(data, data)).toBe(0)
  })

  it('returns 1 for completely different frames with default threshold', () => {
    const a = new Uint8ClampedArray([0, 0, 0])
    const b = new Uint8ClampedArray([255, 255, 255])
    expect(computeFrameDiff(a, b)).toBe(1)
  })

  it('respects pixel threshold', () => {
    const a = new Uint8ClampedArray([100])
    const b = new Uint8ClampedArray([120])
    expect(computeFrameDiff(a, b, 30)).toBe(0)
    expect(computeFrameDiff(a, b, 15)).toBe(1)
  })

  it('returns 1 for mismatched lengths', () => {
    const a = new Uint8ClampedArray([100])
    const b = new Uint8ClampedArray([100, 200])
    expect(computeFrameDiff(a, b)).toBe(1)
  })

  it('computes partial change ratio', () => {
    const a = new Uint8ClampedArray([100, 100, 100, 100])
    const b = new Uint8ClampedArray([100, 200, 100, 200])
    expect(computeFrameDiff(a, b, 30)).toBe(0.5)
  })
})
