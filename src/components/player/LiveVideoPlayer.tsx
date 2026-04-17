import { Alert, Button, Empty, Space, Tag } from 'antd';
import mpegts from 'mpegts.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StreamType } from '@/types';

interface LiveVideoPlayerProps {
  url?: string;
  type?: StreamType;
  posterText?: string;
}

export function LiveVideoPlayer({ url, type = 'flv', posterText }: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<'idle' | 'ready' | 'playing' | 'error'>('idle');

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
        player.load();
        Promise.resolve(player.play()).catch(() => undefined);
        setStatus('playing');
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
      };
    }

    video.src = url;
    video.play().catch(() => undefined);
    setStatus('playing');

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [type, url]);

  return (
    <div className="live-player-shell">
      <div className="live-player-topbar">
        <Space size={4} wrap>
          <Tag color="processing" style={{ fontSize: 11 }}>{type.toUpperCase()}</Tag>
          <Tag color={status === 'playing' ? 'success' : status === 'error' ? 'error' : 'default'} style={{ fontSize: 11 }}>
            {status === 'playing' ? '播放中' : status === 'error' ? '异常' : '待连接'}
          </Tag>
          <Tag style={{ fontSize: 11 }}>{supportText}</Tag>
        </Space>
        {url ? (
          <Button size="small" onClick={() => videoRef.current?.play().catch(() => undefined)}>
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
