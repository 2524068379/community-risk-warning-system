import type { DetectionResult } from '@/types'

type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error'

const ALLOWED_LABELS = new Set(['person', 'car', 'bicycle', 'motorcycle', 'dog'])
const DEFAULT_MIN_SCORE = 0.4

interface RawDetection {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export function filterDetections(
  detections: RawDetection[],
  allowedLabels: Set<string> = ALLOWED_LABELS,
  minScore: number = DEFAULT_MIN_SCORE
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
    } catch {
      status = 'error'
      return []
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
