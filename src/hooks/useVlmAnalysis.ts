import { useEffect, useRef, useState } from 'react'
import { useAppStore, type VlmStatus } from '@/store/useAppStore'
import { VlmResponseError, analyzeFrameWithOllama } from '@/services/llm/ollamaClient'
import { useFrameCapture } from './useFrameCapture'
import { detect, getDetectorStatus } from '@/services/detection/objectDetector'
import { http } from '@/services/http'
import { OLLAMA_STATUS_ROUTE } from '../../shared/apiRoutes.js'
import type { DetectionResult } from '@/types'

type VlmConnectionRuntimeStatus = 'starting' | 'loading' | 'ready' | 'error'
type VlmConnectionSource = 'electron' | 'proxy'
type VlmStatusHttpGet = (
  url: string,
  config: { timeout: number }
) => Promise<{ data?: { ready?: boolean; status?: unknown } }>

interface ElectronApi {
  getApiBase: () => Promise<string | undefined>
  getOllamaStatus: () => Promise<{
    ready: boolean
    status: string
    baseUrl: string
    gpu: 'unknown'
  }>
}

interface VlmConnectionStatus {
  ready: boolean
  status: VlmConnectionRuntimeStatus
  source: VlmConnectionSource
}

interface CheckVlmConnectionStatusOptions {
  electronApi?: ElectronApi
  httpGet?: VlmStatusHttpGet
}

interface VlmAnalysisOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraId: string
  scene: string
  /** Whether to check and use the VLM service. */
  enabled?: boolean
  /** Whether frames may be captured; connection checks remain active when false. */
  captureEnabled?: boolean
  /** Fast capture interval when motion detected (ms) */
  activeIntervalMs?: number
  /** Slow capture interval when scene is idle (ms) */
  idleIntervalMs?: number
  /** Fallback VLM interval when no objects detected (ms) */
  fallbackIntervalMs?: number
  /** Periodic VLM probe interval for unchanged scenes (ms) */
  idleProbeIntervalMs?: number
}

interface FinalizeVlmFrameOptions {
  markConsumed: () => void
  releaseAnalysisLock: () => void
}

interface ConsumeUnchangedFrameOptions {
  frameDataUrl: string | null
  hasChanged: boolean
  markConsumed: () => void
  now?: number
  lastVlmTime?: number
  idleProbeIntervalMs?: number
}

interface ResetVlmAnalysisContextOptions extends FinalizeVlmFrameOptions {
  controller: AbortController | null
  invalidateAnalysisRun: () => void
  resetDispatchClock: () => void
}

interface PlanVlmDispatchOptions {
  detectorFailed: boolean
  detections: DetectionResult[]
  now: number
  lastVlmTime: number
  fallbackIntervalMs: number
}

interface VlmDispatchPlan {
  shouldSendVlm: boolean
  reason: 'detector-failed' | 'object' | 'fallback' | 'skip'
}

export const VLM_CONNECTION_ERROR_MESSAGE = 'VLM 服务未连接，请确保后端服务已启动且模型已加载'

export function canCaptureVlmFrames(
  enabled: boolean,
  captureEnabled: boolean,
  serverReady: boolean
): boolean {
  return enabled && captureEnabled && serverReady
}

export function shouldResetVlmStatusAfterConnectionReady(
  status: VlmStatus,
  error: string | null,
  recoveredFromConnectionFailure: boolean
): boolean {
  return status === 'loading' || (
    status === 'error' && (
      recoveredFromConnectionFailure || error === VLM_CONNECTION_ERROR_MESSAGE
    )
  )
}

export function finalizeVlmFrame(options: FinalizeVlmFrameOptions): void {
  options.markConsumed()
  options.releaseAnalysisLock()
}

export function resetVlmAnalysisContext(options: ResetVlmAnalysisContextOptions): void {
  options.invalidateAnalysisRun()
  options.controller?.abort()
  options.resetDispatchClock()
  finalizeVlmFrame(options)
}

