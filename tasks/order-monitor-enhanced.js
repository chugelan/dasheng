/**
 * 订单监控任务 - 增强版
 * 特性：数据库去重、仅新订单通知、智能跳过
 */

const puppeteer = require('puppeteer');
const database = require('../backend/src/database');
const notifier = require('../backend/src/notifier');
const logger = require('../backend/src/utils/logger');

const CONFIG = {
  loginUrl: 'https://my.12301.cc/home.html',
  username: process.env.ORDER_USERNAME,
  password: process.env.ORDER_PASSWORD,
  chromePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  maxOrders: 5,
  deduplication: true
};

/**
 * 检查数据是否重复（数据库版本）
 */
async function isDuplicate(newOrders, taskId) {
  if (!CONFIG.deduplication) return false;
  
  try {
    const db = database.getDb();
    
    // 从数据库读取上次的数据
    const lastData = db.prepare(`
      SELECT raw_data FROM order_monitor_data 
      WHERE task_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(taskId);
    
    if (!lastData) {
      logger.info('首次运行，不视为重复');
      return false;
    }
    
    const lastOrders = JSON.parse(lastData.raw_data);
    
    if (newOrders.length !== lastOrders.length) {
      logger.info(`订单数量变化：${lastOrders.length} → ${newOrders.length}`);
      return false;
    }
    
    // 比较关键指纹：远端订单号 + 失败描述
    for (let i = 0; i < newOrders.length; i++) {
      const newKey = `${newOrders[i].orderId}|${newOrders[i].failReason}`;
      const lastKey = `${lastOrders[i].orderId}|${lastOrders[i].failReason}`;
      
      if (newKey !== lastKey) {
        logger.info(`订单 ${i + 1} 数据有变化`);
        return false;
      }
    }
    
    logger.info('数据与上次完全相同，判定为重复');
    return true;
    
  } catch (error) {
    logger.error('去重检查失败:', error);
    return false;  // 出错时不跳过，确保通知
  }
}

/**
 * 保存订单数据到数据库
 */
async function saveOrderData(taskId, orders) {
  try {
    const db = database.getDb();
    
    db.prepare(`
      INSERT INTO order_monitor_data (task_id, raw_data, notified)
      VALUES (?, ?, 0)
    `).run(taskId, JSON.stringify(orders));
    
    logger.info(`已保存 ${orders.length} 条订单数据到数据库`);
  } catch (error) {
    logger.error('保存订单数据失败:', error);
  }
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
    
    // 导航到登录页
    await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    logger.info('页面加载完成');
    
    // 登录
    await page.waitForSelector('input[type="text"], input[type="password"]', { timeout: 10000 });
    logger.info('正在登录...');
    
    const usernameInput = await page.$('input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (usernameInput && passwordInput) {
      await usernameInput.type(CONFIG.username);
      await passwordInput.type(CONFIG.password);
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      logger.info('✅ 登录成功');
    }
    
    await new Promise(r => setTimeout(r, 2000));

    // 展开"近 7 天待办"
    logger.info('展开"近 7 天待办"...');
    await page.evaluate(() => {
      const el = document.querySelector('.aside-section-header, .aside-section-header-title');
      if (el) el.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // 点击"下游失败订单"
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
    
    // 抓取数据
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
            result.rows.push({
              cells: cellTexts,
              raw: row.textContent.trim(),
              orderTime: cellTexts[0],
              orderId: cellTexts[1],
              productName: cellTexts[2],
              ticketType: cellTexts[3],
              contact: cellTexts[4],
              phone: cellTexts[5],
              logId: cellTexts[6],
              piaofutongId: cellTexts[7],
              failReason: cellTexts[8]
            });
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
 * 格式化通知消息
 */
function formatOrderMessage(tableData) {
  const allOrders = tableData.rows;
  const orders = allOrders.slice(0, CONFIG.maxOrders);
  
  if (orders.length === 0) {
    return {
      title: '✅ 订单监控 - 无失败订单',
      content: '当前暂无下游失败订单',
      color: 'green'
    };
  }
  
  let content = `[下游失败订单提醒] 共 ${allOrders.length} 条 (显示前${CONFIG.maxOrders}条)\n\n`;
  
  orders.forEach((order, index) => {
    content += `-- 订单 ${index + 1} --\n`;
    content += `下单时间：${order.orderTime}\n`;
    content += `远端订单号：${order.orderId}\n`;
    content += `产品名称：${order.productName}\n`;
    content += `失败描述：${order.failReason}\n`;
    content += `\n`;
  });
  
  content += `\n更新时间：${new Date().toLocaleString('zh-CN')}`;
  
  return {
    title: `⚠️ 订单监控 - 发现 ${allOrders.length} 条失败订单`,
    content: content,
    color: 'yellow'
  };
}

/**
 * 任务执行入口
 */
async function execute() {
  const startTime = Date.now();
  logger.info('开始执行订单监控任务...');
  
  try {
    // 抓取订单数据
    const tableData = await fetchFailedOrders();
    const newOrders = tableData.rows;
    
    // 去重检查
    const duplicate = await isDuplicate(newOrders, 'order-monitor');
    
    if (duplicate) {
      logger.info('数据与上次相同，跳过通知');
      return {
        success: true,
        message: '数据无变化，跳过通知',
        data: { 
          skipped: true, 
          orderCount: newOrders.length,
          duplicate: true
        },
        notified: false
      };
    }
    
    // 保存数据
    await saveOrderData('order-monitor', newOrders);
    
    // 有新数据，发送通知
    const formatted = formatOrderMessage(tableData);
    
    await notifier.send({
      taskName: '订单监控',
      status: newOrders.length > 0 ? 'new_orders' : 'success',
      message: formatted.content,
      title: formatted.title,
      color: formatted.color,
      data: {
        orderCount: newOrders.length,
        orders: newOrders.slice(0, CONFIG.maxOrders)
      }
    });
    
    const duration = Date.now() - startTime;
    logger.info(`任务执行完成 (${duration}ms)`);
    
    return {
      success: true,
      message: `发现 ${newOrders.length} 条新订单`,
      data: {
        orderCount: newOrders.length,
        orders: newOrders.slice(0, CONFIG.maxOrders)
      },
      notified: true,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('任务执行失败:', error);
    
    // 发送错误通知
    await notifier.send({
      taskName: '订单监控',
      status: 'failed',
      message: `执行失败：${error.message}`,
      color: 'red',
      duration
    });
    
    throw error;
  }
}

module.exports = {
  execute,
  CONFIG,
  fetchFailedOrders,
  isDuplicate,
  saveOrderData
};
