/**
 * 通知模块 - 飞书
 * 支持 Webhook 和 API 两种方式
 */

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * 发送飞书通知
 */
async function send(notification) {
  const { taskName, status, message, data, version, duration, error } = notification;
  
  // 根据配置选择通知方式
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  const apiAppId = process.env.FEISHU_APP_ID;
  const apiAppSecret = process.env.FEISHU_APP_SECRET;
  
  // 优先使用 Webhook（简单场景）
  if (webhookUrl) {
    return sendViaWebhook(webhookUrl, notification);
  }
  
  // 使用 API（需要控制任务的场景）
  if (apiAppId && apiAppSecret) {
    return sendViaApi(notification);
  }
  
  logger.warn('飞书通知配置缺失，跳过通知');
}

/**
 * 通过 Webhook 发送
 */
async function sendViaWebhook(webhookUrl, notification) {
  const { taskName, status, message, data, version, duration, error } = notification;
  
  // 构建消息卡片
  const card = buildStatusCard(notification);
  
  try {
    const response = await axios.post(webhookUrl, {
      msg_type: 'interactive',
      card: card
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    logger.info('飞书 Webhook 通知发送成功');
    return { success: true };
  } catch (err) {
    logger.error('飞书 Webhook 通知发送失败:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * 通过飞书 API 发送（支持更多功能）
 */
async function sendViaApi(notification) {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const chatId = process.env.FEISHU_CHAT_ID;
  
  try {
    // 1. 获取 tenant_access_token
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      }
    );
    
    const tenantToken = tokenResponse.data.tenant_access_token;
    
    // 2. 发送消息
    const card = buildStatusCard(notification);
    
    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card)
      },
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Content-Type': 'application/json'
        },
        params: { receive_id_type: 'chat_id' }
      }
    );
    
    logger.info('飞书 API 通知发送成功');
    return { success: true };
  } catch (err) {
    logger.error('飞书 API 通知发送失败:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * 构建状态卡片
 */
function buildStatusCard(notification) {
  const { taskName, status, message, data, version, duration, error } = notification;
  
  const isSuccess = status === 'success';
  const statusColor = isSuccess ? 'green' : 'red';
  const statusText = isSuccess ? '✅ 成功' : '❌ 失败';
  const statusIcon = isSuccess ? '🎉' : '⚠️';
  
  // 数据预览（最多 5 条）
  let dataPreview = '';
  if (data && Array.isArray(data) && data.length > 0) {
    const preview = data.slice(0, 5);
    dataPreview = preview.map((item, i) => {
      const text = typeof item === 'object' 
        ? Object.values(item).slice(0, 3).join(' | ')
        : String(item);
      return `${i + 1}. ${text}`;
    }).join('\n');
    
    if (data.length > 5) {
      dataPreview += `\n... 还有 ${data.length - 5} 条`;
    }
  }
  
  return {
    config: {
      wide_screen_mode: true
    },
    header: {
      template: statusColor,
      title: {
        tag: 'plain_text',
        content: `${statusIcon} ${taskName}`
      }
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**状态：** ${statusText}\n**版本：** v${version}\n**耗时：** ${duration}ms`
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**执行结果：**\n${message || '无'}`
        }
      },
      dataPreview ? {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**数据预览：**\n${dataPreview}`
        }
      } : null,
      error ? {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**错误信息：**\n\`\`\`${error.split('\n')[0]}\`\`\``
        }
      } : null,
      {
        tag: 'hr'
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `AutoOps Master · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
          }
        ]
      }
    ].filter(Boolean)
  };
}

/**
 * 发送自定义消息（用于飞书控制任务的场景）
 */
async function sendCustomMessage(chatId, content, msgType = 'text') {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  try {
    // 获取 token
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: appId, app_secret: appSecret }
    );
    
    const tenantToken = tokenResponse.data.tenant_access_token;
    
    // 发送消息
    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      {
        receive_id: chatId,
        msg_type: msgType,
        content: typeof content === 'string' ? content : JSON.stringify(content)
      },
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Content-Type': 'application/json'
        },
        params: { receive_id_type: 'chat_id' }
      }
    );
    
    logger.info('自定义飞书消息发送成功');
    return { success: true };
  } catch (err) {
    logger.error('自定义飞书消息发送失败:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  send,
  sendViaWebhook,
  sendViaApi,
  sendCustomMessage
};