export function shouldHandleFrameSequence(frameSequence: number, lastHandledSequence: number): boolean {
  return Number.isSafeInteger(frameSequence) && frameSequence > lastHandledSequence
}

export function isCurrentVlmAnalysisRun(
  analysisRun: number,
  currentAnalysisRun: number,
  cancelled: boolean
): boolean {
  return !cancelled && analysisRun === currentAnalysisRun
}

export function isRequestCanceled(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: unknown; name?: unknown }
  return candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError' ||
    candidate.code === 'ERR_CANCELED'
}

export function getVlmAnalysisFailure(error: unknown): {
  status: 'response-error' | 'error'
  message: string
} {
  if (error instanceof VlmResponseError) {
    return {
      status: 'response-error',
      message: `VLM 在线，但响应格式异常：${error.message}`
    }
  }

  return {
    status: 'error',
    message: error instanceof Error ? error.message : 'VLM analysis failed'
  }
}

export function consumeUnchangedVlmFrame(options: ConsumeUnchangedFrameOptions): boolean {
  if (!options.frameDataUrl || options.hasChanged) {
    return false
  }

  if (
    options.idleProbeIntervalMs !== undefined &&
    options.lastVlmTime !== undefined
  ) {
    const now = options.now ?? Date.now()
    if (now - options.lastVlmTime >= options.idleProbeIntervalMs) {
      return false
    }
  }

  options.markConsumed()
  return true
}

function normalizeRuntimeStatus(status: unknown, ready: boolean): VlmConnectionRuntimeStatus {
  if (status === 'starting' || status === 'loading' || status === 'ready' || status === 'error') {
    return status
  }

  return ready ? 'ready' : 'error'
}

export async function checkVlmConnectionStatus(
  options: CheckVlmConnectionStatusOptions = {}
): Promise<VlmConnectionStatus> {
  const electronApi = options.electronApi
    ?? (typeof window === 'undefined' ? undefined : window.electronAPI)
  const httpGet = options.httpGet ?? ((url, config) => http.get(url, config))

  const readProxyStatus = async (): Promise<VlmConnectionStatus | null> => {
    try {
      const res = await httpGet(OLLAMA_STATUS_ROUTE, { timeout: 3000 })
      const ready = res.data?.ready === true
      return {
        ready,
        status: normalizeRuntimeStatus(res.data?.status, ready),
        source: 'proxy'
      }
    } catch {
      return null
    }
  }

  if (electronApi) {
    try {
      const status = await electronApi.getOllamaStatus()
      const ready = status.ready === true
      const electronStatus = {
        ready,
        status: normalizeRuntimeStatus(status.status, ready),
        source: 'electron'
      } satisfies VlmConnectionStatus

      if (electronStatus.ready) {
        return electronStatus
      }

      const proxyStatus = await readProxyStatus()
      return proxyStatus?.ready ? proxyStatus : electronStatus
    } catch {
      // Fall back to the proxy status endpoint in browser-like test/dev contexts.
    }
  }

  return await readProxyStatus() ?? { ready: false, status: 'error', source: 'proxy' }
}

const FALLBACK_INTERVAL_MS = 6000
const IDLE_PROBE_INTERVAL_MS = 12000
const FAIL_THRESHOLD = 3
const DETECTOR_RETRY_BASE_MS = 2000
const DETECTOR_RETRY_MAX_MS = 30000

export function getDetectorRetryDelayMs(consecutiveFailures: number): number {
  const failures = Number.isFinite(consecutiveFailures)
    ? Math.max(1, Math.floor(consecutiveFailures))
    : 1
  return Math.min(DETECTOR_RETRY_BASE_MS * (2 ** (failures - 1)), DETECTOR_RETRY_MAX_MS)
}

export function planVlmDispatch(options: PlanVlmDispatchOptions): VlmDispatchPlan {
  if (options.detectorFailed) {
    return {
      shouldSendVlm: true,
      reason: 'detector-failed'
    }
  }

  if (options.detections.length > 0) {
    return {
      shouldSendVlm: true,
      reason: 'object'
    }
  }

  if (options.now - options.lastVlmTime >= options.fallbackIntervalMs) {
    return {
      shouldSendVlm: true,
      reason: 'fallback'
    }
  }

  return {
    shouldSendVlm: false,
    reason: 'skip'
  }
}

