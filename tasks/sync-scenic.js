/**
 * 景点同步任务 - 优化版
 * 频率：每天 08:00 和 16:00
 * 特性：Stealth 防检测、飞书命令触发、截图管理、2 小时自动清理
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const database = require('../backend/src/database');
const notifier = require('../backend/src/notifier');
const screenshotManager = require('../backend/src/utils/screenshot-manager');
const logger = require('../backend/src/utils/logger');
const credentials = require('../backend/src/utils/credentials');

// 启用 Stealth 插件
puppeteer.use(StealthPlugin());

const CONFIG = {
  url: 'https://vamall-admin.wfgravity.cn/#/event/index',
  chromePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,  // 非无头模式防检测
  timeout: 180000,
  screenshotEnabled: true
};

// 安全获取凭据
function getPiaofutongCredentials() {
  return credentials.getCredentials('piaofutong');
}

/**
 * 加载景点配置
 */
function loadScenicSpots() {
  const db = database.getDb();
  return db.getCollection('scenic_spots').filter(s => s.enabled && s.supplier_id && s.scenic_code);
}

/**
 * 登录
 */
async function login(page) {
  logger.info('🔐 开始登录...');
  
  // 安全获取凭据
  const { username, password } = getPiaofutongCredentials();
  logger.info('✅ 凭据已加载（已脱敏）');
  
  await page.goto(CONFIG.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const usernameInput = await page.$('input[type="text"], input[name="username"], .el-input__inner');
  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  
  if (usernameInput && passwordInput) {
    // 清空输入框
    await usernameInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 200));
    await usernameInput.type(username, { delay: 50 });
    
    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 200));
    await passwordInput.type(password, { delay: 50 });
    
    logger.info('✅ 账号密码已输入');
    await new Promise(r => setTimeout(r, 500));
    
    // 点击登录按钮
    const loginBtn = await page.$('button[type="submit"], .el-button--primary');
    if (loginBtn) {
      await loginBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    logger.info('✅ 已登录');
    
    await new Promise(r => setTimeout(r, 5000));
    
    // 登录成功截图
    if (CONFIG.screenshotEnabled) {
      await screenshotManager.saveScreenshot(page, 'login-success', 'sync-scenic');
    }
    
    return true;
  }
  
  logger.error('❌ 未找到登录输入框');
  return false;
}

/**
 * 点击同步按钮
 */
async function clickSyncButton(page) {
  logger.info('🔄 查找"同步票付通"按钮...');
  
  // 尝试多种选择器
  const selectors = [
    'button:contains("同步票付通")',
    'button:nth-child(9)',
    '.sync-btn',
    '[onclick*="sync"]'
  ];
  
  for (const selector of selectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        logger.info('✅ 已点击"同步票付通"按钮');
        await new Promise(r => setTimeout(r, 1000));
        return true;
      }
    } catch (e) {}
  }
  
  logger.error('❌ 未找到"同步票付通"按钮');
  return false;
}

/**
 * 点击刷新按钮
 */
async function clickRefreshButton(page) {
  logger.info('💰 查找"刷新门票价格状态"按钮...');
  
  const selectors = [
    'button:contains("刷新门票价格")',
    'button:nth-child(8)',
    '.refresh-btn',
    '[onclick*="refresh"]'
  ];
  
  for (const selector of selectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        logger.info('✅ 已点击"刷新门票价格状态"按钮');
        await new Promise(r => setTimeout(r, 1000));
        return true;
      }
    } catch (e) {}
  }
  
  logger.error('❌ 未找到"刷新门票价格状态"按钮');
  return false;
}

/**
 * 填写同步对话框
 */
async function fillSyncDialog(page, supplierId) {
  logger.info(`📝 输入供应商 ID: ${supplierId}`);
  await new Promise(r => setTimeout(r, 1500));
  
  // 查找输入框
  const inputSelectors = [
    '.el-dialog__wrapper input[type="text"]',
    '.el-input__inner',
    'input[placeholder*="供应商"]'
  ];
  
  let input = null;
  for (const selector of inputSelectors) {
    try {
      input = await page.$(selector);
      if (input) {
        logger.info(`✅ 找到输入框`);
        break;
      }
    } catch (e) {}
  }
  
  if (!input) {
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length > 0) {
      input = inputs[0];
      logger.info(`✅ 找到输入框 (备用方案)`);
    }
  }
  
  if (!input) {
    logger.error('❌ 未找到输入框');
    if (CONFIG.screenshotEnabled) {
      await screenshotManager.saveScreenshot(page, 'sync-no-input', 'sync-scenic');
    }
    return false;
  }
  
  // 清空并输入
  await input.click({ clickCount: 3 });
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('Backspace');
  await new Promise(r => setTimeout(r, 100));
  
  await input.type(supplierId, { delay: 50 });
  logger.info(`✅ 已输入供应商 ID`);
  
  // 验证输入
  const value = await input.evaluate(el => el.value);
  logger.info(`   验证：${value === supplierId ? '✅' : '❌'} (输入:"${value}")`);
  
  await new Promise(r => setTimeout(r, 500));
  
  // 点击确认
  const confirmBtn = await page.$('.el-dialog button.el-button--primary, button:contains("确定"), button:contains("确认")');
  if (confirmBtn) {
    await confirmBtn.click();
    logger.info('✅ 确认同步');
  } else {
    await page.keyboard.press('Enter');
    logger.info('✅ 按 Enter 确认');
  }
  
  await new Promise(r => setTimeout(r, 3000));
  
  // 截图
  if (CONFIG.screenshotEnabled) {
    await screenshotManager.saveScreenshot(page, `sync-${supplierId}`, 'sync-scenic');
  }
  
  return true;
}

