/**
 * 数据库模块 - SQLite
 * 负责任务、日志、版本等数据的持久化
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/autoops.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../data/backups');

let db = null;

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

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // 启用 WAL 模式，提升并发性能

  createTables();
  logger.info(`数据库初始化成功：${DB_PATH}`);
}

/**
 * 创建数据表
 */
function createTables() {
  db.exec(`
    -- 任务表
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      schedule TEXT NOT NULL,
      config TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      publish_count INTEGER DEFAULT 0,
      last_run_at DATETIME,
      last_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 任务执行日志表
    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      data TEXT,
      started_at DATETIME NOT NULL,
      completed_at DATETIME,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- 版本号表（全局）
    CREATE TABLE IF NOT EXISTS system_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version TEXT NOT NULL,
      build_number INTEGER NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 备份记录表
    CREATE TABLE IF NOT EXISTS backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_path TEXT NOT NULL,
      backup_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_created_at ON task_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled);
  `);

  // 初始化系统版本
  const versionRow = db.prepare('SELECT * FROM system_version WHERE id = 1').get();
  if (!versionRow) {
    db.prepare(`
      INSERT INTO system_version (id, version, build_number)
      VALUES (1, '1.0.0', 1)
    `).run();
  }
}

/**
 * 任务相关操作
 */
const tasks = {
  getAll: () => db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all(),
  
  getById: (id) => db.prepare('SELECT * FROM tasks WHERE id = ?').get(id),
  
  create: (task) => {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, name, description, enabled, schedule, config)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      task.id,
      task.name,
      task.description || null,
      task.enabled ? 1 : 0,
      task.schedule,
      JSON.stringify(task.config)
    );
  },
  
  update: (id, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.schedule !== undefined) {
      fields.push('schedule = ?');
      values.push(updates.schedule);
    }
    if (updates.config !== undefined) {
      fields.push('config = ?');
      values.push(JSON.stringify(updates.config));
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },
  
  delete: (id) => db.prepare('DELETE FROM tasks WHERE id = ?').run(id),
  
  toggle: (id) => {
    const task = tasks.getById(id);
    if (!task) return null;
    const newEnabled = task.enabled ? 0 : 1;
    db.prepare('UPDATE tasks SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newEnabled, id);
    return { ...task, enabled: newEnabled };
  },
  
  incrementPublishCount: (id) => {
    const task = tasks.getById(id);
    if (!task) return null;
    const newCount = task.publish_count + 1;
    const newVersion = `1.0.${newCount}`;
    db.prepare('UPDATE tasks SET publish_count = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newCount, newVersion, id);
    return { ...task, publish_count: newCount, version: newVersion };
  }
};

/**
 * 日志相关操作
 */
const logs = {
  create: (log) => {
    const stmt = db.prepare(`
      INSERT INTO task_logs (task_id, status, message, data, started_at, completed_at, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      log.taskId,
      log.status,
      log.message || null,
      log.data ? JSON.stringify(log.data) : null,
      log.startedAt,
      log.completedAt || null,
      log.durationMs || null
    );
  },
  
  getByTaskId: (taskId, limit = 50) => 
    db.prepare('SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(taskId, limit),
  
  getRecent: (limit = 100) =>
    db.prepare('SELECT * FROM task_logs ORDER BY created_at DESC LIMIT ?').all(limit),
  
  deleteOld: (days = 30) => {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return db.prepare('DELETE FROM task_logs WHERE created_at < ?').run(cutoff);
  }
};

/**
 * 版本相关操作
 */
const version = {
  get: () => db.prepare('SELECT * FROM system_version WHERE id = 1').get(),
  
  incrementBuild: () => {
    const current = version.get();
    const newBuild = current.build_number + 1;
    const [major, minor] = current.version.split('.').map(Number);
    const newVersion = `${major}.${minor}.${newBuild}`;
    
    db.prepare(`
      UPDATE system_version 
      SET version = ?, build_number = ?, last_updated = CURRENT_TIMESTAMP 
      WHERE id = 1
    `).run(newVersion, newBuild);
    
    return { version: newVersion, build_number: newBuild };
  }
};

/**
 * 备份数据库
 */
function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `autoops-backup-${timestamp}.db`);
  
  // 复制数据库文件
  fs.copyFileSync(DB_PATH, backupPath);
  
  // 记录备份
  const stats = fs.statSync(backupPath);
  db.prepare('INSERT INTO backup_records (backup_path, backup_size) VALUES (?, ?)')
    .run(backupPath, stats.size);
  
  logger.info(`数据库备份完成：${backupPath} (${stats.size} bytes)`);
  return backupPath;
}

/**
 * 关闭数据库连接
 */
function close() {
  if (db) {
    db.close();
    logger.info('数据库连接已关闭');
  }
}

module.exports = {
  initialize,
  close,
  backup,
  tasks,
  logs,
  version,
  getDb: () => db
};
