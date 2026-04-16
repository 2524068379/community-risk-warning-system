import { Card } from 'antd';
import type { DashboardMetric } from '@/types';

export function MetricCard({ label, value, extra }: DashboardMetric) {
  return (
    <Card variant="borderless" className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {extra ? <div className="metric-extra">{extra}</div> : null}
    </Card>
  );
}
