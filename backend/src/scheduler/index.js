/**
 * 调度器模块 - node-cron
 * 负责任务的定时触发和执行
 */

const cron = require('node-cron');
const database = require('../database');
const executor = require('../executor');
const notifier = require('../notifier');
const logger = require('../utils/logger');

const scheduledJobs = new Map();

/**
 * 初始化调度器
 */
async function initialize() {
  logger.info('初始化调度器...');
  
  // 加载所有启用的任务
  const tasks = database.tasks.getAll();
  const enabledTasks = tasks.filter(t => t.enabled);
  
  for (const task of enabledTasks) {
    try {
      await addTask({
        ...task,
        config: JSON.parse(task.config)
      });
    } catch (error) {
      logger.error(`加载任务失败 ${task.name}:`, error);
    }
  }
  
  logger.info(`调度器初始化完成，已加载 ${enabledTasks.length} 个任务`);
}

/**
 * 添加定时任务
 */
async function addTask(task) {
  const { id, schedule, name } = task;
  
  // 如果已存在，先移除
  if (scheduledJobs.has(id)) {
    await removeTask(id);
  }
  
  // 解析 cron 表达式
  let cronSchedule;
  try {
    cronSchedule = parseSchedule(schedule);
  } catch (error) {
    logger.error(`任务 ${name} 的调度表达式无效:`, error);
    throw error;
  }
  
  // 创建定时任务
  const job = cron.schedule(cronSchedule, async () => {
    logger.info(`定时触发任务：${name} (${id})`);
    await executeTask(task);
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });
  
  scheduledJobs.set(id, job);
  logger.info(`任务已加入调度：${name} - ${schedule}`);
}

/**
 * 移除定时任务
 */
async function removeTask(taskId) {
  const job = scheduledJobs.get(taskId);
  if (job) {
    job.stop();
    scheduledJobs.delete(taskId);
    logger.info(`任务已从调度移除：${taskId}`);
  }
}

/**
 * 执行任务
 */
async function executeTask(task) {
  const { id, name, config } = task;
  const startTime = Date.now();
  
  logger.info(`开始执行任务：${name} (${id})`);
  
  try {
    // 执行任务逻辑
    const result = await executor.execute(task);
    
    const duration = Date.now() - startTime;
    
    // 记录日志
    database.logs.create({
      taskId: id,
      status: 'success',
      message: result.message || '执行成功',
      data: result.data,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration
    });
    
    // 更新任务状态
    database.tasks.update(id, {
      lastRunAt: new Date().toISOString(),
      lastStatus: 'success'
    });
    
    // 增加发布次数（每次成功执行）
    const updatedTask = database.tasks.incrementPublishCount(id);
    
    // 发送通知
    if (config.notifyOnSuccess !== false) {
      await notifier.send({
        taskName: name,
        status: 'success',
        message: result.message,
        data: result.data,
        version: updatedTask.version,
        duration
      });
    }
    
    logger.info(`任务执行成功：${name} (${duration}ms)`);
    
    return {
      success: true,
      status: 'success',
      message: result.message,
      data: result.data,
      duration,
      version: updatedTask.version
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // 记录错误日志
    database.logs.create({
      taskId: id,
      status: 'failed',
      message: error.message,
      data: { error: error.stack },
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration
    });
    
    // 更新任务状态
    database.tasks.update(id, {
      lastRunAt: new Date().toISOString(),
      lastStatus: 'failed'
    });
    
    // 发送错误通知
    if (config.notifyOnFailure !== false) {
      await notifier.send({
        taskName: name,
        status: 'failed',
        message: error.message,
        error: error.stack,
        duration
      });
    }
    
    logger.error(`任务执行失败：${name}`, error);
    
    throw error;
  }
}

/**
 * 解析调度表达式
 * 支持：cron 表达式、间隔时间（如 "every 10 minutes"）
 */
function parseSchedule(schedule) {
  // 如果是标准 cron 表达式（5 或 6 段）
  const parts = schedule.trim().split(/\s+/);
  if (parts.length >= 5 && parts.length <= 6) {
    return schedule;
  }
  
  // 支持简单的人类可读格式
  const match = schedule.match(/every\s+(\d+)\s*(second|minute|hour|day|week)s?/i);
  if (match) {
    const [, value, unit] = match;
    const n = parseInt(value);
    
    switch (unit.toLowerCase()) {
      case 'second':
        return `*/${n} * * * * *`;
      case 'minute':
        return `*/${n} * * * *`;
      case 'hour':
        return `0 */${n} * * *`;
      case 'day':
        return `0 0 */${n} * *`;
      case 'week':
        return `0 0 * * 0`;
      default:
        throw new Error(`不支持的时间单位：${unit}`);
    }
  }
  
  throw new Error(`无法解析调度表达式：${schedule}`);
}

/**
 * 关闭调度器
 */
async function shutdown() {
  logger.info('关闭调度器...');
  
  for (const [taskId, job] of scheduledJobs) {
    job.stop();
    logger.info(`停止任务：${taskId}`);
  }
  
  scheduledJobs.clear();
  logger.info('调度器已关闭');
}

/**
 * 获取所有调度任务状态
 */
function getScheduledTasks() {
  const tasks = [];
  for (const [taskId, job] of scheduledJobs) {
    tasks.push({
      taskId,
      scheduled: job.getScheduled()
    });
  }
  return tasks;
}

module.exports = {
  initialize,
  addTask,
  removeTask,
  executeTask,
  shutdown,
  getScheduledTasks
};