export function useVlmAnalysis(options: VlmAnalysisOptions) {
  const {
    videoRef,
    cameraId,
    scene,
    enabled = true,
    captureEnabled = enabled,
    activeIntervalMs = 500,
    idleIntervalMs = 5000,
    fallbackIntervalMs = FALLBACK_INTERVAL_MS,
    idleProbeIntervalMs = IDLE_PROBE_INTERVAL_MS
  } = options

  const [serverReady, setServerReady] = useState(false)
  const analyzingRef = useRef(false)
  const lastVlmTimeRef = useRef(0)
  const detectorFailedRef = useRef(false)
  const detectorFailureCountRef = useRef(0)
  const nextDetectorRetryAtRef = useRef(0)
  const failCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const analysisRunRef = useRef(0)
  const lastHandledSequenceRef = useRef(0)

  const shouldCapture = canCaptureVlmFrames(enabled, captureEnabled, serverReady)

  const { frameDataUrl, frameSequence, capturedAt, hasChanged, markConsumed } = useFrameCapture(videoRef, {
    activeIntervalMs,
    idleIntervalMs,
    quality: 0.7,
    maxWidth: 640,
    maxHeight: 480,
    enabled: shouldCapture
  })

  useEffect(() => {
    useAppStore.getState().invalidateAnalysis()
    resetVlmAnalysisContext({
      controller: abortControllerRef.current,
      markConsumed,
      releaseAnalysisLock: () => {
        analyzingRef.current = false
      },
      invalidateAnalysisRun: () => {
        analysisRunRef.current++
      },
      resetDispatchClock: () => {
        lastVlmTimeRef.current = 0
      }
    })
    abortControllerRef.current = null
    detectorFailedRef.current = false
    detectorFailureCountRef.current = 0
    nextDetectorRetryAtRef.current = 0
    // Never relabel a frame captured under the previous camera context.
    lastHandledSequenceRef.current = frameSequence
  }, [cameraId, scene, enabled, captureEnabled, markConsumed])

  useEffect(() => {
    if (!enabled) {
      setServerReady(false)
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      return
    }

    let stopped = false

    const markServerUnavailable = () => {
      setServerReady(false)
      resetVlmAnalysisContext({
        controller: abortControllerRef.current,
        markConsumed,
        releaseAnalysisLock: () => {
          analyzingRef.current = false
        },
        invalidateAnalysisRun: () => {
          analysisRunRef.current++
        },
        resetDispatchClock: () => {
          lastVlmTimeRef.current = 0
        }
      })
      abortControllerRef.current = null
    }

    const check = async () => {
      const connection = await checkVlmConnectionStatus()
      if (stopped) return

      if (connection.ready) {
        const recoveredFromConnectionFailure = failCountRef.current > 0
        setServerReady(true)
        failCountRef.current = 0
        const store = useAppStore.getState()
        if (shouldResetVlmStatusAfterConnectionReady(
          store.vlmStatus,
          store.vlmError,
          recoveredFromConnectionFailure
        )) {
          store.setVlmStatus('idle')
        }
      } else if (connection.status === 'starting' || connection.status === 'loading') {
        markServerUnavailable()
        failCountRef.current = 0
        useAppStore.getState().invalidateAnalysis()
        useAppStore.getState().setVlmStatus('loading')
      } else {
        markServerUnavailable()
        failCountRef.current++
        useAppStore.getState().invalidateAnalysis()
        if (failCountRef.current === 1) {
          useAppStore.getState().setVlmStatus('loading')
        } else if (failCountRef.current >= FAIL_THRESHOLD) {
          useAppStore.getState().setVlmStatus(
            'error',
            VLM_CONNECTION_ERROR_MESSAGE
          )
        }
      }
    }

    check()
    const id = setInterval(check, 5000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [enabled, markConsumed])

  // Cleanup: abort any in-flight VLM request on unmount
  useEffect(() => {
    return () => {
      analysisRunRef.current++
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      useAppStore.getState().invalidateAnalysis()
    }
  }, [])

  useEffect(() => {
    if (!shouldCapture || !frameDataUrl || analyzingRef.current) return
    if (!shouldHandleFrameSequence(frameSequence, lastHandledSequenceRef.current)) return
    lastHandledSequenceRef.current = frameSequence
    if (consumeUnchangedVlmFrame({
      frameDataUrl,
      hasChanged,
      markConsumed,
      lastVlmTime: lastVlmTimeRef.current,
      idleProbeIntervalMs
    })) return

    let cancelled = false
    analyzingRef.current = true
    const analysisRun = ++analysisRunRef.current
    const isCurrentRun = () => isCurrentVlmAnalysisRun(
      analysisRun,
      analysisRunRef.current,
      cancelled
    )

    ;(async () => {
      try {
        if (!isCurrentRun()) return
        let detections: DetectionResult[] = []

        const detectorAttemptTime = Date.now()
        if (!detectorFailedRef.current || detectorAttemptTime >= nextDetectorRetryAtRef.current) {
          try {
            const video = videoRef.current
            if (video && video.readyState >= 2) {
              detections = await detect(video)
            }
            if (!isCurrentRun()) return
            const detectorStatus = getDetectorStatus()
            useAppStore.getState().setDetectorStatus(detectorStatus)
            if (detectorStatus === 'error') {
              throw new Error('Object detector is unavailable')
            }
            detectorFailedRef.current = false
            detectorFailureCountRef.current = 0
            nextDetectorRetryAtRef.current = 0
            useAppStore.getState().setDetectedObjects(detections)
          } catch {
            if (!isCurrentRun()) return
            detectorFailedRef.current = true
            detectorFailureCountRef.current++
            nextDetectorRetryAtRef.current = detectorAttemptTime + getDetectorRetryDelayMs(
              detectorFailureCountRef.current
            )
            useAppStore.getState().setDetectorStatus('error')
          }
        }

        if (!isCurrentRun()) return

        const dispatchPlan = planVlmDispatch({
          detectorFailed: detectorFailedRef.current,
          detections,
          now: Date.now(),
          lastVlmTime: lastVlmTimeRef.current,
          fallbackIntervalMs
        })

        if (!dispatchPlan.shouldSendVlm || !isCurrentRun()) return

        lastVlmTimeRef.current = Date.now()
        useAppStore.getState().setVlmStatus('analyzing')

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
          const result = await analyzeFrameWithOllama(
            frameDataUrl, cameraId, scene, controller.signal
          )
          if (isCurrentRun()) {
            useAppStore.getState().setAnalysis(result.analysis, result.boxes, {
              cameraId,
              modelSource: result.modelSource,
              capturedAt: capturedAt ?? Date.now(),
              frameDataUrl
            })
            useAppStore.getState().setVlmStatus('ready')
          }
        } catch (err) {
          // Ignore aborted requests — not real errors
          if (isRequestCanceled(err)) return
          if (!isCurrentRun()) return
          throw err
        } finally {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null
          }
        }
      } catch (err) {
        if (isCurrentRun()) {
          const failure = getVlmAnalysisFailure(err)
          useAppStore.getState().invalidateAnalysis()
          useAppStore.getState().setVlmStatus(
            failure.status,
            failure.message
          )
        }
      } finally {
        if (analysisRunRef.current === analysisRun) {
          finalizeVlmFrame({
            markConsumed,
            releaseAnalysisLock: () => {
              analyzingRef.current = false
            }
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    frameDataUrl,
    frameSequence,
    capturedAt,
    cameraId,
    scene,
    markConsumed,
    hasChanged,
    fallbackIntervalMs,
    idleProbeIntervalMs,
    videoRef,
    shouldCapture
  ])
}
