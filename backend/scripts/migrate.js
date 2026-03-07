#!/usr/bin/env node
/**
 * 数据库迁移脚本
 * 创建新增的数据表
 */

require('dotenv').config({ path: '../config/.env' });
const database = require('../src/database');
const logger = require('../src/utils/logger');

async function migrate() {
  try {
    logger.info('开始数据库迁移...');
    database.initialize();
    const db = database.getDb();

    // 1. 景点配置表
    logger.info('创建景点配置表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS scenic_spots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        supplier_id TEXT,
        scenic_code TEXT,
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. 供应商表
    logger.info('创建供应商表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        platform TEXT,
        contact TEXT,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. 采购记录表
    logger.info('创建采购记录表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scenic_spot_id INTEGER NOT NULL,
        supplier_id INTEGER,
        status TEXT NOT NULL,
        price REAL,
        result TEXT,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scenic_spot_id) REFERENCES scenic_spots(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `);

    // 4. 订单监控数据表
    logger.info('创建订单监控数据表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_monitor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        order_id TEXT,
        product_name TEXT,
        status TEXT,
        raw_data TEXT,
        notified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    // 5. 截图记录表
    logger.info('创建截图记录表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        cleaned INTEGER DEFAULT 0,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    // 创建索引
    logger.info('创建索引...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_screenshots_expires_at ON screenshots(expires_at);
      CREATE INDEX IF NOT EXISTS idx_screenshots_cleaned ON screenshots(cleaned);
      CREATE INDEX IF NOT EXISTS idx_order_monitor_task_id ON order_monitor_data(task_id);
      CREATE INDEX IF NOT EXISTS idx_order_monitor_notified ON order_monitor_data(notified);
      CREATE INDEX IF NOT EXISTS idx_procurement_records_executed_at ON procurement_records(executed_at);
    `);

    // 插入示例数据
    logger.info('插入示例数据...');
    
    // 检查是否已有景点数据
    const existingSpots = db.prepare('SELECT COUNT(*) as count FROM scenic_spots').get();
    if (existingSpots.count === 0) {
      db.exec(`
        INSERT INTO scenic_spots (name, supplier_id, scenic_code, enabled) VALUES
        ('美龄宫', '243487', 'E20260210000301', 1),
        ('卧佛院', '676343', 'E20260108000001', 1),
        ('金顶索道', '556274', 'E20250718000171', 1)
      `);
      logger.info('已插入示例景点数据');
    }

    // 检查是否已有供应商数据
    const existingSuppliers = db.prepare('SELECT COUNT(*) as count FROM suppliers').get();
    if (existingSuppliers.count === 0) {
      db.exec(`
        INSERT INTO suppliers (name, platform, enabled) VALUES
        ('携程旅行（新）', '12301', 1),
        ('同程旅行', '12301', 1)
      `);
      logger.info('已插入示例供应商数据');
    }

    logger.info('✅ 数据库迁移完成');
    
    // 显示迁移结果
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();
    
    logger.info(`当前数据库表：${tables.map(t => t.name).join(', ')}`);
    
    const spotCount = db.prepare('SELECT COUNT(*) as count FROM scenic_spots').get();
    logger.info(`景点数量：${spotCount.count}`);
    
    const supplierCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get();
    logger.info(`供应商数量：${supplierCount.count}`);

    process.exit(0);
  } catch (error) {
    logger.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

migrate();
