/**
 * 凭据管理模块 - 安全存储和访问
 * 使用环境变量 + 加密文件双重保护
 * 
 * 安全级别：🔒 最高
 * - 凭据不显示在日志中
 * - 凭据不通过 API 返回
 * - 加密文件 AES-256-GCM
 * - 文件权限 600
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const CREDENTIALS_FILE = path.join(__dirname, '../../data/credentials.enc');

/**
 * 获取加密密钥
 */
function getEncryptionKey() {
  // 优先使用环境变量
  if (process.env.CREDENTIALS_KEY && process.env.CREDENTIALS_KEY.length === 64) {
    return process.env.CREDENTIALS_KEY;
  }
  
  // 警告：未配置加密密钥
  logger.warn('⚠️  未配置 CREDENTIALS_KEY，使用默认密钥（不安全）');
  logger.warn('请运行：openssl rand -hex 32 生成密钥并添加到 .env 文件');
  
  // 开发环境使用默认密钥（仅用于测试）
  return '0'.repeat(64);
}

/**
 * 获取凭据（安全方式）
 * @param {string} platform - 平台名称 ('12301' | 'piaofutong')
 * @returns {Object} { username, password }
 */
function getCredentials(platform) {
  // 优先使用环境变量
  if (platform === '12301') {
    const username = process.env.ORDER_USERNAME;
    const password = process.env.ORDER_PASSWORD;
    
    if (username && password) {
      logger.info(`✅ 从环境变量加载 12301 凭据`);
      return { username, password };
    }
  }
  
  if (platform === 'piaofutong') {
    const username = process.env.PIAOFUTONG_USERNAME;
    const password = process.env.PIAOFUTONG_PASSWORD;
    
    if (username && password) {
      logger.info(`✅ 从环境变量加载票付通凭据`);
      return { username, password };
    }
  }
  
  // 备用：从加密文件读取
  try {
    return decryptCredentials(platform);
  } catch (error) {
    logger.error(`❌ 无法获取 ${platform} 凭据：${error.message}`);
    throw new Error(`凭据配置缺失，请在 .env 文件中配置 ${platform} 凭据`);
  }
}

/**
 * 加密凭据
 */
function encrypt(data) {
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted
  };
}

/**
 * 解密凭据
 */
function decrypt(encrypted) {
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

/**
 * 从加密文件读取凭据
 */
function decryptCredentials(platform) {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error('凭据文件不存在，请配置环境变量');
  }
  
  const encrypted = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  const allCredentials = decrypt(encrypted);
  
  return allCredentials[platform];
}

/**
 * 保存凭据（加密）
 */
function saveCredentials(platform, data) {
  // 确保目录存在
  const dataDir = path.dirname(CREDENTIALS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // 读取所有凭据
  let allCredentials = {};
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      allCredentials = decrypt(JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8')));
    } catch (e) {
      logger.warn('读取现有凭据失败，创建新文件');
    }
  }
  
  // 更新凭据
  allCredentials[platform] = {
    ...data,
    updatedAt: new Date().toISOString()
  };
  
  // 加密并保存
  const encrypted = encrypt(allCredentials);
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(encrypted, null, 2));
  
  // 设置文件权限（仅所有者可读写）
  fs.chmodSync(CREDENTIALS_FILE, 0o600);
  
  logger.info(`✅ 凭据已保存：${platform}`);
}

/**
 * 测试凭据是否已配置
 */
function isConfigured(platform) {
  if (platform === '12301') {
    return !!(process.env.ORDER_USERNAME && process.env.ORDER_PASSWORD);
  }
  
  if (platform === 'piaofutong') {
    return !!(process.env.PIAOFUTONG_USERNAME && process.env.PIAOFUTONG_PASSWORD);
  }
  
  return fs.existsSync(CREDENTIALS_FILE);
}

/**
 * 获取凭据配置状态（不返回敏感信息）
 */
function getStatus() {
  return {
    '12301': {
      configured: isConfigured('12301'),
      source: process.env.ORDER_USERNAME ? '环境变量' : (fs.existsSync(CREDENTIALS_FILE) ? '加密文件' : '未配置')
    },
    'piaofutong': {
      configured: isConfigured('piaofutong'),
      source: process.env.PIAOFUTONG_USERNAME ? '环境变量' : (fs.existsSync(CREDENTIALS_FILE) ? '加密文件' : '未配置')
    }
  };
}

module.exports = {
  getCredentials,
  saveCredentials,
  isConfigured,
  getStatus,
  encrypt,
  decrypt
};
