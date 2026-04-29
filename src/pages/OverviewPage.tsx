import { useRef, useEffect } from 'react';
import { Tag } from 'antd';
import { CameraMapPanel } from '@/components/CameraMapPanel';
import { VlmAnalysisPanel } from '@/components/VlmAnalysisPanel';
import { useAppStore } from '@/store/useAppStore';
import { useLocalCamera } from '@/hooks/useLocalCamera';
import { useVlmAnalysis } from '@/hooks/useVlmAnalysis';
import { getVlmStatusView } from '@/utils/vlmStatusView';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const RISK_COLORS = ['#00c3ff', '#3b82f6', '#ff8c00', '#f43f5e'];
const HIGH_RISK_COLOR = '#f43f5e';
const NORMAL_COLOR = '#00c3ff';
const HIGH_RISK_THRESHOLD = 70;
const RADIAN = Math.PI / 180;

function renderRiskDot(props: any) {
  const { cx, cy, payload, index } = props;
  const isHigh = payload.value >= HIGH_RISK_THRESHOLD;
  return (
    <circle
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={isHigh ? 5 : 4}
      fill={isHigh ? HIGH_RISK_COLOR : NORMAL_COLOR}
      stroke={isHigh ? '#fff' : '#080f1d'}
      strokeWidth={2}
    />
  );
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, name, percent }: any) {
  const radius = outerRadius * 1.35;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="rgba(255,255,255,0.85)" textAnchor="middle" dominantBaseline="central" fontSize={11}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

export function OverviewPage() {
  const { cameras, activeCameraId, analysis, setActiveCamera, vlmStatus } = useAppStore();
  const { stream, loading, error } = useLocalCamera();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);


  const activeCamera = cameras.find((c) => c.id === activeCameraId);

  useVlmAnalysis({
    videoRef,
    cameraId: activeCamera?.id ?? 'LOCAL',
    scene: activeCamera?.scene ?? '本地摄像头',
    enabled: !!stream
  });

  const statusCfg = getVlmStatusView(vlmStatus, 'overview');

  return (
    <div className="overview-grid">
      {/* 左上：视频监控 */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="video-toolbar">
          <div>
            <div className="video-title">视频监控</div>
            <div className="video-subtitle">本地摄像头实时画面</div>
          </div>
          <Tag color={statusCfg.color} style={{ fontSize: 11 }}>{statusCfg.text}</Tag>
        </div>
        <div className="video-frame real-video-frame">
          {loading && (
            <div className="monitor-video-loading">正在启动摄像头…</div>
          )}
          {error && (
            <div className="monitor-video-error">{error}</div>
          )}
          {stream && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="monitor-video-element"
            />
          )}
        </div>
      </div>

      {/* 右上：VLM 实时数据 */}
      <div className="panel">
        <div className="panel-title">
          <span>VLM 实时数据</span>
          <Tag color={statusCfg.color} style={{ marginLeft: 'auto', fontSize: 10 }}>{statusCfg.text}</Tag>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <VlmAnalysisPanel analysis={analysis} variant="compact" />
        </div>
      </div>

      {/* 左下：主监控地图 */}
      <div className="panel">
        <div className="panel-title">主监控地图</div>
        <div className="map-container">
          <CameraMapPanel
            cameras={cameras}
            activeCameraId={activeCameraId}
            onSelect={setActiveCamera}
            mode="display"
          />
        </div>
      </div>

      {/* 右下：数据分析板块 */}
      <div className="panel">
        <div className="panel-title">数据分析板块</div>
        <div style={{ flex: 1, display: 'flex', gap: '20px', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
              风险构成分析环形图
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analysis.breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius="42%"
                    outerRadius="68%"
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                    stroke="none"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {analysis.breakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />
                    ))}
                  </Pie>
                  <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={22} fontWeight={700}>
                    {analysis.riskScore}
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.45)" fontSize={10}>
                    风险评分
                  </text>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: 'rgba(8, 15, 29, 0.9)', border: '1px solid rgba(0, 195, 255, 0.2)' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value) => [`${value}%`, '占比']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', margin: '10px 0' }} />

          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
              风险趋势折线图
            </div>
            <div style={{ flex: 1, minHeight: 0, paddingRight: 10 }}>
              {analysis.trend.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                  等待数据…
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.trend}>
                  <XAxis
                    dataKey="time"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: 'rgba(8, 15, 29, 0.9)', border: '1px solid rgba(0, 195, 255, 0.2)' }}
                    itemStyle={{ color: '#00c3ff' }}
                    formatter={(value) => {
                      const v = Number(value ?? 0);
                      return [`${v}`, `风险评分${v >= HIGH_RISK_THRESHOLD ? ' (高危)' : ''}`];
                    }}
                  />
                  <ReferenceLine
                    y={HIGH_RISK_THRESHOLD}
                    stroke={HIGH_RISK_COLOR}
                    strokeDasharray="6 3"
                    strokeOpacity={0.6}
                    label={{ value: '高危线', position: 'right', fill: HIGH_RISK_COLOR, fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#00c3ff"
                    strokeWidth={3}
                    dot={renderRiskDot}
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: HIGH_RISK_COLOR }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
