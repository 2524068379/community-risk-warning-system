import { describe, expect, it } from 'vitest';
import { getVlmStatusView } from './vlmStatusView';

describe('getVlmStatusView', () => {
  it('keeps overview status labels and colors unchanged', () => {
    expect(getVlmStatusView('idle', 'overview')).toEqual({ color: 'default', text: '等待连接' });
    expect(getVlmStatusView('loading', 'overview')).toEqual({ color: 'processing', text: '连接中...' });
    expect(getVlmStatusView('analyzing', 'overview')).toEqual({ color: 'processing', text: '分析中...' });
    expect(getVlmStatusView('ready', 'overview')).toEqual({ color: 'success', text: 'VLM 在线' });
    expect(getVlmStatusView('error', 'overview')).toEqual({ color: 'error', text: 'VLM 未连接' });
  });

  it('keeps monitor status labels and colors unchanged', () => {
    expect(getVlmStatusView('idle', 'monitor')).toEqual({ color: 'default', text: '等待连接' });
    expect(getVlmStatusView('loading', 'monitor')).toEqual({ color: 'processing', text: '连接中...' });
    expect(getVlmStatusView('analyzing', 'monitor')).toEqual({ color: 'processing', text: '分析中' });
    expect(getVlmStatusView('ready', 'monitor')).toEqual({ color: 'success', text: 'VLM 在线' });
    expect(getVlmStatusView('error', 'monitor')).toEqual({ color: 'error', text: 'VLM 未连接' });
  });
});
