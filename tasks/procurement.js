/**
 * 景区采购任务 - 优化版
 * 频率：每天 08:00 和 16:00
 * 特性：飞书命令触发、截图管理、2 小时自动清理
 */

const puppeteer = require('puppeteer');
const path = require('path');
const database = require('../backend/src/database');
const notifier = require('../backend/src/notifier');
const screenshotManager = require('../backend/src/utils/screenshot-manager');
const logger = require('../backend/src/utils/logger');
const credentials = require('../backend/src/utils/credentials');

const CONFIG = {
  loginUrl: 'https://my.12301.cc/home.html',
  resourceUrl: 'https://my.12301.cc/new/resourcecenter.html',
  chromePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,  // 非无头模式
  timeout: 120000,
  screenshotEnabled: true
};

// 安全获取凭据
function get12301Credentials() {
  return credentials.getCredentials('12301');
}

/**
 * 加载景点配置
 */
function loadScenicSpots() {
  const db = database.getDb();
  return db.getCollection('scenic_spots').filter(s => s.enabled);
}

/**
 * 登录
 */
async function login(page) {
  logger.info('🔑 开始登录...');
  
  // 安全获取凭据
  const { username, password } = get12301Credentials();
  logger.info('✅ 凭据已加载（已脱敏）');
  
  await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  
  const usernameInput = await page.$('input[type="text"]');
  const passwordInput = await page.$('input[type="password"]');
  
  if (usernameInput && passwordInput) {
    await usernameInput.type(username);
    await passwordInput.type(password);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    logger.info('✅ 登录成功');
    return true;
  }
  
  logger.error('❌ 未找到登录输入框');
  return false;
}

/**
 * 进入资源中心
 */
async function goToResourceCenter(page) {
  logger.info('🏛️ 进入资源中心页面...');
  
  await page.goto(CONFIG.resourceUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  logger.info(`✅ 已访问资源中心`);
  
  if (CONFIG.screenshotEnabled) {
    await screenshotManager.saveScreenshot(page, 'resource-center', 'procurement');
  }
  
  return true;
}

/**
 * 搜索景点
 */
async function searchScenicSpot(page, spotName) {
  logger.info(`🔍 搜索景点：${spotName}`);
  await new Promise(r => setTimeout(r, 3000));
  
  try {
    const allInputs = await page.$$('.el-input__inner');
    let searchInput = null;
    
    for (const input of allInputs) {
      const placeholder = await page.evaluate(el => el.placeholder, input);
      if (placeholder && placeholder.includes('旅游目的地')) {
        searchInput = input;
        logger.info(`✅ 找到搜索框`);
        break;
      }
    }
    
    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await searchInput.type(spotName);
      logger.info(`✅ 输入景点名称：${spotName}`);
      await new Promise(r => setTimeout(r, 1000));
      
      const searchBtn = await page.$('.search-bar-btn');
      if (searchBtn) {
        await searchBtn.click();
        logger.info('✅ 点击搜索按钮');
      }
      
      logger.info('⏳ 等待搜索结果加载 (10 秒)...');
      await new Promise(r => setTimeout(r, 10000));
      
      const productCount = await page.evaluate(() => {
        return document.querySelectorAll('.prod-con').length;
      });
      
      logger.info(`📊 找到 ${productCount} 个产品`);
      
      if (CONFIG.screenshotEnabled) {
        await screenshotManager.saveScreenshot(page, `search-${spotName}`, 'procurement');
      }
      
      return productCount;
    }
  } catch (error) {
    logger.error(`搜索失败：${error.message}`);
  }
  
  return 0;
}

/**
 * 执行采购流程
 */
async function procureProduct(page, spotName, suppliers) {
  logger.info(`🛒 执行采购：${spotName} (供应商：${suppliers?.join(', ') || '任意'})`);
  
  try {
    // 查找产品
    const products = await page.$$('.prod-con');
    
    if (products.length === 0) {
      logger.warn(`⚠️ 未找到产品`);
      return { success: false, reason: '未找到产品' };
    }
    
    // 遍历产品，匹配供应商
    for (const product of products) {
      const supplierName = await page.evaluate(el => {
        const supplierEl = el.querySelector('.supplier-name, .supplier');
        return supplierEl ? supplierEl.textContent.trim() : '';
      }, product);
      
      // 如果指定了供应商列表，检查是否匹配
      if (suppliers && suppliers.length > 0) {
        const matched = suppliers.some(s => supplierName.includes(s));
        if (!matched) continue;
      }
      
      logger.info(`✅ 匹配到供应商：${supplierName}`);
      
      // 点击采购按钮
      const procureBtn = await product.$('.procure-btn, button:contains("采购"), .el-button--primary');
      if (procureBtn) {
        await procureBtn.click();
        logger.info('✅ 点击采购按钮');
        
        // 等待确认对话框
        await new Promise(r => setTimeout(r, 2000));
        
        // 截图
        if (CONFIG.screenshotEnabled) {
          await screenshotManager.saveScreenshot(page, `procure-${spotName}`, 'procurement');
        }
        
        // 确认采购（这里需要根据实际页面调整）
        const confirmBtn = await page.$('.el-button--primary, button:contains("确认"), button:contains("确定")');
        if (confirmBtn) {
          await confirmBtn.click();
          logger.info('✅ 确认采购');
          await new Promise(r => setTimeout(r, 3000));
        }
        
        return { success: true, supplier: supplierName };
      }
    }
    
    logger.warn(`⚠️ 未找到匹配的供应商`);
    return { success: false, reason: '未找到匹配的供应商' };
    
  } catch (error) {
    logger.error(`采购失败：${error.message}`);
    return { success: false, reason: error.message };
  }
}

