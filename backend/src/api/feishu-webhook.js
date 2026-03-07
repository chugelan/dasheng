/**
 * 飞书 Webhook 接口
 * 接收飞书命令并路由到对应的任务执行器
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const database = require('../database');
const scheduler = require('../scheduler');

// 命令处理器注册表
const commandHandlers = new Map();

/**
 * 注册命令处理器
 */
function registerCommand(trigger, handler) {
  commandHandlers.set(trigger.toLowerCase(), handler);
  logger.info(`注册飞书命令：${trigger}`);
}

/**
 * 获取所有注册的命令
 */
function getRegisteredCommands() {
  return Array.from(commandHandlers.keys());
}

/**
 * 处理飞书消息
 */
router.post('/message', async (req, res) => {
  try {
    const { challenge, header, event } = req.body;
    
    // 挑战验证（飞书首次配置时需要）
    if (challenge) {
      logger.info('收到飞书挑战验证');
      return res.json({ challenge });
    }
    
    // 解析消息
    const messageType = event?.message?.message_type;
    const messageContent = JSON.parse(event?.message?.content || '{}');
    const text = messageContent.text || '';
    const senderId = event?.sender?.sender_id?.user_id || 'unknown';
    const conversationId = event?.message?.chat_id || '';
    
    logger.info(`收到飞书消息：${text} (来自：${senderId})`);
    
    // 检查是否是命令
    if (!text.startsWith('/')) {
      return res.json({ code: 0, msg: 'success' });
    }
    
    // 解析命令
    const [command, ...args] = text.split(' ');
    const handler = commandHandlers.get(command.toLowerCase());
    
    if (!handler) {
      // 未知命令，回复帮助
      const helpMessage = buildHelpMessage();
      await sendFeishuMessage(conversationId, helpMessage);
      return res.json({ code: 0, msg: 'success' });
    }
    
    // 执行命令
    logger.info(`执行命令：${command} (参数：${args.join(' ')})`);
    const result = await handler(args, { senderId, conversationId });
    
    // 回复结果
    if (result) {
      await sendFeishuMessage(conversationId, result);
    }
    
    res.json({ code: 0, msg: 'success' });
    
  } catch (error) {
    logger.error('处理飞书消息失败:', error);
    res.status(500).json({ code: 500, msg: error.message });
  }
});

/**
 * 发送飞书消息
 */
