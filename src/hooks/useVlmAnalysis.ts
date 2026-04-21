import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { analyzeFrameWithOllama } from '@/services/llm/ollamaClient'
import { useFrameCapture } from './useFrameCapture'
import { http } from '@/services/http'

interface VlmAnalysisOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraId: string
  scene: string
  enabled?: boolean
  captureIntervalMs?: number
}

async function checkVlmServerReady(): Promise<boolean> {
  try {
    const res = await http.get('/api/ollama/status', { timeout: 3000 })
    return res.data?.ready === true
  } catch {
    return false
  }
}

export function useVlmAnalysis(options: VlmAnalysisOptions) {
  const {
    videoRef,
    cameraId,
    scene,
    enabled = true,
    captureIntervalMs = 5000
  } = options

  const [serverReady, setServerReady] = useState(false)
  const analyzingRef = useRef(false)

  const shouldCapture = enabled && serverReady

  const { frameDataUrl, markConsumed } = useFrameCapture(videoRef, {
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
        setServerReady(true)
        useAppStore.getState().setVlmStatus('idle')
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
