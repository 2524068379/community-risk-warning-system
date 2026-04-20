import { Alert, Button, Empty, Space, Tag } from 'antd';
import mpegts from 'mpegts.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StreamType } from '@/types';
import { mediaEventToPlayerStatus, type LivePlayerStatus } from '@/components/player/playbackStatus';

interface LiveVideoPlayerProps {
  url?: string;
  type?: StreamType;
  posterText?: string;
}

export function LiveVideoPlayer({ url, type = 'flv', posterText }: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<LivePlayerStatus>('idle');
  const [retryToken, setRetryToken] = useState(0);

  const supportText = useMemo(() => {
    if (type === 'flv' || type === 'mpegts') {
      return mpegts.getFeatureList().mseLivePlayback ? '支持 MSE' : '不支持 MSE';
    }

    return '原生播放';
  }, [type]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(undefined);
    setStatus('ready');

    if (!url) {
      return;
    }

    const handleMediaEvent = (event: Event) => {
      const nextStatus = mediaEventToPlayerStatus(event.type);
      setStatus(nextStatus);

      if (nextStatus === 'error') {
        setError(video.error?.message || '视频播放失败，请检查流地址或编码格式。');
      }
    };

    const mediaEvents = ['canplay', 'playing', 'waiting', 'stalled', 'error'] as const;
    mediaEvents.forEach((eventName) => video.addEventListener(eventName, handleMediaEvent));

    if ((type === 'flv' || type === 'mpegts') && mpegts.getFeatureList().mseLivePlayback) {
      try {
        const player = mpegts.createPlayer(
          {
            type: type === 'flv' ? 'flv' : 'mpegts',
            isLive: true,
            url
          },
          {
            enableWorker: true,
            liveBufferLatencyChasing: true,
            lazyLoad: false,
            fixAudioTimestampGap: false
          }
        );

        playerRef.current = player;
        player.attachMediaElement(video);
        player.on(mpegts.Events.ERROR, (_errorType, errorDetail) => {
          setError(`视频流播放失败：${String(errorDetail || '未知错误')}`);
          setStatus('error');
        });
        player.load();
        Promise.resolve(player.play()).catch((playError) => {
          setError(playError instanceof Error ? playError.message : '视频播放启动失败');
          setStatus('error');
        });
      } catch (playerError) {
        setError(playerError instanceof Error ? playerError.message : '视频播放器初始化失败');
        setStatus('error');
      }

      return () => {
        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current.unload();
          playerRef.current.detachMediaElement();
          playerRef.current.destroy();
          playerRef.current = null;
        }
        mediaEvents.forEach((eventName) => video.removeEventListener(eventName, handleMediaEvent));
      };
    }

    if (type === 'flv' || type === 'mpegts') {
      setError('当前浏览器环境不支持 MSE，无法播放 FLV/MPEG-TS 实时流。');
      setStatus('error');
      mediaEvents.forEach((eventName) => video.removeEventListener(eventName, handleMediaEvent));
      return;
    }

    video.src = url;
    video.play().catch((playError) => {
      setError(playError instanceof Error ? playError.message : '视频播放启动失败');
      setStatus('error');
    });

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      mediaEvents.forEach((eventName) => video.removeEventListener(eventName, handleMediaEvent));
    };
  }, [retryToken, type, url]);

  return (
    <div className="live-player-shell">
      <div className="live-player-topbar">
        <Space size={4} wrap>
          <Tag color="processing" style={{ fontSize: 11 }}>{type.toUpperCase()}</Tag>
          <Tag color={status === 'playing' ? 'success' : status === 'error' ? 'error' : status === 'buffering' ? 'warning' : 'default'} style={{ fontSize: 11 }}>
            {status === 'playing' ? '播放中' : status === 'error' ? '异常' : status === 'buffering' ? '缓冲中' : '待连接'}
          </Tag>
          <Tag style={{ fontSize: 11 }}>{supportText}</Tag>
        </Space>
        {url ? (
          <Button size="small" onClick={() => setRetryToken((value) => value + 1)}>
            重试
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert type="error" showIcon message="播放器初始化失败" description={error} />
      ) : null}

      <div className="live-player-stage">
        {url ? (
          <video ref={videoRef} muted playsInline className="live-video" />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={posterText || '未配置实时视频流地址'}
          />
        )}
        <div className="live-stage-overlay" />
      </div>
    </div>
  );
}
