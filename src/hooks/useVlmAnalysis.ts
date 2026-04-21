import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { analyzeFrameWithOllama } from '@/services/llm/ollamaClient'
import { useFrameCapture } from './useFrameCapture'

interface VlmAnalysisOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraId: string
  scene: string
  enabled?: boolean
  captureIntervalMs?: number
}

export function useVlmAnalysis(options: VlmAnalysisOptions) {
  const {
    videoRef,
    cameraId,
    scene,
    enabled = true,
    captureIntervalMs = 5000
  } = options

  const { frameDataUrl, markConsumed } = useFrameCapture(videoRef, {
    intervalMs: captureIntervalMs,
    quality: 0.7,
    maxWidth: 640,
    maxHeight: 480,
    enabled
  })

  const analyzingRef = useRef(false)

  useEffect(() => {
    if (!frameDataUrl || analyzingRef.current) return

    let cancelled = false
    analyzingRef.current = true

    ;(async () => {
      try {
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
        if (!cancelled) {
          markConsumed()
          analyzingRef.current = false
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [frameDataUrl, cameraId, scene, markConsumed])
}
