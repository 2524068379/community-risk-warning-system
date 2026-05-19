import { useCallback, useEffect, useRef, useState } from 'react'
import { computeFrameDiff, toGrayscale } from '@/utils/frameDiff'

interface FrameCaptureOptions {
  intervalMs?: number
  quality?: number
  maxWidth?: number
  maxHeight?: number
  enabled?: boolean
  frameDiffThreshold?: number
  /** Fast interval when motion is detected (ms) */
  activeIntervalMs?: number
  /** Slow interval when scene is idle (ms) */
  idleIntervalMs?: number
  /** Number of consecutive unchanged frames before switching to idle interval */
  idleAfterFrames?: number
}

interface FrameCaptureResult {
  frameDataUrl: string | null
  isProcessing: boolean
  captureCount: number
  error: string | null
  hasChanged: boolean
  markConsumed: () => void
}

const DIFF_WIDTH = 160
const DIFF_HEIGHT = 120

export function useFrameCapture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: FrameCaptureOptions = {}
): FrameCaptureResult {
  const {
    intervalMs = 2000,
    quality = 0.7,
    maxWidth = 640,
    maxHeight = 480,
    enabled = true,
    frameDiffThreshold = 0.05,
    activeIntervalMs = 500,
    idleIntervalMs = 5000,
    idleAfterFrames = 6
  } = options

  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [captureCount, setCaptureCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [hasChanged, setHasChanged] = useState(false)

  const isProcessingRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Adaptive interval state
  const unchangedCountRef = useRef(0)
  const currentIntervalRef = useRef(activeIntervalMs)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    canvasRef.current = document.createElement('canvas')
    const diffCanvas = document.createElement('canvas')
    diffCanvas.width = DIFF_WIDTH
    diffCanvas.height = DIFF_HEIGHT
    diffCanvasRef.current = diffCanvas
    return () => {
      canvasRef.current = null
      diffCanvasRef.current = null
    }
  }, [])

  const markConsumed = useCallback(() => {
    isProcessingRef.current = false
    setIsProcessing(false)
  }, [])

  useEffect(() => {
    if (!enabled) return

    function scheduleCapture() {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(captureLoop, currentIntervalRef.current)
    }

    function captureLoop() {
      const video = videoRef.current
      const canvas = canvasRef.current
      const diffCanvas = diffCanvasRef.current
      if (!video || !canvas || !diffCanvas || !enabledRef.current) return
      if (video.readyState < 2) return
      if (isProcessingRef.current) return

      try {
        const diffCtx = diffCanvas.getContext('2d')
        if (!diffCtx) return

        diffCtx.drawImage(video, 0, 0, DIFF_WIDTH, DIFF_HEIGHT)
        const imageData = diffCtx.getImageData(0, 0, DIFF_WIDTH, DIFF_HEIGHT)
        const gray = toGrayscale(imageData.data)

        const changed = prevGrayRef.current
          ? computeFrameDiff(gray, prevGrayRef.current) >= frameDiffThreshold
          : true
        prevGrayRef.current = gray
        setHasChanged(changed)

        // Adaptive interval: fast when motion, slow when idle
        if (changed) {
          unchangedCountRef.current = 0
          if (currentIntervalRef.current !== activeIntervalMs) {
            currentIntervalRef.current = activeIntervalMs
            scheduleCapture()
          }
        } else {
          unchangedCountRef.current++
          if (unchangedCountRef.current >= idleAfterFrames && currentIntervalRef.current !== idleIntervalMs) {
            currentIntervalRef.current = idleIntervalMs
            scheduleCapture()
          }
        }

        const vw = video.videoWidth
        const vh = video.videoHeight
        if (!vw || !vh) return

        const scale = Math.min(maxWidth / vw, maxHeight / vh, 1)
        const w = Math.round(vw * scale)
        const h = Math.round(vh * scale)
        canvas.width = w
        canvas.height = h

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(video, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)

        isProcessingRef.current = true
        setIsProcessing(true)
        setFrameDataUrl(dataUrl)
        setCaptureCount((c) => c + 1)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Frame capture failed')
      }
    }

    // Initial schedule with active interval
    currentIntervalRef.current = activeIntervalMs
    scheduleCapture()

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, intervalMs, quality, maxWidth, maxHeight, frameDiffThreshold, activeIntervalMs, idleIntervalMs, idleAfterFrames, videoRef])

  return { frameDataUrl, isProcessing, captureCount, error, hasChanged, markConsumed }
}
