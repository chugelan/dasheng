/**
 * 截图清理定时任务
 * 每小时执行一次，清理超过 2 小时的截图
 */

const cron = require('node-cron');
const screenshotManager = require('../utils/screenshot-manager');
const logger = require('../utils/logger');

let cleanupJob = null;

/**
 * 启动截图清理任务
 */
function start() {
  if (cleanupJob) {
    logger.warn('截图清理任务已在运行');
    return;
  }
  
  // 每小时整点执行
  cleanupJob = cron.schedule('0 * * * *', async () => {
    logger.info('执行定时截图清理...');
    
    try {
      const cleaned = await screenshotManager.cleanup();
      
      if (cleaned > 0) {
        logger.info(`清理了 ${cleaned} 个过期截图`);
      } else {
        logger.info('没有需要清理的截图');
      }
    } catch (error) {
      logger.error('截图清理失败:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });
  
  logger.info('✅ 截图清理任务已启动（每小时执行）');
}

/**
 * 停止截图清理任务
 */
function stop() {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    logger.info('截图清理任务已停止');
  }
}

/**
 * 手动执行清理
 */
async function manualClean(taskId) {
  logger.info(`手动执行截图清理${taskId ? ` (${taskId})` : ''}...`);
  
  try {
    const cleaned = await screenshotManager.manualClean(taskId);
    logger.info(`手动清理完成：删除 ${cleaned} 个截图`);
    return cleaned;
  } catch (error) {
    logger.error('手动清理失败:', error);
    throw error;
  }
}

/**
 * 获取清理统计
 */
function getStats() {
  return screenshotManager.getStats();
}

module.exports = {
  start,
  stop,
  manualClean,
  getStats
};
