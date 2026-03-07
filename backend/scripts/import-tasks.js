#!/usr/bin/env node
/**
 * 批量导入任务配置
 * 用法：node scripts/import-tasks.js
 */

require('dotenv').config({ path: '../config/.env' });
const database = require('../src/database');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function importTasks() {
  try {
    logger.info('开始导入任务配置...');
    database.initialize();
    
    // 读取任务配置
    const configPath = path.join(__dirname, '../../tasks/task-configs.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    logger.info(`找到 ${config.tasks.length} 个任务配置`);
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const taskConfig of config.tasks) {
      // 检查任务是否已存在
      const existing = database.tasks.getAll().find(t => t.id === taskConfig.id || t.name === taskConfig.name);
      
      if (existing) {
        logger.info(`⚠️  任务已存在：${taskConfig.name}，跳过`);
        skipped++;
      } else {
        const taskId = taskConfig.id || uuidv4();
        
        database.tasks.create({
          id: taskId,
          name: taskConfig.name,
          description: taskConfig.description,
          schedule: taskConfig.schedule,
          config: taskConfig.config,
          enabled: taskConfig.enabled
        });
        
        logger.info(`✅ 任务已创建：${taskConfig.name} (${taskId})`);
        imported++;
      }
    }
    
    // 显示所有任务
    const tasks = database.tasks.getAll();
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 当前任务列表:');
    tasks.forEach(t => {
      const status = t.enabled ? '🟢 运行中' : '⏸️ 已停止';
      console.log(`  ${status} ${t.name} - ${t.schedule}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n导入完成：新增 ${imported} 个，更新 ${updated} 个，跳过 ${skipped} 个\n`);
    
    process.exit(0);
  } catch (error) {
    logger.error('导入失败:', error);
    process.exit(1);
  }
}

importTasks();
