import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, message, Spin, Alert } from 'antd';
import { EditOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import api from '../api/request';

function TaskDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tasks/${id}`);
      setTask(res.data.data);
    } catch (error) {
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    try {
      await api.post(`/tasks/${id}/toggle`);
      message.success(task.enabled ? '任务已禁用' : '任务已启用');
      loadTask();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRun = async () => {
    try {
      message.loading('正在执行任务...', 0);
      await api.post(`/tasks/${id}/run`);
      message.destroy();
      message.success('任务执行成功');
    } catch (error) {
      message.destroy();
      message.error(`执行失败：${error.response?.data?.error || error.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!task) {
    return (
      <Alert
        message="任务不存在"
        description="找不到指定的任务"
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      <Card
        title={task.name}
        extra={
          <Space>
            <Button
              type={task.enabled ? 'default' : 'primary'}
              icon={task.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleToggle}
            >
              {task.enabled ? '停止' : '启动'}
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
            >
              执行
            </Button>
            <Button icon={<EditOutlined />}>
              编辑
            </Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="任务 ID">{task.id}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={task.enabled ? 'green' : 'red'}>
              {task.enabled ? '运行中' : '已停止'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="调度表达式">
            <code>{task.schedule}</code>
          </Descriptions.Item>
          <Descriptions.Item label="版本">v{task.version || '1.0.0'}</Descriptions.Item>
          <Descriptions.Item label="发布次数">{task.publish_count || 0} 次</Descriptions.Item>
          <Descriptions.Item label="上次执行">
            {task.last_run_at ? new Date(task.last_run_at).toLocaleString('zh-CN') : '未执行'}
          </Descriptions.Item>
          <Descriptions.Item label="上次状态">
            {task.last_status === 'success' ? (
              <Tag color="green">成功</Tag>
            ) : task.last_status === 'failed' ? (
              <Tag color="red">失败</Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Card title="配置信息" style={{ marginTop: 24 }}>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflow: 'auto' }}>
            {JSON.stringify(task.config, null, 2)}
          </pre>
        </Card>
      </Card>
    </div>
  );
}

export default TaskDetail;
