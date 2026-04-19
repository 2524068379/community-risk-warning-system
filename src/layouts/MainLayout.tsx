import {
  BellOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { appPages } from '@/router/pages';
import { dashboardMetrics } from '@/data/mock';

function formatTime(date: Date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const w = weekDays[date.getDay()];
  return `${y}-${mo}-${d} 星期${w}`;
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <header className="screen-header">
        <div className="header-left">
          <div className="brand-logo">险</div>
          <div className="brand-block">
            <div className="brand-title">
              险封·社区风险预警平台
            </div>
            <div className="brand-subtitle">VLM + Agent 综合系统</div>
          </div>
        </div>

        <nav className="header-nav">
          {appPages.map((item) => (
            <button
              key={item.path}
              className={`nav-tab ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="header-right">
          <div className="header-metrics-strip">
            {dashboardMetrics.map((item) => (
              <div key={item.label} className="header-metric-item">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="header-divider" />
          <div className="header-status-pod">
            <span className="header-status-label">运行状态</span>
            <Tag color="success" style={{ margin: 0 }}>
              系统在线
            </Tag>
          </div>
          <div className="header-divider" />
          <div className="header-datetime">
            <div className="header-clock">{formatTime(now)}</div>
            <div className="header-date">{formatDate(now)}</div>
          </div>
          <div className="header-divider" />
          <Badge count={3} size="small">
            <div className="header-bell">
              <BellOutlined />
            </div>
          </Badge>
          <Avatar size="small" style={{ background: 'linear-gradient(135deg, #2f7bff, #00b5ff)' }}>
            管
          </Avatar>
        </div>
      </header>

      <main className="screen-content">
        <Outlet />
      </main>
    </div>
  );
}
