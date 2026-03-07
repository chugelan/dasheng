#!/usr/bin/env node
/**
 * 数据库备份脚本
 * 支持手动备份和定时备份
 */

require('dotenv').config({ path: '../config/.env' });
const database = require('../src/database');
const logger = require('../src/utils/logger');
const path = require('path');
const fs = require('fs');

async function main() {
  try {
    logger.info('开始备份数据库...');
    database.initialize();
    
    const backupPath = database.backup();
    logger.info(`备份完成：${backupPath}`);
    
    // 清理旧备份（保留最近 10 个）
    cleanupOldBackups();
    
    process.exit(0);
  } catch (error) {
    logger.error('备份失败:', error);
    process.exit(1);
  }
}

function cleanupOldBackups(maxBackups = 10) {
  const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../data/backups');
  
  if (!fs.existsSync(backupDir)) return;
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('autoops-backup-'))
    .sort()
    .reverse();
  
  if (files.length > maxBackups) {
    files.slice(maxBackups).forEach(file => {
      fs.unlinkSync(path.join(backupDir, file));
      logger.info(`删除旧备份：${file}`);
    });
  }
}

main();
