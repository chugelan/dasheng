import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Table, Tag, Space, Button, Card, Statistic, Row, Col, message } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  PlusOutlined
} from '@ant-design/icons';
import api from '../api/request';

function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    loadTasks();
    loadVersion();
  }, []);

  const loadTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data.data || []);
    } catch (error) {
      message.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadVersion = async () => {
    try {
      const res = await api.get('/version');
      setVersion(res.data.data);
    } catch (error) {
      console.error('加载版本失败');
    }
  };

  const handleToggle = async (id, currentEnabled) => {
    try {
      await api.post(`/tasks/${id}/toggle`);
      message.success(currentEnabled ? '任务已禁用' : '任务已启用');
      loadTasks();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`确定要删除任务 "${name}" 吗？`)) return;
    
    try {
      await api.delete(`/tasks/${id}`);
      message.success('任务已删除');
      loadTasks();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleRun = async (id) => {
    try {
      message.loading('正在执行任务...', 0);
      await api.post(`/tasks/${id}/run`);
      message.destroy();
      message.success('任务执行成功');
      loadTasks();
    } catch (error) {
      message.destroy();
      message.error(`执行失败：${error.response?.data?.error || error.message}`);
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Link to={`/task/${record.id}`}>{name}</Link>
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '运行中' : '已停止'}
        </Tag>
      )
    },
    {
      title: '调度表达式',
      dataIndex: 'schedule',
      key: 'schedule'
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version) => `v${version}`
    },
    {
      title: '发布次数',
      dataIndex: 'publish_count',
      key: 'publish_count',
      render: (count) => `${count} 次`
    },
    {
      title: '上次执行',
      dataIndex: 'last_run_at',
      key: 'last_run_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
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
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={record.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => handleToggle(record.id, record.enabled)}
          >
            {record.enabled ? '停止' : '启动'}
          </Button>
          <Button
            type="text"
            icon={<ThunderboltOutlined />}
            onClick={() => handleRun(record.id)}
          >
            执行
          </Button>
          <Button
            type="text"
            icon={<EditOutlined />}
            component={Link}
            to={`/task/${record.id}`}
          >
            配置
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.name)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={tasks.length}
              prefix="📋"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={tasks.filter(t => t.enabled).length}
              valueStyle={{ color: '#3f8600' }}
              prefix="✅"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已停止"
              value={tasks.filter(t => !t.enabled).length}
              valueStyle={{ color: '#cf1322' }}
              prefix="⏸️"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="系统版本"
              value={version?.version || '-'}
              suffix={`(build ${version?.build_number || '-'})`}
              prefix="🚀"
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="任务列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />}>
            新建任务
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}

export default TaskList;
