import { useCallback, useEffect, useRef, useState } from 'react'

interface FrameCaptureOptions {
  intervalMs?: number
  quality?: number
  maxWidth?: number
  maxHeight?: number
  enabled?: boolean
}

interface FrameCaptureResult {
  frameDataUrl: string | null
  isProcessing: boolean
  captureCount: number
  error: string | null
  markConsumed: () => void
}

export function useFrameCapture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: FrameCaptureOptions = {}
): FrameCaptureResult {
  const {
    intervalMs = 5000,
    quality = 0.7,
    maxWidth = 640,
    maxHeight = 480,
    enabled = true
  } = options

  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [captureCount, setCaptureCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const isProcessingRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    canvasRef.current = document.createElement('canvas')
    return () => {
      canvasRef.current = null
    }
  }, [])

  const markConsumed = useCallback(() => {
    isProcessingRef.current = false
    setIsProcessing(false)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const id = setInterval(() => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !enabledRef.current) return
      if (video.readyState < 2) return
      if (isProcessingRef.current) return

      try {
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
    }, intervalMs)

    return () => clearInterval(id)
  }, [enabled, intervalMs, quality, maxWidth, maxHeight, videoRef])

  return { frameDataUrl, isProcessing, captureCount, error, markConsumed }
}
