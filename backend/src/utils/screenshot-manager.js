/**
 * 截图管理模块
 * 负责截图保存、记录、自动清理
 */

const fs = require('fs');
const path = require('path');
const database = require('../database');
const logger = require('./logger');

const CONFIG = {
  retentionHours: 2,  // 保留 2 小时
  cleanupInterval: '0 * * * *'  // 每小时整点清理
};

/**
 * 保存截图
 */
async function saveScreenshot(page, name, taskId) {
  try {
    const timestamp = Date.now();
    const screenshotDir = path.join(__dirname, `../../logs/screenshots/${taskId}`);
    
    // 确保目录存在
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // 生成文件名
    const filename = `${name}-${timestamp}.png`;
    const filePath = path.join(screenshotDir, filename);
    
    // 保存截图
    await page.screenshot({ path: filePath, fullPage: true });
    
    // 获取文件大小
    const stats = fs.statSync(filePath);
    
    // 记录到数据库
    const expiresAt = new Date(Date.now() + (CONFIG.retentionHours * 60 * 60 * 1000));
    
    database.getDb().prepare(`
      INSERT INTO screenshots (task_id, file_path, file_size, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(taskId, filePath, stats.size, expiresAt.toISOString());
    
    logger.info(`截图已保存：${filename} (${formatFileSize(stats.size)})`);
    
    return filePath;
  } catch (error) {
    logger.error('保存截图失败:', error);
    return null;
  }
}

/**
 * 清理过期截图
 */
async function cleanup() {
  try {
    const db = database.getDb();
    const cutoffTime = new Date(Date.now() - (CONFIG.retentionHours * 60 * 60 * 1000));
    
    // 查询过期截图
    const expiredScreenshots = db.prepare(`
      SELECT * FROM screenshots 
      WHERE expires_at < ? AND cleaned = 0
    `).all(cutoffTime.toISOString());
    
    if (expiredScreenshots.length === 0) {
      return 0;
    }
    
    let deletedCount = 0;
    
    for (const screenshot of expiredScreenshots) {
      try {
        // 删除文件
        if (fs.existsSync(screenshot.file_path)) {
          fs.unlinkSync(screenshot.file_path);
        }
        
        // 更新数据库记录
        db.prepare(`
          UPDATE screenshots SET cleaned = 1 WHERE id = ?
        `).run(screenshot.id);
        
        deletedCount++;
      } catch (error) {
        logger.error(`删除截图失败 ${screenshot.file_path}:`, error);
      }
    }
    
    logger.info(`清理完成：删除 ${deletedCount} 个过期截图`);
    return deletedCount;
  } catch (error) {
    logger.error('清理截图失败:', error);
    return 0;
  }
}

/**
 * 获取截图统计
 */
function getStats() {
  const db = database.getDb();
  
  const total = db.prepare('SELECT COUNT(*) as count FROM screenshots WHERE cleaned = 0').get();
  const size = db.prepare('SELECT SUM(file_size) as total FROM screenshots WHERE cleaned = 0').get();
  const expiring = db.prepare(`
    SELECT COUNT(*) as count FROM screenshots 
    WHERE cleaned = 0 AND expires_at < datetime('now', '+1 hour')
  `).get();
  
  return {
    total: total.count || 0,
    size: size.total || 0,
    sizeFormatted: formatFileSize(size.total || 0),
    expiringSoon: expiring.count || 0
  };
}

/**
 * 手动清理截图
 */
function manualClean(taskId) {
  const db = database.getDb();
  
  if (taskId) {
    // 清理指定任务的截图
    const screenshots = db.prepare(`
      SELECT * FROM screenshots WHERE task_id = ? AND cleaned = 0
    `).all(taskId);
    
    let deletedCount = 0;
    for (const screenshot of screenshots) {
      if (fs.existsSync(screenshot.file_path)) {
        fs.unlinkSync(screenshot.file_path);
      }
      db.prepare(`UPDATE screenshots SET cleaned = 1 WHERE id = ?`).run(screenshot.id);
      deletedCount++;
    }
    
    return deletedCount;
  } else {
    // 清理所有截图
    return cleanup();
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 启动定时清理任务
 */
function startCleanupScheduler() {
  const cron = require('node-cron');
  
  cron.schedule(CONFIG.cleanupInterval, async () => {
    logger.info('执行定时截图清理...');
    const cleaned = await cleanup();
    if (cleaned > 0) {
      logger.info(`清理了 ${cleaned} 个过期截图`);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  logger.info('截图清理任务已启动（每小时执行）');
}

module.exports = {
  saveScreenshot,
  cleanup,
  getStats,
  manualClean,
  startCleanupScheduler,
  CONFIG
};
