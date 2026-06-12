import type { DetectionResult } from '@/types'

type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error'

const DEFAULT_ALLOWED_LABELS = [
  'person',
  'car',
  'truck',
  'bus',
  'bicycle',
  'motorcycle',
  'dog',
  'backpack',
  'handbag',
  'suitcase',
  'chair',
  'couch',
  'bench',
  'potted plant'
]
const ALLOWED_LABELS = parseDetectionLabels(import.meta.env.VITE_DETECTION_LABELS)
const DEFAULT_MIN_SCORE = 0.35
const MIN_SCORE = parseDetectionMinScore(import.meta.env.VITE_DETECTION_MIN_SCORE)

interface RawDetection {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export class DetectorLoadError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    const message = cause instanceof Error && cause.message
      ? `Object detector failed to load: ${cause.message}`
      : 'Object detector failed to load'
    super(message)
    this.name = 'DetectorLoadError'
    this.cause = cause
  }
}

export function parseDetectionLabels(raw?: string): Set<string> {
  const labels = raw
    ?.split(',')
    .map((label) => label.trim())
    .filter(Boolean)

  return new Set(labels && labels.length > 0 ? labels : DEFAULT_ALLOWED_LABELS)
}

export function parseDetectionMinScore(raw?: string): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return DEFAULT_MIN_SCORE
  }

  return value
}

export function filterDetections(
  detections: RawDetection[],
  allowedLabels: Set<string> = ALLOWED_LABELS,
  minScore: number = MIN_SCORE
): DetectionResult[] {
  return detections
    .filter((d) => d.score >= minScore && allowedLabels.has(d.class))
    .map((d) => ({
      label: d.class,
      score: d.score,
      bbox: d.bbox
    }))
}

let model: import('@tensorflow-models/coco-ssd').ObjectDetection | null = null
let status: DetectorStatus = 'idle'
let unloadListenerAttached = false

export function getDetectorStatus(): DetectorStatus {
  return status
}

export async function detect(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult[]> {
  if (!model) {
    if (status === 'loading') return []
    status = 'loading'
    try {
      const [tf, cocoSsd] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('@tensorflow-models/coco-ssd')
      ])
      await tf.ready()
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
      status = 'ready'

      if (!unloadListenerAttached && typeof window !== 'undefined') {
        unloadListenerAttached = true
        window.addEventListener('beforeunload', disposeDetector)
      }
    } catch (err) {
      status = 'error'
      throw new DetectorLoadError(err)
    }
  }
  const predictions = await model.detect(source)
  return filterDetections(predictions as RawDetection[])
}

export function disposeDetector(): void {
  model?.dispose()
  model = null
  status = 'idle'
}
