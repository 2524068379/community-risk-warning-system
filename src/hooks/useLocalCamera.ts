import { useCallback, useEffect, useState } from 'react';

export function useLocalCamera(videoRef?: React.RefObject<HTMLVideoElement | null>) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let disposed = false;
    let ownedStream: MediaStream | null = null;

    setLoading(true);
    setError(null);

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('当前环境不支持摄像头访问');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (disposed) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        ownedStream = mediaStream;
        const handleTrackEnded = () => {
          if (disposed) return;
          setStream(null);
          setError('摄像头连接已中断，请检查设备后重试');
          setLoading(false);
        };
        mediaStream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', handleTrackEnded, { once: true });
        });

        setStream(mediaStream);
        setError(null);
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

        setError(message);
        setStream(null);
        setLoading(false);
      }
    }

    void startCamera();

    return () => {
      disposed = true;
      ownedStream?.getTracks().forEach((track) => track.stop());
      if (videoRef?.current?.srcObject === ownedStream) {
        videoRef.current.srcObject = null;
      }
    };
  }, [retryToken, videoRef]);

  useEffect(() => {
    if (videoRef?.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  return { stream, loading, error, retry };
}
