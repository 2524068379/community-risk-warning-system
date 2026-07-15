import type { AnalysisValidity } from '@/types';

export function getVlmDisplayedSummary(
  summary: string,
  validity: AnalysisValidity,
  errorMessage?: string | null
): string {
  if (validity === 'valid' || validity === 'stale') {
    return summary;
  }

  if (validity === 'error') {
    return errorMessage?.trim() || '本次分析失败，未生成可用结果，系统将自动重试。';
  }

  return '等待摄像头画面与首次分析...';
}
