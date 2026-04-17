import { Progress, Space, Tag } from 'antd';
import type { VlmAnalysis } from '@/types';
import { riskGradeColorMap } from '@/utils/risk';

interface VlmAnalysisPanelProps {
  analysis: VlmAnalysis;
  compact?: boolean;
}

export function VlmAnalysisPanel({ analysis, compact }: VlmAnalysisPanelProps) {
  return (
    <div className={`vlm-panel ${compact ? 'compact' : ''}`}>
      <div className="vlm-header">
        <div>
          <div className="vlm-eyebrow">视觉语言模型分析</div>
          <div className="vlm-title">VLM 实时数据板块</div>
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
            size={compact ? 90 : 110}
            strokeColor={riskGradeColorMap[analysis.level]}
            trailColor="rgba(255,255,255,0.06)"
            format={() => `${analysis.level}级`}
          />
        </div>

        <div className="vlm-insight-grid">
          <div className="vlm-stat-tile">
            <span>是否存在风险</span>
            <strong>{analysis.hasRisk ? '是' : '否'}</strong>
          </div>
          <div className="vlm-stat-tile">
            <span>置信度</span>
            <strong>{Math.round(analysis.confidence * 100)}%</strong>
          </div>
          <div className="vlm-stat-tile">
            <span>牵引装置</span>
            <strong>
              {typeof analysis.hasLeash === 'boolean' ? (analysis.hasLeash ? '是' : '否') : '待分析'}
            </strong>
          </div>
          <div className="vlm-stat-tile">
            <span>异常音频</span>
            <strong>
              {typeof analysis.hasBark === 'boolean' ? (analysis.hasBark ? '是' : '否') : '待接入'}
            </strong>
          </div>
          <div className="vlm-stat-tile">
            <span>附加防护</span>
            <strong>
              {typeof analysis.hasMuzzle === 'boolean' ? (analysis.hasMuzzle ? '是' : '否') : '待接入'}
            </strong>
          </div>
          <div className="vlm-summary-box">
            <span>模型摘要</span>
            <p>{analysis.summary}</p>
          </div>
        </div>
      </div>

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
    </div>
  );
}
