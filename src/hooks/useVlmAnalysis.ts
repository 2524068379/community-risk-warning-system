import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { analyzeFrameWithOllama } from '@/services/llm/ollamaClient'
import { useFrameCapture } from './useFrameCapture'
import { detect, getDetectorStatus } from '@/services/detection/objectDetector'
import { http } from '@/services/http'
import { OLLAMA_STATUS_ROUTE } from '../../shared/apiRoutes.js'
import type { DetectionResult, VlmAnalysis } from '@/types'

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
  enabled?: boolean
  /** Fast capture interval when motion detected (ms) */
  activeIntervalMs?: number
  /** Slow capture interval when scene is idle (ms) */
  idleIntervalMs?: number
  /** Fallback VLM interval when no objects detected (ms) */
  fallbackIntervalMs?: number
}

interface FinalizeVlmFrameOptions {
  markConsumed: () => void
  releaseAnalysisLock: () => void
}

interface ConsumeUnchangedFrameOptions {
  frameDataUrl: string | null
  hasChanged: boolean
  markConsumed: () => void
}

export function finalizeVlmFrame(options: FinalizeVlmFrameOptions): void {
  options.markConsumed()
  options.releaseAnalysisLock()
}

export function consumeUnchangedVlmFrame(options: ConsumeUnchangedFrameOptions): boolean {
  if (!options.frameDataUrl || options.hasChanged) {
    return false
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

  if (electronApi) {
    try {
      const status = await electronApi.getOllamaStatus()
      const ready = status.ready === true
      return {
        ready,
        status: normalizeRuntimeStatus(status.status, ready),
        source: 'electron'
      }
    } catch {
      // Fall back to the proxy status endpoint in browser-like test/dev contexts.
    }
  }

  try {
    const res = await httpGet(OLLAMA_STATUS_ROUTE, { timeout: 3000 })
    const ready = res.data?.ready === true
    return {
      ready,
      status: normalizeRuntimeStatus(res.data?.status, ready),
      source: 'proxy'
    }
  } catch {
    return { ready: false, status: 'error', source: 'proxy' }
  }
}

const FALLBACK_INTERVAL_MS = 10000
const FAIL_THRESHOLD = 3
/** High-priority labels that trigger immediate VLM dispatch */
const HIGH_PRIORITY_LABELS = new Set(['person'])

const connectingAnalysis: VlmAnalysis = {
  riskScore: 0,
  level: 'C',
  hasRisk: false,
  confidence: 0,
  summary: '正在连接 VLM 服务…',
  evidenceTimeline: [],
  breakdown: [],
  trend: []
}

export function useVlmAnalysis(options: VlmAnalysisOptions) {
  const {
    videoRef,
    cameraId,
    scene,
    enabled = true,
    activeIntervalMs = 500,
    idleIntervalMs = 5000,
    fallbackIntervalMs = FALLBACK_INTERVAL_MS
  } = options

  const [serverReady, setServerReady] = useState(false)
  const analyzingRef = useRef(false)
  const lastVlmTimeRef = useRef(0)
  const detectorFailedRef = useRef(false)
  const failCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const shouldCapture = enabled && serverReady

  const { frameDataUrl, hasChanged, markConsumed } = useFrameCapture(videoRef, {
    activeIntervalMs,
    idleIntervalMs,
    quality: 0.7,
    maxWidth: 640,
    maxHeight: 480,
    enabled: shouldCapture
  })

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
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }

    const check = async () => {
      const connection = await checkVlmConnectionStatus()
      if (stopped) return

      if (connection.ready) {
        setServerReady(true)
        failCountRef.current = 0
        useAppStore.getState().setVlmStatus('idle')
      } else if (connection.status === 'starting' || connection.status === 'loading') {
        markServerUnavailable()
        failCountRef.current = 0
        useAppStore.getState().setVlmStatus('loading')
        useAppStore.getState().setAnalysisSummary(connectingAnalysis.summary)
      } else {
        markServerUnavailable()
        failCountRef.current++
        if (failCountRef.current === 1) {
          useAppStore.getState().setVlmStatus('loading')
          useAppStore.getState().setAnalysisSummary(connectingAnalysis.summary)
        } else if (failCountRef.current >= FAIL_THRESHOLD) {
          useAppStore.getState().setVlmStatus(
            'error',
            'VLM 服务未连接，请确保后端服务已启动且模型已加载'
          )
          useAppStore.getState().setAnalysisSummary('VLM 服务连接失败，请检查后端服务状态')
        }
      }
    }

    check()
    const id = setInterval(check, 5000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [enabled])

  // Cleanup: abort any in-flight VLM request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!frameDataUrl || analyzingRef.current) return
    if (consumeUnchangedVlmFrame({ frameDataUrl, hasChanged, markConsumed })) return

    let cancelled = false
    analyzingRef.current = true

    ;(async () => {
      try {
        let shouldSendVlm = false
        let isHighPriority = false
        let detections: DetectionResult[] = []

        if (detectorFailedRef.current) {
          shouldSendVlm = true
        } else {
          try {
            const video = videoRef.current
            if (video && video.readyState >= 2) {
              detections = await detect(video)
            }
            useAppStore.getState().setDetectorStatus(getDetectorStatus())
            useAppStore.getState().setDetectedObjects(detections)
          } catch {
            detectorFailedRef.current = true
            useAppStore.getState().setDetectorStatus('error')
          }

          if (detections.length > 0) {
            shouldSendVlm = true
            isHighPriority = detections.some((d) => HIGH_PRIORITY_LABELS.has(d.label))
          } else {
            const now = Date.now()
            if (now - lastVlmTimeRef.current >= fallbackIntervalMs) {
              shouldSendVlm = true
            }
          }
        }

        if (!shouldSendVlm) return

        // High-priority detection: abort stale in-flight request
        if (isHighPriority && abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }

        // Skip if a VLM request is already in-flight (non-priority frame)
        if (!isHighPriority && abortControllerRef.current) return

        lastVlmTimeRef.current = Date.now()
        useAppStore.getState().setVlmStatus('analyzing')

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
          const result = await analyzeFrameWithOllama(
            frameDataUrl, cameraId, scene, controller.signal
          )
          if (!cancelled) {
            useAppStore.getState().setAnalysis(result.analysis, result.boxes)
            useAppStore.getState().setVlmStatus('ready')
          }
        } catch (err) {
          // Ignore aborted requests — not real errors
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (cancelled) return
          throw err
        } finally {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null
          }
        }
      } catch (err) {
        if (!cancelled) {
          useAppStore.getState().setVlmStatus(
            'error',
            err instanceof Error ? err.message : 'VLM analysis failed'
          )
        }
      } finally {
        finalizeVlmFrame({
          markConsumed,
          releaseAnalysisLock: () => {
            analyzingRef.current = false
          }
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [frameDataUrl, cameraId, scene, markConsumed, hasChanged, fallbackIntervalMs, videoRef])
}
