import { Progress, Space, Tag } from 'antd';
import type { VlmAnalysis } from '@/types';
import { riskGradeColorMap } from '@/utils/risk';

interface VlmAnalysisPanelProps {
  analysis: VlmAnalysis;
  variant?: 'full' | 'compact' | 'summary';
}

export function VlmAnalysisPanel({ analysis, variant = 'full' }: VlmAnalysisPanelProps) {
  const insightItems = [
    { label: '是否存在风险', value: analysis.hasRisk ? '是' : '否' },
    { label: '置信度', value: `${Math.round(analysis.confidence * 100)}%` },
    {
      label: '牵引装置',
      value: typeof analysis.hasLeash === 'boolean' ? (analysis.hasLeash ? '是' : '否') : '待分析'
    },
    {
      label: '异常音频',
      value: typeof analysis.hasBark === 'boolean' ? (analysis.hasBark ? '是' : '否') : '待接入'
    },
    {
      label: '附加防护',
      value: typeof analysis.hasMuzzle === 'boolean' ? (analysis.hasMuzzle ? '是' : '否') : '待接入'
    }
  ];

  const visibleItems =
    variant === 'full' ? insightItems : variant === 'compact' ? insightItems.slice(0, 4) : insightItems.slice(0, 3);

  const isCompact = variant === 'compact';

  if (isCompact) {
    return (
      <div className="vlm-panel compact">
        <div className="vlm-compact-scorebar">
          <div className="vlm-compact-score-block">
            <span className="vlm-compact-score-num" style={{ color: riskGradeColorMap[analysis.level] }}>
              {analysis.riskScore}
            </span>
            <span className="vlm-score-label">综合风险分</span>
          </div>
          <div className="vlm-compact-tags">
            <Tag color={riskGradeColorMap[analysis.level]}>等级 {analysis.level}</Tag>
            <Tag color={analysis.hasRisk ? 'error' : 'success'}>
              {analysis.hasRisk ? '存在风险' : '风险可控'}
            </Tag>
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
            <p>{analysis.summary}</p>
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
          <Tag color={riskGradeColorMap[analysis.level]}>等级 {analysis.level}</Tag>
          <Tag color={analysis.hasRisk ? 'error' : 'success'}>
            {analysis.hasRisk ? '存在风险' : '风险可控'}
          </Tag>
        </Space>
      </div>

      <div className="vlm-main-grid">
        <div className="vlm-score-box">
          <div className="vlm-score">{analysis.riskScore}</div>
          <div className="vlm-score-label">综合风险分</div>
          <Progress
            type="dashboard"
            percent={analysis.riskScore}
            size={variant === 'full' ? 110 : 84}
            strokeColor={riskGradeColorMap[analysis.level]}
            trailColor="rgba(255,255,255,0.06)"
            format={() => `${analysis.level}级`}
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
            <p>{analysis.summary}</p>
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
