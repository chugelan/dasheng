import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Spin, Alert } from 'antd';
import {
  DashboardOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  ThunderboltOutlined,
  CameraOutlined,
  CloudSyncOutlined
} from '@ant-design/icons';
import api from '../api/request';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    runningTasks: 0,
    stoppedTasks: 0,
    version: '1.0.0',
    buildNumber: 1
  });
  const [tasks, setTasks] = useState([]);
  const [screenshotStats, setScreenshotStats] = useState({
    total: 0,
    size: 0,
    sizeFormatted: '0 B',
    expiringSoon: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // 加载任务列表
      const tasksRes = await api.get('/tasks');
      const tasksData = tasksRes.data.data || [];
      setTasks(tasksData);
      
      // 统计任务
      const running = tasksData.filter(t => t.enabled).length;
      const stopped = tasksData.filter(t => !t.enabled).length;
      
      // 加载版本信息
      const versionRes = await api.get('/version');
      const versionData = versionRes.data.data;
      
      // 加载截图统计
      try {
        const screenshotRes = await api.get('/screenshots/stats');
        setScreenshotStats(screenshotRes.data.data);
      } catch (e) {
        console.log('截图统计加载失败');
      }
      
      setStats({
        totalTasks: tasksData.length,
        runningTasks: running,
        stoppedTasks: stopped,
        version: versionData.version || '1.0.0',
        buildNumber: versionData.build_number || 1
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <span style={{ fontWeight: 500 }}>
          <ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          {name}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => (
        <Tag icon={enabled ? <CheckCircleOutlined /> : <PauseCircleOutlined />} color={enabled ? 'green' : 'red'}>
          {enabled ? '运行中' : '已停止'}
        </Tag>
      )
    },
    {
      title: '调度表达式',
      dataIndex: 'schedule',
      key: 'schedule',
      render: (schedule) => (
        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
          {schedule}
        </code>
      )
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version) => `v${version || '1.0.0'}`
    },
    {
      title: '发布次数',
      dataIndex: 'publish_count',
      key: 'publish_count',
      render: (count) => `${count || 0} 次`
    },
    {
      title: '上次执行',
      dataIndex: 'last_run_at',
      key: 'last_run_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '未执行'
    },
    {
      title: '上次状态',
      dataIndex: 'last_status',
      key: 'last_status',
      render: (status) => {
        if (!status) return '-';
        return (
          <Tag color={status === 'success' ? 'green' : 'red'}>
            {status === 'success' ? '成功' : '失败'}
          </Tag>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<DashboardOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.runningTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已停止"
              value={stats.stoppedTasks}
              prefix={<PauseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="系统版本"
              value={stats.version}
              suffix={`(build ${stats.buildNumber})`}
              prefix={<CloudSyncOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 截图统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title={<><CameraOutlined style={{ marginRight: 8 }} />截图存储统计</>}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="截图总数"
                  value={screenshotStats.total}
                  suffix="个"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="存储空间"
                  value={screenshotStats.sizeFormatted}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="即将过期"
                  value={screenshotStats.expiringSoon}
                  suffix="个"
                  valueStyle={{ color: screenshotStats.expiringSoon > 0 ? '#faad14' : '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <div style={{ marginTop: 24 }}>
                  <Progress
                    percent={screenshotStats.total > 0 ? 
                      Math.min(100, (screenshotStats.expiringSoon / screenshotStats.total) * 100) : 0
                    }
                    status={screenshotStats.expiringSoon > 0 ? 'active' : 'normal'}
                    format={(percent) => `${screenshotStats.expiringSoon} 个即将清理`}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 任务列表 */}
      <Card title="任务列表">
        {tasks.length === 0 ? (
          <Alert
            message="暂无任务"
            description="请先创建任务，任务将在此处显示"
            type="info"
            showIcon
          />
        ) : (
          <Table
            columns={taskColumns}
            dataSource={tasks}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        )}
      </Card>

      {/* 飞书命令提示 */}
      <Card title="📱 飞书命令" style={{ marginTop: 24 }}>
        <Alert
          message="可以通过飞书机器人发送命令控制任务"
          description={
            <div style={{ marginTop: 8 }}>
              <div><code>/status</code> - 查看系统状态</div>
              <div><code>/tasks</code> - 查看任务列表</div>
              <div><code>/order run</code> - 执行订单监控</div>
              <div><code>/procurement run</code> - 执行景区采购</div>
              <div><code>/sync-scenic run</code> - 执行景点同步</div>
            </div>
          }
          type="success"
          showIcon
          style={{ marginTop: 12 }}
        />
      </Card>
    </div>
  );
}

export default Dashboard;
