import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  SettingOutlined,
  RobotOutlined,
  CameraOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = AntLayout;

function Layout() {
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>
    },
    {
      key: '/tasks',
      icon: <ThunderboltOutlined />,
      label: <Link to="/tasks">任务管理</Link>
    },
    {
      key: '/screenshots',
      icon: <CameraOutlined />,
      label: <Link to="/screenshots">截图管理</Link>
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: <Link to="/logs">执行日志</Link>
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">系统设置</Link>
    }
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark">
        <div style={{
          height: 32,
          margin: 16,
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold'
        }}>
          <RobotOutlined style={{ marginRight: 8 }} />
          AutoOps Master
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <AntLayout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0 }}>自动化系统管理后台</h2>
          <span style={{ color: '#666' }}>v1.0.0</span>
        </Header>
        <Content style={{ margin: '24px 16px' }}>
          <div style={{
            padding: 24,
            minHeight: 360,
            background: colorBgContainer,
            borderRadius: borderRadiusLG
          }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

export default Layout;
