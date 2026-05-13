import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { analyzeFrameWithOllama } from '@/services/llm/ollamaClient'
import { useFrameCapture } from './useFrameCapture'
import { detect, getDetectorStatus } from '@/services/detection/objectDetector'
import { http } from '@/services/http'
import { OLLAMA_STATUS_ROUTE } from '../../shared/apiRoutes.js'
import type { DetectionResult, VlmAnalysis } from '@/types'

interface VlmAnalysisOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraId: string
  scene: string
  enabled?: boolean
  captureIntervalMs?: number
  fallbackIntervalMs?: number
}

interface FinalizeVlmFrameOptions {
  markConsumed: () => void
  releaseAnalysisLock: () => void
}

export function finalizeVlmFrame(options: FinalizeVlmFrameOptions): void {
  options.markConsumed()
  options.releaseAnalysisLock()
}

async function checkVlmServerReady(): Promise<boolean> {
  try {
    const res = await http.get(OLLAMA_STATUS_ROUTE, { timeout: 3000 })
    return res.data?.ready === true
  } catch {
    return false
  }
}

let globalServerReady = false
const FALLBACK_INTERVAL_MS = 20000
const FAIL_THRESHOLD = 3

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
    captureIntervalMs = 2000,
    fallbackIntervalMs = FALLBACK_INTERVAL_MS
  } = options

  const [serverReady, setServerReady] = useState(globalServerReady)
  const analyzingRef = useRef(false)
  const lastVlmTimeRef = useRef(0)
  const detectorFailedRef = useRef(false)
  const failCountRef = useRef(0)

  const shouldCapture = enabled && serverReady

  const { frameDataUrl, hasChanged, markConsumed } = useFrameCapture(videoRef, {
    intervalMs: captureIntervalMs,
    quality: 0.7,
    maxWidth: 640,
    maxHeight: 480,
    enabled: shouldCapture
  })

  useEffect(() => {
    if (!enabled) return

    const check = async () => {
      const ready = await checkVlmServerReady()
      if (ready) {
        globalServerReady = true
        setServerReady(true)
        failCountRef.current = 0
        useAppStore.getState().setVlmStatus('idle')
      } else {
        failCountRef.current++
        if (failCountRef.current === 1) {
          useAppStore.getState().setVlmStatus('loading')
          useAppStore.setState({
            analysis: { ...useAppStore.getState().analysis, summary: connectingAnalysis.summary }
          })
        } else if (failCountRef.current >= FAIL_THRESHOLD) {
          useAppStore.getState().setVlmStatus(
            'error',
            'VLM 服务未连接，请确保后端服务已启动且模型已加载'
          )
        }
      }
    }

    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [enabled])

  useEffect(() => {
    if (!frameDataUrl || analyzingRef.current) return

    let cancelled = false
    analyzingRef.current = true

    ;(async () => {
      try {
        if (!hasChanged) return

        let shouldSendVlm = false
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
          } else {
            const now = Date.now()
            if (now - lastVlmTimeRef.current >= fallbackIntervalMs) {
              shouldSendVlm = true
            }
          }
        }

        if (!shouldSendVlm) return

        lastVlmTimeRef.current = Date.now()
        useAppStore.getState().setVlmStatus('analyzing')
        const result = await analyzeFrameWithOllama(frameDataUrl, cameraId, scene)
        if (!cancelled) {
          useAppStore.getState().setAnalysis(result.analysis, result.boxes)
          useAppStore.getState().setVlmStatus('ready')
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
