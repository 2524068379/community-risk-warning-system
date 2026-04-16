import { BellOutlined, DeploymentUnitOutlined, EyeOutlined, RadarChartOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: '/overview',
    icon: <EyeOutlined />,
    label: <Link to="/overview">总览</Link>
  },
  {
    key: '/monitor',
    icon: <DeploymentUnitOutlined />,
    label: <Link to="/monitor">监控选择</Link>
  },
  {
    key: '/alerts',
    icon: <BellOutlined />,
    label: <Link to="/alerts">重点预警</Link>
  },
  {
    key: '/model-center',
    icon: <RadarChartOutlined />,
    label: <Link to="/model-center">模型中心</Link>
  }
];

export function MainLayout() {
  const location = useLocation();

  return (
    <Layout className="app-shell">
      <Sider width={248} className="app-sider">
        <div className="brand-box">
          <div className="brand-logo">险</div>
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
              险封·社区风险预警平台
            </Typography.Title>
            <div className="brand-subtitle">VLM + Agent 综合系统</div>
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="app-menu"
        />
      </Sider>

      <Layout>
        <Header className="app-header">
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
              社区风险治理可视化终端
            </Typography.Title>
            <div className="header-subtitle">前端骨架版 · 可直接接入真实视频流 / 地图 / Qwen3.5 接口</div>
          </div>

          <Space size="middle">
            <Tag color="success">系统在线</Tag>
            <Badge count={3}>
              <Button shape="circle" icon={<BellOutlined />} />
            </Badge>
            <Avatar style={{ background: '#2f7bff' }}>管</Avatar>
          </Space>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
