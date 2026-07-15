import { describe, expect, it } from 'vitest';
import { getVlmDisplayedSummary } from './vlmAnalysisView';

describe('getVlmDisplayedSummary', () => {
  it('shows only a valid or stale model result', () => {
    expect(getVlmDisplayedSummary('当前有效结论', 'valid')).toBe('当前有效结论');
    expect(getVlmDisplayedSummary('最近一次有效结论', 'stale')).toBe('最近一次有效结论');
  });

  it('shows the real failure instead of the initial waiting summary', () => {
    expect(getVlmDisplayedSummary('等待 VLM 模型连接...', 'error', 'VLM 响应格式异常')).toBe(
      'VLM 响应格式异常'
    );
  });

  it('uses neutral placeholders when no result exists', () => {
    expect(getVlmDisplayedSummary('旧占位文案', 'unknown')).toBe('等待摄像头画面与首次分析...');
    expect(getVlmDisplayedSummary('旧占位文案', 'error')).toContain('本次分析失败');
  });
});
