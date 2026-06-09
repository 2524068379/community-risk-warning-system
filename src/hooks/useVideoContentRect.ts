import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { DetectionOverlayFrame } from '@/utils/detectionBoxView';

export function calculateContainedMediaRect(
  containerRect: DOMRect,
  mediaRect: DOMRect,
  mediaWidth: number,
  mediaHeight: number
): DetectionOverlayFrame | null {
  if (mediaRect.width <= 0 || mediaRect.height <= 0 || mediaWidth <= 0 || mediaHeight <= 0) {
    return null;
  }

  const scale = Math.min(mediaRect.width / mediaWidth, mediaRect.height / mediaHeight);
  const width = mediaWidth * scale;
  const height = mediaHeight * scale;

  return {
    left: mediaRect.left - containerRect.left + (mediaRect.width - width) / 2,
    top: mediaRect.top - containerRect.top + (mediaRect.height - height) / 2,
    width,
    height
  };
}

export function useVideoContentRect(
  videoRef: RefObject<HTMLVideoElement | null>,
  overlayRef: RefObject<HTMLElement | null>,
  refreshKey?: unknown
): DetectionOverlayFrame | null {
  const [rect, setRect] = useState<DetectionOverlayFrame | null>(null);

  const updateRect = useCallback(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) {
      setRect(null);
      return;
    }

    const nextRect = calculateContainedMediaRect(
      overlay.getBoundingClientRect(),
      video.getBoundingClientRect(),
      video.videoWidth,
      video.videoHeight
    );
    setRect(nextRect);
  }, [overlayRef, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    updateRect();

    const events = ['loadedmetadata', 'resize', 'playing', 'canplay'] as const;
    events.forEach((eventName) => video.addEventListener(eventName, updateRect));
    window.addEventListener('resize', updateRect);

    const observers: ResizeObserver[] = [];
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateRect);
      observer.observe(video);
      observer.observe(overlay);
      observers.push(observer);
    }

    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, updateRect));
      window.removeEventListener('resize', updateRect);
      observers.forEach((observer) => observer.disconnect());
    };
  }, [overlayRef, refreshKey, updateRect, videoRef]);

  return rect;
}
