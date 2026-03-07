#!/usr/bin/env node
/**
 * 导入任务配置脚本
 * 用法：node scripts/import-task.js tasks/order-monitor.config.json
 */

require('dotenv').config({ path: '../config/.env' });
const database = require('../src/database');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

async function main() {
  const configPath = process.argv[2];
  
  if (!configPath) {
    console.error('用法：node scripts/import-task.js <任务配置文件路径>');
    process.exit(1);
  }
  
  const absolutePath = path.isAbsolute(configPath) 
    ? configPath 
    : path.join(__dirname, '../../', configPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`文件不存在：${absolutePath}`);
    process.exit(1);
  }
  
  try {
    logger.info('开始导入任务配置...');
    database.initialize();
    
    const config = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    
    // 检查任务是否已存在
    const existing = database.tasks.getAll().find(t => t.name === config.name);
    if (existing) {
      console.log(`⚠️  任务 "${config.name}" 已存在，是否更新？(y/n)`);
      // 简单处理：直接更新
      logger.info(`更新现有任务：${config.name}`);
      database.tasks.update(existing.id, {
        description: config.description,
        schedule: config.schedule,
        config: config.config
      });
      console.log(`✅ 任务已更新：${config.name}`);
    } else {
      const { v4: uuidv4 } = require('uuid');
      const taskId = uuidv4();
      
      database.tasks.create({
        id: taskId,
        name: config.name,
        description: config.description,
        schedule: config.schedule,
        config: config.config,
        enabled: true
      });
      
      console.log(`✅ 任务已创建：${config.name} (${taskId})`);
    }
    
    // 显示所有任务
    const tasks = database.tasks.getAll();
    console.log('\n📋 当前任务列表:');
    tasks.forEach(t => {
      console.log(`  - ${t.name} (${t.enabled ? '运行中' : '已停止'}) - ${t.schedule}`);
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('导入失败:', error);
    process.exit(1);
  }
}

main();
