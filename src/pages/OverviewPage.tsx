import { CameraMapPanel } from '@/components/CameraMapPanel';
import { VlmAnalysisPanel } from '@/components/VlmAnalysisPanel';
import { VideoPanel } from '@/components/VideoPanel';
import { useAppStore } from '@/store/useAppStore';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export function OverviewPage() {
  const { cameras, activeCameraId, analysis, setActiveCamera } = useAppStore();

  const activeCamera = cameras.find((c) => c.id === activeCameraId) || cameras[0];

  return (
    <div className="overview-grid">
      {/* LEFT COLUMN */}
      <div className="overview-left">
        <div className="panel" style={{ padding: 0, flex: 2, minHeight: 0 }}>
          {activeCamera && <VideoPanel camera={activeCamera} showInfoStrip={false} />}
        </div>

        <div className="panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="panel-title">VLM 实时数据</div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <VlmAnalysisPanel analysis={analysis} variant="compact" />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="overview-right">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="panel-title">主监控地图 (显示摄像头位置)</div>
          <div className="map-container">
            <CameraMapPanel
              cameras={cameras}
              activeCameraId={activeCameraId}
              onSelect={setActiveCamera}
              mode="display"
            />
          </div>
        </div>

        <div className="panel" style={{ flex: 1, minHeight: 0 }}>
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
                      innerRadius="50%"
                      outerRadius="80%"
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {analysis.breakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={['#00c3ff', '#3b82f6', '#ff8c00', '#f43f5e'][index % 4]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgba(8, 15, 29, 0.9)', border: '1px solid rgba(0, 195, 255, 0.2)' }}
                      itemStyle={{ color: '#fff' }}
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
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#00c3ff"
                      strokeWidth={3}
                      dot={{ fill: '#00c3ff', stroke: '#080f1d', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
