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
const MODEL_URL = parseDetectionModelUrl(import.meta.env.VITE_DETECTION_MODEL_URL)
const MAX_DETECTION_BOXES = 20

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

export function parseDetectionModelUrl(raw?: string): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined

  if (/^(https?:\/\/|\/|\.\/)/i.test(value)) {
    return value
  }

  return undefined
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

/**
 * Detection runs inside a dedicated Web Worker (see `objectDetector.worker.ts`)
 * so TensorFlow.js inference never blocks the renderer main thread / video UI.
 * The facade keeps the same public surface as before: `detect`, `getDetectorStatus`,
 * `disposeDetector` plus the pure helpers above.
 */

interface WorkerReply {
  ok: boolean
  error?: string
  status?: DetectorStatus
  detections?: RawDetection[]
}

interface PendingRequest {
  resolve: (reply: WorkerReply) => void
  reject: (error: unknown) => void
}

let worker: Worker | null = null
let workerStatus: DetectorStatus = 'idle'
let disposed = false
let requestSeq = 0
let pendingRequests = new Map<number, PendingRequest>()
let initPromise: Promise<Worker> | null = null
let drawCanvas: HTMLCanvasElement | null = null
let unloadListenerAttached = false

function handleWorkerMessage(data: unknown): void {
  const message = data as { type?: string; id?: number; ok?: boolean; error?: string; status?: DetectorStatus; detections?: RawDetection[] }
  if (!message || typeof message.type !== 'string' || message.id === undefined) return

  const pending = pendingRequests.get(message.id)
  if (!pending) return
  pendingRequests.delete(message.id)

  if (message.type === 'initialize-result' || message.type === 'detect-result') {
    if (message.ok) {
      pending.resolve({
        ok: true,
        detections: message.detections,
        status: message.status
      })
    } else {
      pending.reject(
        new DetectorLoadError(new Error(message.error ?? 'Object detector request failed'))
      )
    }
  }
}

function createWorker(): Worker {
  if (typeof Worker === 'undefined') {
    throw new DetectorLoadError(new Error('Web Workers are not available in this environment'))
  }

  return new Worker(new URL('./objectDetector.worker.ts', import.meta.url), { type: 'module' })
}

function ensureUnloadListener(): void {
  if (!unloadListenerAttached && typeof window !== 'undefined') {
    unloadListenerAttached = true
    window.addEventListener('beforeunload', disposeDetector)
  }
}

function getWorker(): Promise<Worker> {
  ensureUnloadListener()
  if (disposed) {
    return Promise.reject(new DetectorLoadError(new Error('Object detector was disposed')))
  }

  if (initPromise) return initPromise

  initPromise = (async () => {
    const next = createWorker()
    worker = next
    workerStatus = 'loading'

    next.onmessage = (event) => handleWorkerMessage(event.data)
    next.onerror = (event) => {
      const error = new DetectorLoadError(
        new Error(event?.message || 'Object detector worker crashed')
      )
      for (const pending of pendingRequests.values()) {
        pending.reject(error)
      }
      pendingRequests.clear()
      workerStatus = 'error'
    }

    const reply = await send(next, {
      type: 'initialize',
      config: {
        maxBoxes: MAX_DETECTION_BOXES,
        minScore: MIN_SCORE,
        ...(MODEL_URL ? { modelUrl: MODEL_URL } : {})
      }
    })

    if (!reply.ok) {
      throw new DetectorLoadError(new Error(reply.error ?? 'Object detector failed to initialize'))
    }

    workerStatus = reply.status ?? 'ready'
    return next
  })().catch((error) => {
    initPromise = null
    worker = null
    workerStatus = 'error'
    throw error
  })

  return initPromise
}

function requestSeqNext(): number {
  return requestSeq++
}

function send(target: Worker, message: Record<string, unknown>, transfer?: Transferable[]): Promise<WorkerReply> {
  const id = requestSeqNext()
  const reply = new Promise<WorkerReply>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
  })
  target.postMessage({ ...message, id }, transfer ?? [])
  return reply
}

async function sourceToBitmap(source: HTMLVideoElement | HTMLCanvasElement): Promise<ImageBitmap> {
  const width = source instanceof HTMLCanvasElement ? source.width : source.videoWidth
  const height = source instanceof HTMLCanvasElement ? source.height : source.videoHeight

  if (!width || !height) {
    throw new DetectorLoadError(new Error('Video frame is not ready for detection'))
  }

  if (!drawCanvas) {
    drawCanvas = document.createElement('canvas')
  }
  drawCanvas.width = width
  drawCanvas.height = height

  const ctx = drawCanvas.getContext('2d')
  if (!ctx) {
    throw new DetectorLoadError(new Error('Unable to acquire a 2D canvas context for detection'))
  }

  ctx.drawImage(source, 0, 0, width, height)
  return createImageBitmap(drawCanvas)
}

export function getDetectorStatus(): DetectorStatus {
  return workerStatus
}

export async function detect(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult[]> {
  const target = await getWorker()
  const bitmap = await sourceToBitmap(source)

  let reply: WorkerReply
  try {
    reply = await send(target, { type: 'detect', bitmap }, [bitmap])
  } catch (error) {
    throw error
  } finally {
    // The bitmap is transferred to the worker; on failure make sure it is closed.
    if (!worker) {
      try { bitmap.close() } catch { /* ignore */ }
    }
  }

  workerStatus = reply.status ?? workerStatus
  if (!reply.ok) {
    throw new DetectorLoadError(new Error(reply.error ?? 'Object detection failed'))
  }

  return filterDetections(reply.detections ?? [])
}

export function disposeDetector(): void {
  disposed = true

  if (worker) {
    try {
      worker.postMessage({ type: 'dispose' })
    } catch {
      // Worker may already be gone; ignore.
    }
    worker.terminate()
    worker = null
  }

  const error = new DetectorLoadError(new Error('Object detector was disposed'))
  for (const pending of pendingRequests.values()) {
    pending.reject(error)
  }
  pendingRequests.clear()

  initPromise = null
  workerStatus = 'idle'
}