async function sendFeishuMessage(chatId, text) {
  const axios = require('axios');
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  
  if (!webhookUrl) {
    logger.warn('飞书 Webhook URL 未配置');
    return;
  }
  
  try {
    // 从 webhook URL 提取 bot ID
    const botId = webhookUrl.split('/hook/')[1];
    
    await axios.post(
      `https://open.feishu.cn/open-apis/bot/v2/hook/${botId}`,
      {
        msg_type: 'text',
        content: { text }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    logger.info('飞书消息发送成功');
  } catch (error) {
    logger.error('发送飞书消息失败:', error.response?.data || error.message);
  }
}

/**
 * 构建帮助消息
 */
function buildHelpMessage() {
  const commands = getRegisteredCommands();
  
  return `🤖 AutoOps Master - 可用命令

${commands.map(cmd => {
  const handler = commandHandlers.get(cmd);
  return `${cmd} - ${handler.description || '执行操作'}`;
}).join('\n')}

发送 \`/help\` 查看此帮助信息`;
}

/**
 * 注册内置命令
 */
function registerBuiltInCommands() {
  // /help - 帮助
  registerCommand('/help', {
    description: '显示帮助信息',
    handler: async () => buildHelpMessage()
  });
  
  // /status - 系统状态
  registerCommand('/status', {
    description: '查看系统状态',
    handler: async () => {
      const tasks = database.tasks.getAll();
      const version = database.version.get();
      
      const runningTasks = tasks.filter(t => t.enabled).length;
      const totalTasks = tasks.length;
      
      return `📊 AutoOps Master 状态

🚀 版本：v${version.version} (build ${version.build_number})
📋 任务总数：${totalTasks}
✅ 运行中：${runningTasks}
⏸️ 已停止：${totalTasks - runningTasks}

发送 \`/help\` 查看所有命令`;
    }
  });
  
  // /tasks - 任务列表
  registerCommand('/tasks', {
    description: '查看任务列表',
    handler: async () => {
      const tasks = database.tasks.getAll();
      
      if (tasks.length === 0) {
        return '📋 暂无任务';
      }
      
      const taskList = tasks.map(t => {
        const status = t.enabled ? '✅' : '⏸️';
        return `${status} ${t.name} - ${t.schedule}`;
      }).join('\n');
      
      return `📋 任务列表\n\n${taskList}`;
    }
  });
  
  // /procurement - 景区采购命令组
  registerCommand('/procurement', {
    description: '景区采购命令',
    handler: async (args) => {
      const subCommand = args[0];
      
      if (subCommand === 'run') {
        // 手动执行景区采购
        const task = database.tasks.getAll().find(t => t.name === '景区采购');
        if (!task) {
          return '❌ 未找到景区采购任务';
        }
        
        try {
          await scheduler.executeTask(task);
          return '✅ 景区采购任务已启动\n\n请稍候，执行完成后将发送结果通知...';
        } catch (error) {
          return `❌ 执行失败：${error.message}`;
        }
      } else if (subCommand === 'status') {
        const task = database.tasks.getAll().find(t => t.name === '景区采购');
        if (!task) {
          return '❌ 未找到景区采购任务';
        }
        
        return `🛒 景区采购状态

状态：${task.enabled ? '✅ 运行中' : '⏸️ 已停止'}
调度：每天 08:00 和 16:00
上次执行：${task.last_run_at ? new Date(task.last_run_at).toLocaleString('zh-CN') : '暂无'}
版本：v${task.version || '1.0.0'}`;
      } else {
        return `🛒 景区采购命令

/procurement run - 手动执行任务
/procurement status - 查看任务状态

发送 \`/help\` 查看所有命令`;
      }
    }
  });
  
  // /sync-scenic - 景点同步命令组
  registerCommand('/sync-scenic', {
    description: '景点同步命令',
    handler: async (args) => {
      const subCommand = args[0];
      
      if (subCommand === 'run') {
        // 手动执行景点同步
        const task = database.tasks.getAll().find(t => t.name === '景点同步');
        if (!task) {
          return '❌ 未找到景点同步任务';
        }
        
        try {
          await scheduler.executeTask(task);
          return '✅ 景点同步任务已启动\n\n请稍候，执行完成后将发送结果通知...';
        } catch (error) {
          return `❌ 执行失败：${error.message}`;
        }
      } else if (subCommand === 'status') {
        const task = database.tasks.getAll().find(t => t.name === '景点同步');
        if (!task) {
          return '❌ 未找到景点同步任务';
        }
        
        return `🔄 景点同步状态

状态：${task.enabled ? '✅ 运行中' : '⏸️ 已停止'}
调度：每天 08:00 和 16:00
上次执行：${task.last_run_at ? new Date(task.last_run_at).toLocaleString('zh-CN') : '暂无'}
版本：v${task.version || '1.0.0'}`;
      } else {
        return `🔄 景点同步命令

/sync-scenic run - 手动执行任务
/sync-scenic status - 查看任务状态

发送 \`/help\` 查看所有命令`;
      }
    }
  });
  
  // /order - 订单监控命令组
  registerCommand('/order', {
    description: '订单监控命令',
    handler: async (args) => {
      const subCommand = args[0];
      
      if (subCommand === 'run') {
        const task = database.tasks.getAll().find(t => t.name === '订单监控');
        if (!task) {
          return '❌ 未找到订单监控任务';
        }
        
        try {
          await scheduler.executeTask(task);
          return '✅ 订单监控任务已启动';
        } catch (error) {
          return `❌ 执行失败：${error.message}`;
        }
      } else if (subCommand === 'status') {
        const task = database.tasks.getAll().find(t => t.name === '订单监控');
        if (!task) {
          return '❌ 未找到订单监控任务';
        }
        
        return `📦 订单监控状态

状态：${task.enabled ? '✅ 运行中' : '⏸️ 已停止'}
调度：每 10 分钟
上次执行：${task.last_run_at ? new Date(task.last_run_at).toLocaleString('zh-CN') : '暂无'}`;
      } else {
        return `📦 订单监控命令

/order run - 手动执行任务
/order status - 查看任务状态`;
      }
    }
  });
}

module.exports = {
  router,
  registerCommand,
  registerBuiltInCommands,
  getRegisteredCommands,
  sendFeishuMessage
};
