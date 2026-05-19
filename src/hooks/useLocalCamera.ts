import { useEffect, useState } from 'react';

let persistentStream: MediaStream | null = null;
let persistentError: string | null = null;

function isStreamActive(s: MediaStream | null): s is MediaStream {
  return s !== null && s.active && s.getVideoTracks().some((t) => t.readyState === 'live');
}

export function useLocalCamera(videoRef?: React.RefObject<HTMLVideoElement | null>) {
  const reused = isStreamActive(persistentStream);
  const [stream, setStream] = useState<MediaStream | null>(reused ? persistentStream : null);
  const [loading, setLoading] = useState(!reused);
  const [error, setError] = useState<string | null>(reused ? null : persistentError);

  useEffect(() => {
    if (isStreamActive(persistentStream)) {
      setStream(persistentStream);
      setLoading(false);
      setError(null);
      return;
    }

    let disposed = false;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (disposed) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        persistentStream = mediaStream;
        persistentError = null;
        setStream(mediaStream);
        setLoading(false);
      } catch (err) {
        if (disposed) return;

        let message = '无法访问摄像头，请检查设备连接和权限设置';
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            message = '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头';
          } else if (err.name === 'NotFoundError') {
            message = '未检测到摄像头设备，请确认摄像头已正确连接';
          } else if (err.name === 'NotReadableError') {
            message = '摄像头被其他程序占用，请关闭其他使用摄像头的应用后重试';
          }
        }

        persistentError = message;
        setError(message);
        setLoading(false);
      }
    }

    void startCamera();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (videoRef?.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  return { stream, loading, error };
}
