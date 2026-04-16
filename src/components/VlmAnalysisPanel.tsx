import { Button, Divider, Progress, Space, Tag } from 'antd';
import { BellOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FileProtectOutlined } from '@ant-design/icons';
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
        <Space>
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
            size={compact ? 120 : 160}
            strokeColor={riskGradeColorMap[analysis.level]}
            trailColor="rgba(255,255,255,0.08)"
            format={() => `${analysis.level}级`}
          />
        </div>

        <div className="vlm-list-box">
          <div className="analysis-row">
            <span>是否存在风险</span>
            <strong>{analysis.hasRisk ? '是' : '否'}</strong>
          </div>
          <div className="analysis-row">
            <span>置信度</span>
            <strong>{Math.round(analysis.confidence * 100)}%</strong>
          </div>
          <div className="analysis-row">
            <span>是否佩戴牵引装置</span>
            <strong>{typeof analysis.hasLeash === 'boolean' ? (analysis.hasLeash ? '是' : '否') : '待分析'}</strong>
          </div>
          <div className="analysis-row">
            <span>是否存在异常音频</span>
            <strong>{typeof analysis.hasBark === 'boolean' ? (analysis.hasBark ? '是' : '否') : '待接入'}</strong>
          </div>
          <div className="analysis-row">
            <span>是否存在附加防护</span>
            <strong>{typeof analysis.hasMuzzle === 'boolean' ? (analysis.hasMuzzle ? '是' : '否') : '待接入'}</strong>
          </div>
          <div className="analysis-row full-row">
            <span>模型摘要</span>
            <p>{analysis.summary}</p>
          </div>
        </div>
      </div>

      <Divider style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <div className="panel-dual-grid">
        <div className="fake-chart-box">
          <div className="fake-chart-title">风险构成环形图（占位）</div>
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
          <div className="fake-chart-title">风险趋势折线图（占位）</div>
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

      <Divider style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <div className="timeline-box">
        <div className="fake-chart-title">证据时间轴</div>
        {analysis.evidenceTimeline.map((item) => (
          <div key={item} className="timeline-item">
            <CheckCircleOutlined />
            <span>{item}</span>
          </div>
        ))}
      </div>

      {!compact ? (
        <div className="vlm-actions">
          <Button icon={<FileProtectOutlined />}>生成证据包</Button>
          <Button icon={<BellOutlined />} type="primary">
            推送处置
          </Button>
          <Button icon={<ExclamationCircleOutlined />}>人工复核</Button>
        </div>
      ) : null}
    </div>
  );
}
