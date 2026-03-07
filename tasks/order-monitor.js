/**
 * 订单监控任务 - 迁移版
 * 原路径：automation-tasks/order-monitor/monitor.js
 * 迁移时间：2026-03-07
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const logger = require('../backend/src/utils/logger');

const CONFIG = {
  loginUrl: 'https://my.12301.cc/home.html',
  username: process.env.ORDER_USERNAME,
  password: process.env.ORDER_PASSWORD,
  chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  maxOrders: 5,
  dataFile: path.join(__dirname, 'order-monitor-data.json')
};

/**
 * 加载上次的数据
 */
function loadLastOrders() {
  try {
    if (fs.existsSync(CONFIG.dataFile)) {
      const data = fs.readFileSync(CONFIG.dataFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    logger.warn('读取上次数据失败:', e.message);
  }
  return [];
}

/**
 * 保存当前数据
 */
function saveLastOrders(orders) {
  try {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(orders, null, 2), 'utf8');
    logger.info('已保存订单数据');
  } catch (e) {
    logger.warn('保存数据失败:', e.message);
  }
}

/**
 * 检查数据是否重复
 */
function isDuplicate(newOrders, lastOrders) {
  if (lastOrders.length === 0) return false;
  if (newOrders.length !== lastOrders.length) return false;
  
  for (let i = 0; i < newOrders.length && i < lastOrders.length; i++) {
    const newKey = (newOrders[i].cells[1] || '') + '|' + (newOrders[i].cells[8] || '');
    const lastKey = (lastOrders[i].cells[1] || '') + '|' + (lastOrders[i].cells[8] || '');
    if (newKey !== lastKey) return false;
  }
  
  return true;
}

/**
 * 抓取失败订单
 */
async function fetchFailedOrders() {
  let browser;
  try {
    logger.info('开始登录订单系统...');
    
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CONFIG.chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    logger.info(`访问登录页：${CONFIG.loginUrl}`);
    await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await page.waitForSelector('input[type="text"], input[type="password"]', { timeout: 10000 });
    logger.info('正在登录...');
    
    const usernameInput = await page.$('input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (usernameInput && passwordInput) {
      await usernameInput.type(CONFIG.username);
      await passwordInput.type(CONFIG.password);
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      logger.info('登录成功');
    }
    
    await new Promise(r => setTimeout(r, 2000));

    logger.info('展开"近 7 天待办"...');
    await page.evaluate(() => {
      const el = document.querySelector('.aside-section-header, .aside-section-header-title');
      if (el) el.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    logger.info('点击"下游失败订单"...');
    await page.evaluate(() => {
      const items = document.querySelectorAll('.home-todo-item');
      for (const item of items) {
        if (item.textContent.includes('下游失败订单')) {
          const link = item.querySelector('a');
          if (link) link.click(); else item.click();
          return true;
        }
      }
    });
    await new Promise(r => setTimeout(r, 3000));
    
    const tableData = await page.evaluate(() => {
      const result = { headers: [], rows: [] };
      const tables = document.querySelectorAll('table');
      
      tables.forEach((table) => {
        const rows = table.querySelectorAll('tr');
        let headerFound = false;
        
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td, th');
          const cellTexts = Array.from(cells).map(c => c.textContent.trim());
          
          const isHeaderRow = row.querySelector('th') || 
                              cellTexts.some(t => t === '下单时间' || t === '订单号' || t === '产品名称' || t === '远端订单号');
          
          if (isHeaderRow && !headerFound) {
            if (cellTexts.length > result.headers.length) {
              result.headers = cellTexts;
              headerFound = true;
            }
          } else if (cellTexts.length >= 8 && cellTexts.some(t => t.length > 5)) {
            result.rows.push({ cells: cellTexts, raw: row.textContent.trim() });
          }
        });
      });
      
      return result;
    });
    
    logger.info(`抓取到 ${tableData.rows.length} 条订单`);
    await browser.close();
    
    return tableData;
  } catch (error) {
    logger.error('抓取失败:', error.message);
    if (browser) await browser.close();
    throw error;
  }
}

/**
 * 格式化订单消息
 */
function formatOrderMessage(tableData) {
  const allOrders = tableData.rows;
  const orders = allOrders.slice(0, CONFIG.maxOrders);
  
  if (orders.length === 0) {
    return {
      text: '✅ 当前暂无下游失败订单',
      summary: '无失败订单'
    };
  }
  
  let message = `[下游失败订单提醒] 共 ${allOrders.length} 条 (显示前${CONFIG.maxOrders}条)\n\n`;
  
  orders.forEach((order, index) => {
    message += `-- 订单 ${index + 1} --\n`;
    const cells = order.cells;
    
    if (cells.length >= 9) {
      message += `下单时间：${cells[0]}\n`;
      message += `远端订单号：${cells[1]}\n`;
      message += `产品名称：${cells[2]}\n`;
      message += `票种名称：${cells[3]}\n`;
      message += `联系人：${cells[4]}\n`;
      message += `手机号：${cells[5]}\n`;
      message += `日志 ID: ${cells[6]}\n`;
      message += `票付通订单号：${cells[7]}\n`;
      message += `失败描述：${cells[8]}\n`;
    } else {
      message += `订单数据：${order.raw.substring(0, 200)}...\n`;
    }
    message += `\n`;
  });
  
  message += `\n更新时间：${new Date().toLocaleString('zh-CN')}`;
  
  return {
    text: message,
    summary: `${allOrders.length} 条失败订单`,
    data: allOrders
  };
}

/**
 * 任务执行入口
 */
async function execute() {
  logger.info('开始执行订单监控任务...');
  
  const tableData = await fetchFailedOrders();
  const newOrders = tableData.rows;
  const lastOrders = loadLastOrders();
  
  // 检查是否重复
  if (isDuplicate(newOrders, lastOrders)) {
    logger.info('数据与上次相同，跳过通知');
    return {
      success: true,
      message: '数据无变化，跳过通知',
      data: { skipped: true, orderCount: newOrders.length }
    };
  }
  
  logger.info('数据有更新，准备发送通知...');
  
  const formatted = formatOrderMessage(tableData);
  
  // 保存当前数据
  saveLastOrders(newOrders);
  
  return {
    success: true,
    message: formatted.summary,
    data: {
      orderCount: newOrders.length,
      orders: newOrders.slice(0, CONFIG.maxOrders),
      text: formatted.text
    }
  };
}

module.exports = {
  execute,
  CONFIG
};
