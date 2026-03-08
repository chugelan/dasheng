import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Space, message, Alert, Tag } from 'antd';
import { CloudSyncOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../api/request';

function Settings() {
  const [version, setVersion] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // 加载版本信息
      const versionRes = await api.get('/version');
      setVersion(versionRes.data.data);
      
      // 加载健康状态
      const healthRes = await api.get('/health');
      setHealth(healthRes.data.data);
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      message.loading('正在备份数据库...', 0);
      await api.post('/backup');
      message.destroy();
      message.success('备份成功');
    } catch (error) {
      message.destroy();
      message.error('备份失败');
    }
  };

  const handleIncrementVersion = async () => {
    try {
      await api.post('/version/increment');
      message.success('版本号已更新');
      loadSettings();
    } catch (error) {
      message.error('更新版本失败');
    }
  };

  return (
    <div>
      <Alert
        message="系统设置"
        description="查看系统信息、版本号、健康状态等"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        icon={<InfoCircleOutlined />}
      />

      <Card title="📊 系统信息">
        <Descriptions column={2} bordered>
          <Descriptions.Item label="系统状态">
            <Tag color={health?.status === 'healthy' ? 'green' : 'red'}>
              {health?.status || '未知'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="运行时长">
            {health?.uptime ? `${(health.uptime / 60).toFixed(1)} 分钟` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="系统版本">
            v{version?.version || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Build 号">
            {version?.build_number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最后更新">
            {version?.last_updated ? new Date(version.last_updated).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="检查时间">
            {health?.timestamp ? new Date(health.timestamp).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="🛠️ 操作" style={{ marginTop: 24 }}>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleBackup}
          >
            备份数据库
          </Button>
          <Button
            icon={<CloudSyncOutlined />}
            onClick={handleIncrementVersion}
          >
            增加版本号
          </Button>
          <Button onClick={loadSettings}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card title="💡 说明" style={{ marginTop: 24 }}>
        <ul>
          <li><strong>备份数据库：</strong> 将当前数据库备份到 data/backups 目录</li>
          <li><strong>增加版本号：</strong> 手动增加系统版本号（Build 号 +1）</li>
          <li><strong>刷新：</strong> 重新加载系统信息</li>
          <li>系统状态为 <Tag color="green">healthy</Tag> 表示服务运行正常</li>
        </ul>
      </Card>

      <Card title="📝 环境变量" style={{ marginTop: 24 }}>
        <Alert
          message="环境变量配置在 backend/config/.env 文件中"
          description={
            <div style={{ marginTop: 8 }}>
              <div>• ORDER_USERNAME - 订单系统用户名</div>
              <div>• ORDER_PASSWORD - 订单系统密码</div>
              <div>• CHROME_PATH - Chrome 浏览器路径</div>
              <div>• FEISHU_WEBHOOK_URL - 飞书 Webhook 地址</div>
            </div>
          }
          type="warning"
          showIcon
        />
      </Card>
    </div>
  );
}

export default Settings;
