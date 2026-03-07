/**
 * AutoOps Master - 后端服务入口
 * @author AutoOps Master
 * @since 2026-03-07
 */

require('dotenv').config({ path: '../config/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');

const apiRoutes = require('./api');
const scheduler = require('./scheduler');
const database = require('./database');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 最多 100 个请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API 路由
app.use('/api', apiRoutes);

// 前端静态资源（生产环境）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  });
});

// 启动服务
async function start() {
  try {
    // 初始化数据库
    await database.initialize();
    logger.info('数据库初始化成功');

    // 启动调度器
    await scheduler.initialize();
    logger.info('调度器启动成功');

    // 启动 HTTP 服务
    app.listen(PORT, () => {
      logger.info(`🚀 AutoOps 服务已启动：http://localhost:${PORT}`);
      logger.info(`📊 管理后台：http://localhost:${PORT}`);
      logger.info(`🔌 API 端点：http://localhost:${PORT}/api`);
    });

    // 优雅关闭
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('启动失败:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  logger.info('正在关闭服务...');
  await scheduler.shutdown();
  await database.close();
  logger.info('服务已关闭');
  process.exit(0);
}

start();

module.exports = app;
