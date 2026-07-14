import { Tag } from 'antd';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="brand-logo">险</div>
          <div className="brand-block">
            <div className="brand-title">社区风险预警监控系统</div>
            <div className="brand-subtitle">VLM + AGENT SYSTEM</div>
          </div>
        </div>

        <div className="header-center">
          <NavLink to="/monitor" className={({ isActive }) => `header-nav-btn ${isActive ? 'active' : ''}`}>
            监控选择
          </NavLink>
          <NavLink to="/overview" className={({ isActive }) => `header-nav-btn ${isActive ? 'active' : ''}`}>
            总览
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => `header-nav-btn ${isActive ? 'active' : ''}`}>
            重点预警
          </NavLink>
        </div>

        <div className="header-right">
          <div className="header-datetime">
            <div className="header-clock">{formatTime(now)}</div>
            <div className="header-date">{formatDate(now)}</div>
          </div>
          <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
            本地演示模式
          </Tag>
        </div>
      </header>

      <main className="dashboard-body">
        <Outlet />
      </main>
    </div>
  );
}
