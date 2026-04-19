import { Tag } from 'antd';
import { CameraMapPanel } from '@/components/CameraMapPanel';
import { VlmAnalysisPanel } from '@/components/VlmAnalysisPanel';
import { useAppStore } from '@/store/useAppStore';
import { equipmentStats, riskLevelStats, eventTypeStats } from '@/data/mock';
import { riskGradeColorMap } from '@/utils/risk';

export function OverviewPage() {
  const { cameras, activeCameraId, events, analysis, setActiveCamera, selectEvent } = useAppStore();

  const sortedEvents = [...events].sort((a, b) => b.riskScore - a.riskScore);
  const maxEventCount = Math.max(...eventTypeStats.map((item) => item.count));

  const tickerItems = events.map((event) => `${event.occurredAt} ${event.cameraName} ${event.title}`).join('    ●    ');
  const tickerText = `${tickerItems}    ●    ${tickerItems}`;

  return (
    <>
      <div className="left-col">
        <div className="panel">
          <div className="panel-title">设备状态分析</div>
          <div className="status-grid">
            {equipmentStats.map((item) => (
              <div key={item.label} className="status-card">
                <div className="status-card-icon">{item.icon}</div>
                <div className="status-card-value" style={{ color: item.color }}>{item.value}</div>
                <div className="status-card-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">风险等级分布</div>
          <div className="risk-level-list">
            {riskLevelStats.map((item) => (
              <div key={item.level} className="risk-level-item">
                <div className="risk-level-color" style={{ background: item.color }} />
                <div className="risk-level-info">
                  <div className="risk-level-name">{item.level}</div>
                  <div className="risk-level-bar-bg">
                    <div className="risk-level-bar" style={{ width: `${item.percent}%`, background: item.color }} />
                  </div>
                </div>
                <div className="risk-level-count">{item.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">事件类型统计</div>
          <div className="bar-chart">
            {eventTypeStats.map((item) => (
              <div key={item.type} className="bar-chart-item">
                <div className="bar-chart-label">{item.type}</div>
                <div className="bar-chart-track">
                  <div className="bar-chart-fill" style={{ width: `${(item.count / maxEventCount) * 100}%`, background: item.color }}>
                    <span className="bar-chart-value">{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="center-col">
        <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">GIS 联动与点位态势</div>
          <div className="map-container">
            <CameraMapPanel
              cameras={cameras}
              activeCameraId={activeCameraId}
              onSelect={setActiveCamera}
              mode="display"
            />
          </div>
        </div>
        <div className="alert-ticker">
          <div className="alert-ticker-label">⚡ 实时预警</div>
          <div className="alert-ticker-content">
            <div className="alert-ticker-scroll">{tickerText}</div>
          </div>
        </div>
      </div>

      <div className="right-col">
        <div className="panel">
          <div className="panel-title">VLM 实时研判</div>
          <VlmAnalysisPanel analysis={analysis} variant="summary" />
        </div>

        <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">预警事件排行</div>
          <div className="event-rank-list">
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                className={`event-rank-item ${event.id === events[0]?.id ? 'active' : ''}`}
                onClick={() => selectEvent(event.id)}
              >
                <div className={`event-rank-num ${index < 3 ? 'top-3' : ''}`}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="event-rank-info">
                  <div className="event-rank-title">{event.title}</div>
                  <div className="event-rank-meta">{event.cameraName} · {event.occurredAt}</div>
                </div>
                <div className="event-rank-score">{event.riskScore}</div>
                <Tag
                  color={event.level === 'A' ? 'error' : event.level === 'B' ? 'warning' : 'processing'}
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {event.level}级
                </Tag>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">风险趋势</div>
          <div className="trend-chart">
            {analysis.trend.map((point) => (
              <div key={point.time} className="trend-node">
                <span className="trend-point" style={{ bottom: `${point.value}%` }} />
                <span className="trend-label">{point.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
