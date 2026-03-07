import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Button, Space, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../api/request';

function Logs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/logs?limit=100');
      setLogs(res.data.data || []);
    } catch (error) {
      message.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'success' ? 'green' : status === 'failed' ? 'red' : 'blue'}>
          {status}
        </Tag>
      )
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 100,
      render: (ms) => ms ? `${ms}ms` : '-'
    }
  ];

  const filteredLogs = filter
    ? logs.filter(log =>
        log.task_id?.includes(filter) ||
        log.message?.includes(filter) ||
        log.status?.includes(filter)
      )
    : logs;

  return (
    <div>
      <Card
        title="执行日志"
        extra={
          <Space>
            <Input
              placeholder="搜索任务 ID、消息、状态..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadLogs}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredLogs}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Card title="💡 说明" style={{ marginTop: 24 }}>
        <ul>
          <li>日志保留最近的 100 条记录</li>
          <li>可以使用搜索框过滤日志</li>
          <li>点击刷新按钮重新加载日志</li>
          <li>状态说明：success（成功）、failed（失败）、skipped（跳过）</li>
        </ul>
      </Card>
    </div>
  );
}

export default Logs;
