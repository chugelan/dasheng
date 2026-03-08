/**
 * 凭据管理 API
 * 🔒 安全级别：最高
 * - 不返回密码
 * - 仅返回配置状态
 */

const express = require('express');
const router = express.Router();
const credentials = require('../utils/credentials');
const logger = require('../utils/logger');

/**
 * GET /api/credentials/status - 获取凭据配置状态
 */
router.get('/status', (req, res) => {
  try {
    const status = credentials.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取凭据状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/credentials/test - 测试凭据有效性
 */
router.post('/test', async (req, res) => {
  try {
    const { platform } = req.body;
    
    if (!platform || !['12301', 'piaofutong'].includes(platform)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的平台，支持：12301, piaofutong' 
      });
    }
    
    // 检查是否已配置
    const configured = credentials.isConfigured(platform);
    
    res.json({
      success: true,
      data: {
        platform,
        configured,
        message: configured ? '凭据已配置' : '凭据未配置'
      }
    });
  } catch (error) {
    logger.error('测试凭据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/credentials/:platform - 更新凭据
 */
router.put('/credentials/:platform', (req, res) => {
  try {
    const { platform } = req.params;
    const { username, password } = req.body;
    
    if (!platform || !['12301', 'piaofutong'].includes(platform)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的平台，支持：12301, piaofutong' 
      });
    }
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名和密码不能为空' 
      });
    }
    
    // 保存凭据（加密）
    credentials.saveCredentials(platform, { username, password });
    
    logger.info(`✅ 凭据已更新：${platform}`);
    
    res.json({
      success: true,
      message: '凭据已保存'
    });
  } catch (error) {
    logger.error('更新凭据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
