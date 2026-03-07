import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Image, Popconfirm, message, Statistic, Row, Col, Progress } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ClearOutlined
} from '@ant-design/icons';
import api from '../api/request';

function Screenshots() {
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    size: 0,
    sizeFormatted: '0 B',
    expiringSoon: 0
  });

  useEffect(() => {
    loadScreenshots();
  }, []);

  const loadScreenshots = async () => {
    try {
      setLoading(true);
      
      // 加载截图列表
      const listRes = await api.get('/screenshots?limit=100');
      setScreenshots(listRes.data.data || []);
      
      // 加载统计
      const statsRes = await api.get('/screenshots/stats');
      setStats(statsRes.data.data);
    } catch (error) {
      console.error('加载失败:', error);
      message.error('加载截图失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      message.loading('正在清理过期截图...', 0);
      await api.post('/screenshots/cleanup');
      message.destroy();
      message.success('清理完成');
      loadScreenshots();
    } catch (error) {
      message.destroy();
      message.error('清理失败');
    }
  };

  const columns = [
    {
      title: '预览',
      dataIndex: 'file_path',
      key: 'preview',
      width: 100,
      render: (filePath) => (
        <Image
          width={60}
          height={60}
          src={`file://${filePath}`}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          style={{ objectFit: 'cover', borderRadius: 4 }}
        />
      )
    },
    {
      title: '任务 ID',
      dataIndex: 'task_id',
      key: 'task_id'
    },
    {
      title: '文件名',
      dataIndex: 'file_path',
      key: 'filename',
      render: (path) => {
        const filename = path.split('/').pop();
        return <code>{filename}</code>;
      }
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size) => {
        if (!size) return '-';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / 1024 / 1024).toFixed(1)} MB`;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (time) => {
        if (!time) return '-';
        const expires = new Date(time);
        const now = new Date();
        const isExpiring = expires - now < 2 * 60 * 60 * 1000; // 2 小时内
        
        return (
          <span>
            {expires.toLocaleString('zh-CN')}
            {isExpiring && <Tag color="orange" style={{ marginLeft: 8 }}>即将过期</Tag>}
          </span>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'cleaned',
      key: 'cleaned',
      render: (cleaned) => (
        <Tag color={cleaned ? 'default' : 'green'}>
          {cleaned ? '已清理' : '有效'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => window.open(`file://${record.file_path}`)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除此截图？"
            onConfirm={async () => {
              try {
                await api.post('/screenshots/cleanup', { taskId: record.task_id });
                message.success('删除成功');
                loadScreenshots();
              } catch (error) {
                message.error('删除失败');
              }
            }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="截图总数"
              value={stats.total}
              prefix={<CameraOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="存储空间"
              value={stats.sizeFormatted}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="即将过期"
              value={stats.expiringSoon}
              suffix="个"
              valueStyle={{ color: stats.expiringSoon > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ marginTop: 8 }}>
              <Progress
                percent={stats.total > 0 ? 
                  Math.min(100, (stats.expiringSoon / stats.total) * 100) : 0
                }
                status={stats.expiringSoon > 0 ? 'active' : 'normal'}
                format={(percent) => `${stats.expiringSoon} 个即将清理`}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 截图列表 */}
      <Card
        title="截图列表"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadScreenshots}
            >
              刷新
            </Button>
            <Popconfirm
              title="确定清理所有过期截图？"
              onConfirm={handleCleanup}
            >
              <Button
                danger
                icon={<ClearOutlined />}
              >
                清理过期截图
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={screenshots}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 说明 */}
      <Card title="💡 说明" style={{ marginTop: 24 }}>
        <ul>
          <li>截图会在创建后 2 小时自动清理</li>
          <li>可以手动点击"清理过期截图"按钮立即清理</li>
          <li>点击"查看"可以在浏览器中打开截图</li>
          <li>截图存储路径：<code>backend/logs/screenshots/</code></li>
        </ul>
      </Card>
    </div>
  );
}

export default Screenshots;
