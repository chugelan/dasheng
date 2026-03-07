/**
 * 数据库模块 - 简化版（使用 JSON 文件存储）
 * 负责任务、日志、版本等数据的持久化
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const simpleDb = require('./simple-db');

const DB_PATH = path.join(__dirname, '../../data/simple-db.json');
const BACKUP_DIR = path.join(__dirname, '../../data/backups');

/**
 * 初始化数据库
 */
function initialize() {
  // 确保数据目录存在
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info(`创建数据目录：${dataDir}`);
  }

  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`创建备份目录：${BACKUP_DIR}`);
  }

  simpleDb.initialize();
  logger.info(`数据库初始化成功：${DB_PATH}`);
}

/**
 * 任务相关操作
 */
const tasks = {
  getAll: () => simpleDb.getCollection('tasks'),
  
  getById: (id) => simpleDb.find('tasks', { id }),
  
  create: (task) => {
    return simpleDb.insert('tasks', {
      id: task.id,
      name: task.name,
      description: task.description || '',
      enabled: task.enabled ? 1 : 0,
      schedule: task.schedule,
      config: JSON.stringify(task.config),
      version: '1.0.0',
      publish_count: 0
    });
  },
  
  update: (id, updates) => {
    return simpleDb.update('tasks', id, updates);
  },
  
  delete: (id) => {
    const tasks = simpleDb.getCollection('tasks');
    const task = tasks.find(t => t.id === id);
    if (task) {
      simpleDb.remove('tasks', task.id);
      return { changes: 1 };
    }
    return { changes: 0 };
  },
  
  toggle: (id) => {
    const task = tasks.getById(id);
    if (!task) return null;
    const newEnabled = task.enabled ? 0 : 1;
    simpleDb.update('tasks', task.id, { enabled: newEnabled });
    return { ...task, enabled: newEnabled };
  },
  
  incrementPublishCount: (id) => {
    const task = tasks.getById(id);
    if (!task) return null;
    const newCount = (task.publish_count || 0) + 1;
    const newVersion = `1.0.${newCount}`;
    simpleDb.update('tasks', task.id, { publish_count: newCount, version: newVersion });
    return { ...task, publish_count: newCount, version: newVersion };
  }
};

/**
 * 日志相关操作
 */
const logs = {
  create: (log) => {
    return simpleDb.insert('task_logs', {
      task_id: log.taskId,
      status: log.status,
      message: log.message || '',
      data: log.data ? JSON.stringify(log.data) : null,
      started_at: log.startedAt,
      completed_at: log.completedAt,
      duration_ms: log.durationMs
    });
  },
  
  getByTaskId: (taskId, limit = 50) => {
    const allLogs = simpleDb.getCollection('task_logs');
    return allLogs
      .filter(l => l.task_id === taskId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },
  
  getRecent: (limit = 100) => {
    const allLogs = simpleDb.getCollection('task_logs');
    return allLogs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },
  
  deleteOld: (days = 30) => {
    // 简化实现：不清理
    return { changes: 0 };
  }
};

/**
 * 版本相关操作
 */
const version = {
  get: () => simpleDb.getData()?.system_version || { version: '1.0.0', build_number: 1 },
  
  incrementBuild: () => {
    const current = version.get();
    const newBuild = current.build_number + 1;
    const [major, minor] = current.version.split('.').map(Number);
    const newVersion = `${major}.${minor}.${newBuild}`;
    
    simpleDb.getData().system_version = {
      version: newVersion,
      build_number: newBuild,
      last_updated: new Date().toISOString()
    };
    simpleDb.save();
    
    return { version: newVersion, build_number: newBuild };
  }
};

/**
 * 备份数据库
 */
function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `autoops-backup-${timestamp}.json`);
  
  fs.copyFileSync(DB_PATH, backupPath);
  
  const stats = fs.statSync(backupPath);
  logger.info(`数据库备份完成：${backupPath} (${stats.size} bytes)`);
  return backupPath;
}

/**
 * 关闭数据库连接
 */
function close() {
  simpleDb.save();
  logger.info('数据库已保存');
}

module.exports = {
  initialize,
  close,
  backup,
  tasks,
  logs,
  version,
  getDb: () => simpleDb
};
