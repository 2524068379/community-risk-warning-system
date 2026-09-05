/**
 * Object-detection Web Worker.
 *
 * Runs TensorFlow.js + COCO-SSD off the renderer main thread so video/UI
 * rendering is never blocked by model inference. The worker only loads the
 * model and returns raw predictions; filtering, env parsing and status
 * semantics stay with the renderer-side facade (`objectDetector.ts`).
 *
 * Message protocol (all messages carry an `id` for correlation):
 *  - {type:'initialize', id, config:{maxBoxes,minScore,modelUrl}}
 *  - {type:'initialize-result', id, ok, error?, status}
 *  - {type:'detect',        id, bitmap}            (bitmap transferred)
 *  - {type:'detect-result', id, ok, detections?, error?, status}
 *  - {type:'dispose'}
 */

// Declare a minimal worker scope instead of pulling the WebWorker lib in,
// which would collide with the DOM lib used by the rest of the renderer.
declare const self: {
  location: { origin: string }
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: (message: unknown) => void
  close: () => void
}

interface WorkerConfig {
  maxBoxes: number
  minScore: number
  modelUrl?: string
}

interface RawPrediction {
  class: string
  score: number
  bbox: [number, number, number, number]
}

import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error'
type DetectorModel = cocoSsd.ObjectDetection

let model: DetectorModel | null = null
let config: WorkerConfig | null = null
let status: DetectorStatus = 'idle'
let loadingPromise: Promise<DetectorModel> | null = null

function post(message: unknown): void {
  self.postMessage(message)
}

async function ensureTfBackend(): Promise<void> {
  await tf.ready()
  // Prefer WebGL (GPU) in the worker when OffscreenCanvas is available;
  // otherwise tfjs falls back to a CPU backend, which still works.
  if (tf.getBackend() === 'cpu' && typeof OffscreenCanvas !== 'undefined') {
    try {
      await tf.setBackend('webgl')
    } catch {
      // CPU backend remains active; that is acceptable.
    }
  }
}

function loadModel(): Promise<DetectorModel> {
  if (model) return Promise.resolve(model)
  if (loadingPromise) return loadingPromise

  status = 'loading'
  loadingPromise = (async () => {
    await ensureTfBackend()
    const next = await cocoSsd.load({
      base: 'lite_mobilenet_v2',
      ...(config?.modelUrl ? { modelUrl: config.modelUrl } : {})
    })
    model = next
    status = 'ready'
    return next
  })().catch((error: unknown) => {
    status = 'error'
    loadingPromise = null
    throw error
  })

  return loadingPromise
}

async function handleDetect(id: number, bitmap: ImageBitmap): Promise<void> {
  let input: ReturnType<typeof tf.browser.fromPixels> | null = null
  try {
    const next = await loadModel()
    input = tf.browser.fromPixels(bitmap)
    const predictions = await next.detect(input, config?.maxBoxes ?? 20, config?.minScore ?? 0.35)
    post({
      type: 'detect-result',
      id,
      ok: true,
      detections: predictions as RawPrediction[],
      status
    })
  } catch (error) {
    post({
      type: 'detect-result',
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      status
    })
  } finally {
    // Model load or inference can fail after the bitmap arrived — release both
    // tensors regardless so repeated failures don't leak GPU/WASM memory.
    input?.dispose()
    bitmap.close()
  }
}

function handleDispose(): void {
  model?.dispose()
  model = null
  loadingPromise = null
  status = 'idle'
  post({ type: 'disposed' })
  self.close()
}

self.onmessage = (event: MessageEvent) => {
  const trustedOrigin = self.location.origin
  const origin =
    typeof event.origin === 'string' && event.origin.length > 0 ? event.origin : null

  // Verify sender origin when it is provided by the runtime.
  // Dedicated-worker messages may not always carry a non-empty origin.
  if (origin !== null && origin !== trustedOrigin) return

  const message = event.data as {
    type?: string
    id?: number
    config?: WorkerConfig
    bitmap?: ImageBitmap
  }

  if (!message || typeof message.type !== 'string') return

  switch (message.type) {
    case 'initialize': {
      config = message.config ?? null
      status = 'loading'
      loadModel()
        .then(() => {
          post({ type: 'initialize-result', id: message.id, ok: true, status })
        })
        .catch((error: unknown) => {
          post({
            type: 'initialize-result',
            id: message.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            status
          })
        })
      break
    }
    case 'detect': {
      if (message.id !== undefined && message.bitmap) {
        void handleDetect(message.id, message.bitmap)
      }
      break
    }
    case 'dispose': {
      handleDispose()
      break
    }
  }
}