/**
 * API 路由模块
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const database = require('../database');
const scheduler = require('../scheduler');
const logger = require('../utils/logger');
const screenshotCleanup = require('../scheduler/screenshot-cleanup');
const feishuWebhook = require('./feishu-webhook');

// 注册飞书命令
feishuWebhook.registerBuiltInCommands();

// ==================== 任务管理 ====================

/**
 * GET /api/tasks - 获取所有任务
 */
router.get('/tasks', (req, res) => {
  try {
    const tasks = database.tasks.getAll();
    res.json({
      success: true,
      data: tasks.map(task => ({
        ...task,
        enabled: Boolean(task.enabled),
        config: JSON.parse(task.config)
      }))
    });
  } catch (error) {
    logger.error('获取任务列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/:id - 获取任务详情
 */
router.get('/tasks/:id', (req, res) => {
  try {
    const task = database.tasks.getById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    res.json({
      success: true,
      data: {
        ...task,
        enabled: Boolean(task.enabled),
        config: JSON.parse(task.config)
      }
    });
  } catch (error) {
    logger.error('获取任务详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks - 创建任务
 */
router.post('/tasks', async (req, res) => {
  try {
    const { name, description, schedule, config, enabled = true } = req.body;
    
    if (!name || !schedule) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填字段：name, schedule' 
      });
    }
    
    const taskId = uuidv4();
    const task = {
      id: taskId,
      name,
      description,
      schedule,
      config: config || {},
      enabled
    };
    
    database.tasks.create(task);
    logger.info(`创建任务：${name} (${taskId})`);
    
    // 如果启用，加入调度器
    if (enabled) {
      await scheduler.addTask(task);
    }
    
    res.status(201).json({
      success: true,
      data: { id: taskId, ...task }
    });
  } catch (error) {
    logger.error('创建任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tasks/:id - 更新任务配置
 */
router.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const oldTask = database.tasks.getById(id);
    if (!oldTask) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 从调度器移除旧任务
    if (oldTask.enabled) {
      await scheduler.removeTask(id);
    }
    
    // 更新数据库
    database.tasks.update(id, updates);
    const updatedTask = database.tasks.getById(id);
    
    // 如果启用，重新加入调度器
    if (updatedTask.enabled) {
      await scheduler.addTask({
        ...updatedTask,
        config: JSON.parse(updatedTask.config)
      });
    }
    
    logger.info(`更新任务：${id}`);
    
    res.json({
      success: true,
      data: {
        ...updatedTask,
        enabled: Boolean(updatedTask.enabled),
        config: JSON.parse(updatedTask.config)
      }
    });
  } catch (error) {
    logger.error('更新任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id - 删除任务
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = database.tasks.getById(id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 从调度器移除
    if (task.enabled) {
      await scheduler.removeTask(id);
    }
    
    database.tasks.delete(id);
    logger.info(`删除任务：${id}`);
    
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    logger.error('删除任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks/:id/toggle - 启停任务
 */
router.post('/tasks/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const task = database.tasks.toggle(id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 同步调度器
    if (task.enabled) {
      await scheduler.addTask(task);
      logger.info(`启用任务：${id}`);
    } else {
      await scheduler.removeTask(id);
      logger.info(`禁用任务：${id}`);
    }
    
    res.json({
      success: true,
      data: {
        ...task,
        enabled: Boolean(task.enabled),
        config: JSON.parse(task.config)
      }
    });
  } catch (error) {
    logger.error('切换任务状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks/:id/run - 手动触发任务
 */
router.post('/tasks/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const task = database.tasks.getById(id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 立即执行任务
    const result = await scheduler.executeTask({
      ...task,
      config: JSON.parse(task.config)
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('手动执行任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/:id/logs - 获取任务日志
 */
router.get('/tasks/:id/logs', (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = database.logs.getByTaskId(req.params.id, parseInt(limit));
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('获取任务日志失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 系统管理 ====================

/**
 * GET /api/version - 获取系统版本
 */
router.get('/version', (req, res) => {
  try {
    const version = database.version.get();
    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    logger.error('获取版本失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/version/increment - 增加版本号
 */
router.post('/version/increment', (req, res) => {
  try {
    const version = database.version.incrementBuild();
    logger.info(`版本号更新：${version.version}`);
    
    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    logger.error('更新版本失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/logs - 获取最近日志
 */
router.get('/logs', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = database.logs.getRecent(parseInt(limit));
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('获取日志失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/backup - 备份数据库
 */
router.post('/backup', (req, res) => {
  try {
    const backupPath = database.backup();
    
    res.json({
      success: true,
      data: { backupPath }
    });
  } catch (error) {
    logger.error('备份失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/health - 健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// ==================== 截图管理 ====================

/**
 * GET /api/screenshots/stats - 获取截图统计
 */
router.get('/screenshots/stats', (req, res) => {
  try {
    const stats = screenshotCleanup.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取截图统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/screenshots/cleanup - 手动清理截图
 */
router.post('/screenshots/cleanup', (req, res) => {
  try {
    const { taskId } = req.body;
    
    screenshotCleanup.manualClean(taskId).then(cleaned => {
      res.json({
        success: true,
        data: { cleaned }
      });
    });
  } catch (error) {
    logger.error('清理截图失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/screenshots - 获取截图列表
 */
router.get('/screenshots', (req, res) => {
  try {
    const { taskId, limit = 50 } = req.query;
    const db = database.getDb();
    
    let query = 'SELECT * FROM screenshots WHERE cleaned = 0';
    const params = [];
    
    if (taskId) {
      query += ' AND task_id = ?';
      params.push(taskId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const screenshots = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: screenshots
    });
  } catch (error) {
    logger.error('获取截图列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