/**
 * 填写刷新对话框
 */
async function fillRefreshDialog(page, scenicCode) {
  logger.info(`📝 输入景点编码：${scenicCode}`);
  await new Promise(r => setTimeout(r, 1500));
  
  const inputSelectors = [
    '.el-dialog__wrapper input[type="text"]',
    '.el-input__inner',
    'input[placeholder*="景点"]',
    'input[placeholder*="编码"]'
  ];
  
  let input = null;
  for (const selector of inputSelectors) {
    try {
      input = await page.$(selector);
      if (input) {
        logger.info(`✅ 找到输入框`);
        break;
      }
    } catch (e) {}
  }
  
  if (!input) {
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length > 0) {
      input = inputs[0];
      logger.info(`✅ 找到输入框 (备用方案)`);
    }
  }
  
  if (!input) {
    logger.error('❌ 未找到输入框');
    return false;
  }
  
  // 清空并输入
  await input.click({ clickCount: 3 });
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('Backspace');
  await new Promise(r => setTimeout(r, 100));
  
  await input.type(scenicCode, { delay: 50 });
  logger.info(`✅ 已输入景点编码`);
  
  await new Promise(r => setTimeout(r, 500));
  
  // 点击确认
  const confirmBtn = await page.$('.el-dialog button.el-button--primary, button:contains("确定"), button:contains("确认")');
  if (confirmBtn) {
    await confirmBtn.click();
    logger.info('✅ 确认刷新');
  } else {
    await page.keyboard.press('Enter');
  }
  
  await new Promise(r => setTimeout(r, 5000));
  
  // 截图
  if (CONFIG.screenshotEnabled) {
    await screenshotManager.saveScreenshot(page, `refresh-${scenicCode}`, 'sync-scenic');
  }
  
  return true;
}

/**
 * 任务执行入口
 */
async function execute(triggeredBy = 'schedule') {
  const startTime = Date.now();
  logger.info(`开始执行景点同步任务 (触发方式：${triggeredBy})...`);
  
  let browser = null;
  const results = [];
  
  try {
    // 发送开始通知
    if (triggeredBy === 'schedule') {
      await notifier.send({
        taskName: '景点同步',
        status: 'started',
        message: '🔄 景点同步任务已启动\n\n执行时间：' + new Date().toLocaleString('zh-CN') + '\n触发方式：定时执行\n请稍候，执行完成后将发送结果通知...',
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
    logger.info('🚀 启动浏览器 (Stealth 模式)...');
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      executablePath: CONFIG.chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 登录
    const loggedIn = await login(page);
    if (!loggedIn) {
      throw new Error('登录失败');
    }
    
    // 遍历景点
    for (const spot of scenicSpots) {
      logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`处理景点：${spot.name}`);
      
      const result = {
        name: spot.name,
        supplierId: spot.supplier_id,
        scenicCode: spot.scenic_code,
        syncSuccess: false,
        refreshSuccess: false
      };
      
      // 点击同步按钮
      if (await clickSyncButton(page)) {
        // 填写同步对话框
        if (await fillSyncDialog(page, spot.supplier_id)) {
          result.syncSuccess = true;
          logger.info(`✅ ${spot.name} 同步成功`);
        }
      }
      
      await new Promise(r => setTimeout(r, 2000));
      
      // 点击刷新按钮
      if (await clickRefreshButton(page)) {
        // 填写刷新对话框
        if (await fillRefreshDialog(page, spot.scenic_code)) {
          result.refreshSuccess = true;
          logger.info(`✅ ${spot.name} 刷新成功`);
        }
      }
      
      results.push(result);
      
      // 景点间隔
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // 关闭浏览器
    if (browser) {
      await browser.close();
      browser = null;
    }
    
    const duration = Date.now() - startTime;
    logger.info(`任务执行完成 (${duration}ms)`);
    
    // 统计结果
    const syncSuccessCount = results.filter(r => r.syncSuccess).length;
    const refreshSuccessCount = results.filter(r => r.refreshSuccess).length;
    const totalCount = results.length;
    
    // 发送完成通知
    await notifier.send({
      taskName: '景点同步',
      status: 'success',
      message: `🔄 景点同步完成\n\n执行时长：${(duration / 1000).toFixed(1)}秒\n景点总数：${totalCount}\n同步成功：${syncSuccessCount}\n刷新成功：${refreshSuccessCount}\n\n详细结果请查看日志`,
      color: 'green',
      data: { results, duration }
    });
    
    return {
      success: true,
      message: `完成 ${syncSuccessCount}/${totalCount} 个景点同步`,
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
      taskName: '景点同步',
      status: 'failed',
      message: `❌ 景点同步失败\n\n错误信息：${error.message}\n执行时长：${(duration / 1000).toFixed(1)}秒`,
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
  clickSyncButton,
  clickRefreshButton,
  fillSyncDialog,
  fillRefreshDialog
};
