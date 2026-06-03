import { describe, expect, it } from 'vitest'
import { filterDetections, parseDetectionLabels, parseDetectionMinScore } from './objectDetector'

const makeDet = (cls: string, score: number) => ({
  class: cls,
  score,
  bbox: [10, 20, 30, 40] as [number, number, number, number]
})

describe('filterDetections', () => {
  it('filters by score threshold and whitelist', () => {
    const detections = [
      makeDet('person', 0.8),
      makeDet('cat', 0.9),
      makeDet('car', 0.3),
      makeDet('bicycle', 0.6)
    ]
    const result = filterDetections(detections)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('person')
    expect(result[0].score).toBe(0.8)
    expect(result[1].label).toBe('bicycle')
  })

  it('respects custom minScore', () => {
    const detections = [makeDet('person', 0.5)]
    expect(filterDetections(detections, undefined, 0.6)).toHaveLength(0)
    expect(filterDetections(detections, undefined, 0.4)).toHaveLength(1)
  })

  it('respects custom allowed labels', () => {
    const detections = [
      makeDet('person', 0.8),
      makeDet('dog', 0.9)
    ]
    const onlyDog = new Set(['dog'])
    const result = filterDetections(detections, onlyDog)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('dog')
  })

  it('returns empty for empty input', () => {
    expect(filterDetections([])).toHaveLength(0)
  })

  it('maps bbox from input to output', () => {
    const det = { class: 'person', score: 0.9, bbox: [1, 2, 3, 4] as [number, number, number, number] }
    const result = filterDetections([det])
    expect(result[0].bbox).toEqual([1, 2, 3, 4])
  })
})

describe('parseDetectionLabels', () => {
  it('parses configured labels', () => {
    expect(Array.from(parseDetectionLabels('person,car,dog'))).toEqual(['person', 'car', 'dog'])
  })

  it('falls back to default labels when empty', () => {
    expect(parseDetectionLabels('').has('person')).toBe(true)
    expect(parseDetectionLabels(undefined).has('bicycle')).toBe(true)
    expect(parseDetectionLabels(undefined).has('truck')).toBe(true)
    expect(parseDetectionLabels(undefined).has('backpack')).toBe(true)
  })
})

describe('parseDetectionMinScore', () => {
  it('accepts scores between 0 and 1', () => {
    expect(parseDetectionMinScore('0.65')).toBe(0.65)
  })

  it('falls back when score is invalid', () => {
    expect(parseDetectionMinScore('2')).toBe(0.35)
    expect(parseDetectionMinScore('invalid')).toBe(0.35)
  })
})
