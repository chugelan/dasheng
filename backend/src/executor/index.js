/**
 * 执行器模块
 * 负责执行具体的任务逻辑（登录、操作、抓取数据）
 */

const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

/**
 * 任务执行器
 */
async function execute(task) {
  const { id, name, config } = task;
  
  logger.info(`执行器启动：${name}`);
  
  // 根据任务类型路由到不同的执行器
  switch (config.type || 'browser') {
    case 'browser':
      return executeBrowserTask(task);
    case 'api':
      return executeApiTask(task);
    case 'script':
      return executeScriptTask(task);
    default:
      throw new Error(`不支持的任务类型：${config.type}`);
  }
}

/**
 * 浏览器自动化任务
 */
async function executeBrowserTask(task) {
  const { config } = task;
  let browser = null;
  
  try {
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: config.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    
    // 设置超时
    page.setDefaultTimeout(config.timeout || 60000);
    page.setDefaultNavigationTimeout(config.timeout || 60000);
    
    const result = {
      data: [],
      message: ''
    };
    
    // 执行配置的动作序列
    for (const action of config.actions || []) {
      logger.info(`执行动作：${action.type}`);
      
      switch (action.type) {
        case 'navigate':
          await page.goto(action.url, { 
            waitUntil: action.waitUntil || 'networkidle2' 
          });
          break;
          
        case 'login':
          await handleLogin(page, action);
          break;
          
        case 'click':
          await page.click(action.selector);
          if (action.waitFor) {
            await page.waitForSelector(action.waitFor);
          }
          break;
          
        case 'type':
          await page.type(action.selector, action.value);
          break;
          
        case 'scrape':
          const scraped = await scrapeData(page, action);
          result.data = scraped;
          result.message = `抓取到 ${scraped.length} 条数据`;
          break;
          
        case 'wait':
          await page.waitForTimeout(action.duration || 1000);
          break;
          
        case 'evaluate':
          const evalResult = await page.evaluate(action.fn);
          result.data = evalResult;
          break;
          
        default:
          logger.warn(`未知动作类型：${action.type}`);
      }
      
      // 动作间隔
      if (action.delay) {
        await page.waitForTimeout(action.delay);
      }
    }
    
    return result;
    
  } catch (error) {
    logger.error('浏览器任务执行失败:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 处理登录
 */
async function handleLogin(page, action) {
  const { usernameSelector, passwordSelector, submitSelector, credentials } = action;
  
  // 从环境变量获取凭据
  const [username, password] = credentials.split(':');
  const usernameValue = process.env[username];
  const passwordValue = process.env[password];
  
  if (!usernameValue || !passwordValue) {
    throw new Error(`凭据配置错误：环境变量 ${username} 或 ${password} 未设置`);
  }
  
  await page.type(usernameSelector, usernameValue);
  await page.type(passwordSelector, passwordValue);
  
  if (submitSelector) {
    await page.click(submitSelector);
  } else {
    await page.keyboard.press('Enter');
  }
  
  // 等待登录完成
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  logger.info('登录成功');
}

/**
 * 抓取数据
 */
async function scrapeData(page, action) {
  const { selector, fields } = action;
  
  return await page.evaluate((sel, fields) => {
    const elements = document.querySelectorAll(sel);
    return Array.from(elements).map(el => {
      const item = {};
      fields.forEach(field => {
        if (field.type === 'text') {
          item[field.name] = el.querySelector(field.selector)?.textContent?.trim();
        } else if (field.type === 'attribute') {
          item[field.name] = el.querySelector(field.selector)?.getAttribute(field.attribute);
        } else if (field.type === 'href') {
          item[field.name] = el.querySelector(field.selector)?.href;
        }
      });
      return item;
    });
  }, selector, fields);
}

/**
 * API 任务
 */
async function executeApiTask(task) {
  const axios = require('axios');
  const { config } = task;
  
  try {
    const response = await axios({
      method: config.method || 'GET',
      url: config.url,
      headers: config.headers,
      data: config.data,
      timeout: config.timeout || 30000
    });
    
    return {
      data: response.data,
      message: `API 请求成功，状态码：${response.status}`
    };
  } catch (error) {
    logger.error('API 任务执行失败:', error);
    throw error;
  }
}

/**
 * 脚本任务（执行外部脚本）
 */
async function executeScriptTask(task) {
  const { exec } = require('child_process');
  const { config } = task;
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    const { stdout, stderr } = await execPromise(config.command, {
      cwd: config.cwd || process.cwd(),
      env: { ...process.env, ...config.env }
    });
    
    return {
      data: { stdout, stderr },
      message: '脚本执行成功'
    };
  } catch (error) {
    logger.error('脚本任务执行失败:', error);
    throw error;
  }
}

module.exports = {
  execute
};
