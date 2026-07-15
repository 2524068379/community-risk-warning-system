import type { VlmStatus } from '@/store/useAppStore';

type VlmStatusViewContext = 'overview' | 'monitor';

interface VlmStatusView {
  color: string;
  text: string;
}

const statusView: Record<VlmStatus, VlmStatusView> = {
  idle: { color: 'default', text: '等待触发' },
  loading: { color: 'processing', text: '连接中...' },
  analyzing: { color: 'processing', text: '分析中...' },
  ready: { color: 'success', text: 'VLM 在线' },
  'response-error': { color: 'warning', text: 'VLM 在线 · 响应异常' },
  error: { color: 'error', text: 'VLM 未连接' }
};

export function getVlmStatusView(
  status: VlmStatus,
  context: VlmStatusViewContext = 'overview'
): VlmStatusView {
  const view = statusView[status] ?? statusView.idle;
  if (context === 'monitor' && status === 'analyzing') {
    return { ...view, text: '分析中' };
  }
  return view;
}