/**
 * 关闭所有弹窗
 */
async function closeAllDialogs(page) {
  logger.info('🔒 尝试关闭所有弹窗...');
  
  await page.evaluate(() => {
    // 点击所有关闭按钮
    const closeBtns = document.querySelectorAll('.el-dialog__headerbtn, .el-dialog__close');
    closeBtns.forEach(btn => btn.click());
    
    // 点击完成、关闭、返回、继续按钮
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      const text = btn.textContent.trim();
      if (['完成', '关闭', '返回', '继续', '取消'].includes(text)) {
        btn.click();
      }
    });
  });
  
  await new Promise(r => setTimeout(r, 1000));
}

/**
 * 任务执行入口
 */
async function execute(triggeredBy = 'schedule') {
  const startTime = Date.now();
  logger.info(`开始执行景区采购任务 (触发方式：${triggeredBy})...`);
  
  let browser = null;
  const results = [];
  
  try {
    // 发送开始通知
    if (triggeredBy === 'schedule') {
      await notifier.send({
        taskName: '景区采购',
        status: 'started',
        message: '🛒 景区采购任务已启动\n\n执行时间：' + new Date().toLocaleString('zh-CN') + '\n触发方式：定时执行\n请稍候，执行完成后将发送结果通知...',
        color: 'blue'
      });
    }
    
    // 加载景点配置
    const scenicSpots = loadScenicSpots();
    logger.info(`加载到 ${scenicSpots.length} 个景点`);
    
    if (scenicSpots.length === 0) {
      return {
        success: true,
        message: '没有启用的景点',
        data: { skipped: true, reason: 'no_spots' }
      };
    }
    
    // 启动浏览器
    logger.info('🚀 启动浏览器...');
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      executablePath: CONFIG.chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 登录
    const loggedIn = await login(page);
    if (!loggedIn) {
      throw new Error('登录失败');
    }
    
    // 进入资源中心
    await goToResourceCenter(page);
    
    // 遍历景点
    for (const spot of scenicSpots) {
      logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`处理景点：${spot.name}`);
      
      // 搜索景点
      const productCount = await searchScenicSpot(page, spot.name);
      
      if (productCount > 0) {
        // 执行采购
        const result = await procureProduct(page, spot.name, spot.suppliers);
        results.push({
          name: spot.name,
          productCount,
          ...result
        });
      } else {
        results.push({
          name: spot.name,
          productCount: 0,
          success: false,
          reason: '无产品'
        });
      }
      
      // 关闭弹窗
      await closeAllDialogs(page);
      
      // 景点间隔
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // 关闭浏览器
    if (browser) {
      await browser.close();
      browser = null;
    }
    
    const duration = Date.now() - startTime;
    logger.info(`任务执行完成 (${duration}ms)`);
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    // 发送完成通知
    await notifier.send({
      taskName: '景区采购',
      status: 'success',
      message: `🛒 景区采购完成\n\n执行时长：${(duration / 1000).toFixed(1)}秒\n景点总数：${totalCount}\n成功：${successCount}\n失败：${totalCount - successCount}\n\n详细结果请查看日志`,
      color: 'green',
      data: { results, duration }
    });
    
    return {
      success: true,
      message: `完成 ${successCount}/${totalCount} 个景点采购`,
      data: { results, duration }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('任务执行失败:', error);
    
    if (browser) {
      await browser.close();
    }
    
    // 发送错误通知
    await notifier.send({
      taskName: '景区采购',
      status: 'failed',
      message: `❌ 景区采购失败\n\n错误信息：${error.message}\n执行时长：${(duration / 1000).toFixed(1)}秒`,
      color: 'red',
      duration
    });
    
    throw error;
  }
}

module.exports = {
  execute,
  CONFIG,
  loadScenicSpots,
  login,
  searchScenicSpot,
  procureProduct
};
