#!/usr/bin/env node
/**
 * 数据库初始化脚本
 */

require('dotenv').config({ path: '../config/.env' });
const database = require('../src/database');
const logger = require('../src/utils/logger');

async function main() {
  try {
    logger.info('开始初始化数据库...');
    database.initialize();
    logger.info('数据库初始化完成 ✅');
    
    // 显示初始状态
    const version = database.version.get();
    logger.info(`系统版本：${version.version} (build ${version.build_number})`);
    
    const tasks = database.tasks.getAll();
    logger.info(`现有任务数：${tasks.length}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

main();
