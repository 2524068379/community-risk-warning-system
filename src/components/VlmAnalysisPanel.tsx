import { useMemo } from 'react';
import { Progress, Space, Tag } from 'antd';
import type { AnalysisValidity, VlmAnalysis, VlmModelSource } from '@/types';
import { riskGradeColorMap } from '@/utils/risk';
import { getVlmDisplayedSummary } from '@/utils/vlmAnalysisView';

interface VlmAnalysisPanelProps {
  analysis: VlmAnalysis;
  variant?: 'full' | 'compact' | 'summary';
  validity?: AnalysisValidity;
  modelSource?: VlmModelSource;
  errorMessage?: string | null;
}

const sourceLabels: Record<VlmModelSource, string> = {
  local: '本地模型',
  cloud: '云端模型',
  'cloud-fallback': '云端回退',
  unknown: '来源未知'
};

export function VlmAnalysisPanel({
  analysis,
  variant = 'full',
  validity = 'unknown',
  modelSource = 'unknown',
  errorMessage
}: VlmAnalysisPanelProps) {
  const hasResult = validity === 'valid' || validity === 'stale';
  const resultStatus = validity === 'valid'
    ? {
        color: analysis.hasRisk ? 'error' : 'success',
        label: analysis.hasRisk ? '存在风险' : '未发现风险'
      }
    : validity === 'stale'
      ? { color: 'warning', label: '结果已过期' }
      : validity === 'error'
        ? { color: 'error', label: '结果不可用' }
        : { color: 'default', label: '等待分析' };
  const displayedSummary = getVlmDisplayedSummary(analysis.summary, validity, errorMessage);

  const insightItems = useMemo(() => [
    { label: '是否存在风险', value: hasResult ? (analysis.hasRisk ? '是' : '否') : '待分析' },
    { label: '置信度', value: hasResult ? `${Math.round(analysis.confidence * 100)}%` : '待分析' },
    {
      label: '人员徘徊',
      value: typeof analysis.hasLoitering === 'boolean' ? (analysis.hasLoitering ? '是' : '否') : '待分析'
    },
    {
      label: '异常聚集',
      value: typeof analysis.hasGathering === 'boolean' ? (analysis.hasGathering ? '是' : '否') : '待分析'
    },
    {
      label: '人员跌倒',
      value: typeof analysis.hasFallen === 'boolean' ? (analysis.hasFallen ? '是' : '否') : '待分析'
    }
  ], [hasResult, analysis.hasRisk, analysis.confidence, analysis.hasLoitering, analysis.hasGathering, analysis.hasFallen]);

  const visibleItems =
    variant === 'full' ? insightItems : variant === 'compact' ? insightItems.slice(0, 4) : insightItems.slice(0, 3);

  const isCompact = variant === 'compact';

  if (isCompact) {
    return (
      <div className="vlm-panel compact">
        <div className="vlm-compact-scorebar">
          <div className="vlm-compact-score-block">
            <span className="vlm-compact-score-num" style={{ color: riskGradeColorMap[analysis.level] }}>
              {hasResult ? analysis.riskScore : '--'}
            </span>
            <span className="vlm-score-label">综合风险分</span>
          </div>
          <div className="vlm-compact-tags">
            <Tag color={hasResult ? riskGradeColorMap[analysis.level] : 'default'}>
              等级 {hasResult ? analysis.level : '--'}
            </Tag>
            <Tag color={resultStatus.color}>{resultStatus.label}</Tag>
            {validity === 'valid' ? <Tag color={modelSource === 'local' ? 'processing' : 'warning'}>{sourceLabels[modelSource]}</Tag> : null}
          </div>
        </div>

        <div className="vlm-insight-grid">
          {visibleItems.map((item) => (
            <div key={item.label} className="vlm-stat-tile">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
          <div className="vlm-summary-box">
            <span>模型摘要</span>
            <p>{displayedSummary}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`vlm-panel ${variant !== 'full' ? variant : ''}`}>
      <div className="vlm-header">
        <div>
          <div className="vlm-eyebrow">视觉语言模型分析</div>
          <div className="vlm-title">{variant === 'summary' ? 'VLM 风险摘要' : 'VLM 实时数据板块'}</div>
        </div>
        <Space size={4}>
          <Tag color={hasResult ? riskGradeColorMap[analysis.level] : 'default'}>
            等级 {hasResult ? analysis.level : '--'}
          </Tag>
          <Tag color={resultStatus.color}>{resultStatus.label}</Tag>
          {validity === 'valid' ? <Tag color={modelSource === 'local' ? 'processing' : 'warning'}>{sourceLabels[modelSource]}</Tag> : null}
        </Space>
      </div>

      <div className="vlm-main-grid">
        <div className="vlm-score-box">
          <div className="vlm-score">{hasResult ? analysis.riskScore : '--'}</div>
          <div className="vlm-score-label">综合风险分</div>
          <Progress
            type="dashboard"
            percent={hasResult ? analysis.riskScore : 0}
            size={variant === 'full' ? 110 : 84}
            strokeColor={riskGradeColorMap[analysis.level]}
            trailColor="rgba(255,255,255,0.06)"
            format={() => hasResult ? `${analysis.level}级` : '--'}
          />
        </div>

        <div className="vlm-insight-grid">
          {visibleItems.map((item) => (
            <div key={item.label} className="vlm-stat-tile">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
          <div className="vlm-summary-box">
            <span>模型摘要</span>
            <p>{displayedSummary}</p>
          </div>
        </div>
      </div>

      {variant === 'full' ? (
        <>
          <div className="panel-dual-grid">
            <div className="fake-chart-box">
              <div className="fake-chart-title">风险构成</div>
              <div className="breakdown-list">
                {analysis.breakdown.map((item) => (
                  <div key={item.label} className="breakdown-item">
                    <span>{item.label}</span>
                    <strong>{item.value}%</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="fake-chart-box">
              <div className="fake-chart-title">风险趋势</div>
              <div className="trend-line">
                {analysis.trend.map((item) => (
                  <div key={item.time} className="trend-node">
                    <span className="trend-point" style={{ bottom: `${item.value}%` }} />
                    <small>{item.time}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="timeline-box">
            <div className="fake-chart-title">证据时间轴</div>
            {analysis.evidenceTimeline.map((item) => (
              <div key={item} className="timeline-item">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
