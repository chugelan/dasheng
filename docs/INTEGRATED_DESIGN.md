# 🎯 自动化系统整合设计方案（优化版）

**设计时间：** 2026-03-07 21:54  
**修订时间：** 2026-03-07 21:54（根据用户需求优化）  
**设计者：** AutoOps Master 🤖

---

## 一、任务调度优化

### 任务执行频率调整

| 任务 | 原频率 | 新频率 | 说明 |
|------|--------|--------|------|
| 订单监控 | 每 10 分钟 | 每 10 分钟 | ✅ 保持不变 |
| 景区采购 | 每 10 分钟 | 每天 2 次 (08:00, 16:00) | ⚡ 减少执行频率 |
| 景点同步 | 每 1 分钟 | 每天 2 次 (08:00, 16:00) | ⚡ 大幅减少执行频率 |

### Cron 表达式

```javascript
// 订单监控 - 每 10 分钟
schedule: '*/10 * * * *'

// 景区采购 - 每天 08:00 和 16:00
schedule: '0 8,16 * * *'

// 景点同步 - 每天 08:00 和 16:00
schedule: '0 8,16 * * *'
```

### 飞书命令触发

支持通过飞书机器人发送命令手动触发任务：

```
# 触发景区采购
/procurement run

# 触发景点同步
/sync-scenic run

# 查看任务状态
/status
```

---

## 二、截图管理优化

### 自动清理策略

```javascript
// 截图保留 2 小时（7200 秒）
const SCREENSHOT_RETENTION_HOURS = 2;

// 定时清理任务（每小时执行一次）
schedule: '0 * * * *'  // 每小时整点
```

### 清理逻辑

```javascript
async function cleanupScreenshots() {
  const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 2 小时前
  const logDir = path.join(__dirname, '../logs');
  
  const files = fs.readdirSync(logDir);
  let deletedCount = 0;
  
  for (const file of files) {
    if (file.endsWith('.png')) {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
  }
  
  log(`清理完成：删除 ${deletedCount} 个过期截图`);
  return deletedCount;
}
```

### 数据库记录

```sql
-- 截图记录表（新增）
CREATE TABLE screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,  -- 2 小时后过期
  cleaned INTEGER DEFAULT 0,     -- 是否已清理
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 索引加速查询
CREATE INDEX idx_screenshots_expires_at ON screenshots(expires_at);
CREATE INDEX idx_screenshots_cleaned ON screenshots(cleaned);
```

---

## 三、系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        管理后台 (Frontend)                       │
│                     http://localhost:3001                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  任务管理    │ │  景点管理    │ │  供应商管理  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  执行日志    │ │  采购记录    │ │  系统设置    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP API
┌─────────────────────────────────────────────────────────────────┐
│                        后端服务 (Backend)                        │
│                     http://localhost:3000                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Gateway                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  任务调度器  │ │  任务执行器  │ │  通知中心    │            │
│  │  (Scheduler) │ │  (Executor)  │ │  (Notifier)  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  订单监控    │ │  景区采购    │ │  景点同步    │            │
│  │  (Task)      │ │  (Task)      │ │  (Task)      │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SQLite Database                       │  │
│  │  tasks | scenic_spots | suppliers | logs | records      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        外部系统                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 12301 平台    │ │ 票付通系统   │ │ 飞书机器人   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心模块设计

### 1. 任务调度器（Scheduler）

#### 职责
- 管理所有定时任务的调度
- 支持 Cron 表达式和间隔时间
- 任务并发控制
- 优雅关闭

#### 接口设计
```javascript
// scheduler/index.js
class TaskScheduler {
  // 添加任务
  async addTask(taskConfig)
  
  // 移除任务
  async removeTask(taskId)
  
  // 立即执行
  async executeTask(taskId)
  
  // 启用/禁用
  async toggleTask(taskId, enabled)
  
  // 更新调度
  async updateSchedule(taskId, newSchedule)
}
```

#### 任务配置格式
```json
{
  "id": "order-monitor",
  "name": "订单监控",
  "type": "browser",
  "enabled": true,
  "schedule": "*/10 * * * *",
  "config": {
    "loginUrl": "https://my.12301.cc/home.html",
    "headless": true,
    "timeout": 60000,
    "actions": [
      { "type": "navigate", "url": "..." },
      { "type": "login", "credentials": "ORDER_CREDENTIALS" },
      { "type": "scrape", "selector": "..." }
    ],
    "notifyOnSuccess": true,
    "notifyOnFailure": true,
    "retryPolicy": {
      "maxRetries": 3,
      "retryDelay": 5000
    }
  }
}
```

---

### 2. 任务执行器（Executor）

#### 职责
- 执行具体任务逻辑
- 浏览器自动化（Puppeteer）
- API 请求
- 脚本执行
- 错误处理和重试

#### 执行器类型
```javascript
// executor/index.js
const executors = {
  // 浏览器自动化
  browser: async (task) => {
    const browser = await puppeteer.launch({ ... });
    // 执行动作序列
  },
  
  // API 请求
  api: async (task) => {
    const response = await axios({ ... });
    return response.data;
  },
  
  // 脚本执行
  script: async (task) => {
    const { exec } = require('child_process');
    const { stdout } = await exec(task.config.command);
    return stdout;
  }
};
```

#### 动作序列支持
```javascript
// 支持的动作类型
const actions = {
  navigate: { /* 导航到 URL */ },
  login: { /* 自动登录 */ },
  click: { /* 点击元素 */ },
  type: { /* 输入文本 */ },
  scrape: { /* 抓取数据 */ },
  wait: { /* 等待 */ },
  evaluate: { /* 执行 JS */ },
  screenshot: { /* 截图 */ },
  upload: { /* 上传文件 */ }
};
```

---

### 3. 通知中心（Notifier）

#### 职责
- 统一通知接口
- 支持多种通知方式
- 通知模板管理
- 通知历史记录

#### 通知方式
```javascript
// notifier/index.js
const notifiers = {
  // 飞书 Webhook（简单通知）
  feishuWebhook: async (message) => {
    await axios.post(webhookUrl, {
      msg_type: 'interactive',
      card: buildCard(message)
    });
  },
  
  // 飞书 API（支持更多功能）
  feishuApi: async (message, options) => {
    const token = await getTenantToken();
    await axios.post('https://open.feishu.cn/open-apis/im/v1/messages', {
      receive_id: options.chatId,
      msg_type: 'interactive',
      content: JSON.stringify(buildCard(message))
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  
  // 邮件通知
  email: async (message, options) => {
    // 使用 himalaya skill
  },
  
  // 系统通知
  system: async (message) => {
    // 记录到数据库
  }
};
```

#### 通知模板
```javascript
// 订单监控通知模板
const orderMonitorTemplate = {
  success: {
    title: '✅ 订单监控 - 无新失败订单',
    color: 'green',
    content: '当前暂无下游失败订单'
  },
  newOrders: {
    title: '⚠️ 订单监控 - 发现 {count} 条失败订单',
    color: 'yellow',
    content: `
      **失败订单列表:**
      {orders}
      
      **更新时间:** {time}
    `
  },
  failed: {
    title: '❌ 订单监控 - 执行失败',
    color: 'red',
    content: `
      **错误信息:** {error}
      **执行时间:** {time}
    `
  }
};
```

---

### 4. 数据中心（Data Center）

#### 数据库表设计

```sql
-- 任务表（已有）
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,  -- 'browser' | 'api' | 'script'
  enabled INTEGER DEFAULT 1,
  schedule TEXT NOT NULL,
  config TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  publish_count INTEGER DEFAULT 0,
  last_run_at DATETIME,
  last_status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 景点配置表（新增）
CREATE TABLE scenic_spots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  supplier_id TEXT,
  scenic_code TEXT,
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 供应商表（新增）
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT,  -- '12301' | 'piaofutong'
  contact TEXT,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务执行日志表（已有）
CREATE TABLE task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success' | 'failed' | 'skipped'
  message TEXT,
  data TEXT,  -- JSON
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 采购记录表（新增）
CREATE TABLE procurement_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenic_spot_id INTEGER NOT NULL,
  supplier_id INTEGER,
  status TEXT NOT NULL,  -- 'pending' | 'success' | 'failed'
  price REAL,
  result TEXT,  -- JSON
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scenic_spot_id) REFERENCES scenic_spots(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 订单监控数据表（新增）
CREATE TABLE order_monitor_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  order_id TEXT,  -- 远端订单号
  product_name TEXT,
  status TEXT,  -- 失败描述
  raw_data TEXT,  -- JSON
  notified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 系统版本表（已有）
CREATE TABLE system_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL,
  build_number INTEGER NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 备份记录表（已有）
CREATE TABLE backup_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_path TEXT NOT NULL,
  backup_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 三、任务详细设计

### 任务 1: 订单监控（优化版）

#### 配置
```json
{
  "id": "order-monitor",
  "name": "订单监控",
  "description": "监控 12301 平台下游失败订单，数据去重不重复通知",
  "type": "browser",
  "schedule": "*/10 * * * *",  // 每 10 分钟
  "config": {
    "loginUrl": "https://my.12301.cc/home.html",
    "headless": true,
    "timeout": 60000,
    "deduplication": {
      "enabled": true,
      "compareFields": ["orderId", "failReason"],  // 比较字段
      "storage": "database"  // 使用数据库存储
    },
    "maxOrders": 5,  // 最多显示 5 条
    "notifyOnNewOrders": true,  // 仅在有新订单时通知
    "notifyOnFailure": true,
    "retryPolicy": {
      "maxRetries": 3,
      "retryDelay": 5000
    },
    "actions": [
      {
        "type": "navigate",
        "url": "https://my.12301.cc/home.html"
      },
      {
        "type": "login",
        "usernameSelector": "input[type='text']",
        "passwordSelector": "input[type='password']",
        "submitSelector": "button[type='submit']",
        "credentials": "ORDER_USERNAME:ORDER_PASSWORD"
      },
      {
        "type": "click",
        "selector": ".aside-section-header",
        "waitFor": ".home-todo-item"
      },
      {
        "type": "click",
        "selector": ".home-todo-item",
        "textContains": "下游失败订单",
        "waitFor": "table"
      },
      {
        "type": "scrape",
        "selector": "table tr",
        "fields": [
          { "name": "orderTime", "type": "text", "selector": "td:nth-child(1)" },
          { "name": "orderId", "type": "text", "selector": "td:nth-child(2)" },
          { "name": "productName", "type": "text", "selector": "td:nth-child(3)" },
          { "name": "ticketType", "type": "text", "selector": "td:nth-child(4)" },
          { "name": "contact", "type": "text", "selector": "td:nth-child(5)" },
          { "name": "phone", "type": "text", "selector": "td:nth-child(6)" },
          { "name": "logId", "type": "text", "selector": "td:nth-child(7)" },
          { "name": "piaofutongId", "type": "text", "selector": "td:nth-child(8)" },
          { "name": "failReason", "type": "text", "selector": "td:nth-child(9)" }
        ]
      }
    ]
  }
}
```

#### 数据去重逻辑（增强版）

```javascript
/**
 * 检查数据是否重复
 * @param {Array} newOrders - 新抓取的订单
 * @param {String} taskId - 任务 ID
 * @returns {Boolean} true 表示重复，false 表示有新数据
 */
async function isDuplicate(newOrders, taskId) {
  // 从数据库读取上次的数据
  const lastData = await database.query(`
    SELECT raw_data FROM order_monitor_data 
    WHERE task_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `, [taskId]);
  
  if (!lastData || lastData.length === 0) {
    return false;  // 第一次运行，不算是重复
  }
  
  const lastOrders = JSON.parse(lastData[0].raw_data);
  
  if (newOrders.length !== lastOrders.length) {
    return false;  // 数量不同，不是重复
  }
  
  // 比较关键指纹：远端订单号 + 失败描述
  for (let i = 0; i < newOrders.length; i++) {
    const newKey = `${newOrders[i].orderId}|${newOrders[i].failReason}`;
    const lastKey = `${lastOrders[i].orderId}|${lastOrders[i].failReason}`;
    if (newKey !== lastKey) {
      return false;  // 有不同，不是重复
    }
  }
  
  return true;  // 完全一样，是重复
}

/**
 * 保存订单数据到数据库
 */
async function saveOrderData(taskId, orders) {
  await database.run(`
    INSERT INTO order_monitor_data (task_id, raw_data, notified)
    VALUES (?, ?, 0)
  `, [taskId, JSON.stringify(orders)]);
}
```

#### 通知逻辑

```javascript
async function runMonitor() {
  log('开始执行订单监控...');
  
  const tableData = await fetchFailedOrders();
  const newOrders = tableData.rows;
  
  // 检查是否重复
  const duplicate = await isDuplicate(newOrders, 'order-monitor');
  
  if (duplicate) {
    log('数据与上次相同，跳过通知');
    return {
      success: true,
      message: '数据无变化，跳过通知',
      notified: false
    };
  }
  
  // 保存数据
  await saveOrderData('order-monitor', newOrders);
  
  // 有新数据，发送通知
  const message = formatOrderMessage(tableData);
  await notifier.send({
    taskName: '订单监控',
    status: newOrders.length > 0 ? 'new_orders' : 'success',
    message: message,
    data: { orderCount: newOrders.length }
  });
  
  log(`发现 ${newOrders.length} 条新订单，已发送通知`);
  return {
    success: true,
    message: `发现 ${newOrders.length} 条新订单`,
    notified: true
  };
}
```

---

### 任务 2: 景区采购（优化版）

#### 配置
```json
{
  "id": "procurement",
  "name": "景区采购",
  "description": "在 12301 资源中心采购指定景点",
  "type": "browser",
  "schedule": "0 8,16 * * *",  // 每天 08:00 和 16:00
  "config": {
    "loginUrl": "https://my.12301.cc/home.html",
    "resourceUrl": "https://my.12301.cc/new/resourcecenter.html",
    "headless": false,  // 非无头模式
    "timeout": 120000,
    "screenshot": {
      "enabled": true,
      "retentionHours": 2,  // 2 小时后自动清理
      "path": "./logs/screenshots/procurement"
    },
    "notifyOnStart": true,  // 执行开始时通知
    "notifyOnSuccess": true,
    "notifyOnFailure": true,
    "feishuCommand": {
      "enabled": true,
      "trigger": "/procurement",
      "actions": ["run", "status", "help"]
    },
    "actions": [
      { "type": "navigate", "url": "{loginUrl}" },
      { "type": "login", "credentials": "ORDER_CREDENTIALS" },
      { "type": "navigate", "url": "{resourceUrl}" },
      { "type": "screenshot", "name": "resource-center" },
      { 
        "type": "loop",
        "items": "scenicSpots",
        "actions": [
          {
            "type": "search",
            "searchBox": ".search-bar input",
            "searchButton": ".search-bar button",
            "keyword": "{item.name}"
          },
          { "type": "screenshot", "name": "search-{item.name}" },
          {
            "type": "filter",
            "supplier": "{item.suppliers}",
            "action": "procure"
          },
          { "type": "screenshot", "name": "procure-{item.name}" }
        ]
      }
    ],
    "dataSource": {
      "scenicSpots": "SELECT * FROM scenic_spots WHERE enabled = 1"
    }
  }
}
```

#### 飞书命令触发

```javascript
// 接收飞书命令
async function handleFeishuCommand(command, userId) {
  const commands = {
    '/procurement run': async () => {
      log(`用户 ${userId} 手动触发景区采购`);
      await scheduler.executeTask('procurement');
      return '✅ 景区采购任务已启动';
    },
    '/procurement status': async () => {
      const task = await database.tasks.getById('procurement');
      return `📊 景区采购状态\n\n` +
             `状态：${task.enabled ? '✅ 运行中' : '❌ 已停止'}\n` +
             `调度：每天 08:00 和 16:00\n` +
             `上次执行：${task.last_run_at || '暂无'}`;
    },
    '/procurement help': async () => {
      return `📖 景区采购命令帮助\n\n` +
             `/procurement run - 手动执行任务\n` +
             `/procurement status - 查看任务状态\n` +
             `/procurement help - 显示帮助信息`;
    }
  };
  
  return await commands[command]();
}
```

#### 截图清理任务

```javascript
// 每小时检查并清理过期截图
cron.schedule('0 * * * *', async () => {
  const cleaned = await cleanupScreenshots();
  if (cleaned > 0) {
    log(`清理了 ${cleaned} 个过期截图`);
  }
}, {
  timezone: 'Asia/Shanghai'
});
```

---

### 任务 3: 景点同步（优化版）

#### 配置
```json
{
  "id": "sync-scenic",
  "name": "景点同步",
  "description": "同步票付通数据 + 刷新门票价格",
  "type": "browser",
  "schedule": "0 8,16 * * *",  // 每天 08:00 和 16:00
  "config": {
    "url": "https://vamall-admin.wfgravity.cn/#/event/index",
    "headless": false,  // 非无头模式防检测
    "stealth": true,    // 使用 stealth 插件
    "timeout": 180000,
    "screenshot": {
      "enabled": true,
      "retentionHours": 2,  // 2 小时后自动清理
      "path": "./logs/screenshots/sync-scenic"
    },
    "notifyOnStart": true,  // 执行开始时通知
    "notifyOnSuccess": true,
    "notifyOnFailure": true,
    "feishuCommand": {
      "enabled": true,
      "trigger": "/sync-scenic",
      "actions": ["run", "status", "help"]
    },
    "actions": [
      { "type": "navigate", "url": "{url}" },
      { "type": "screenshot", "name": "login-page" },
      { "type": "login", "credentials": "PIAOFUTONG_CREDENTIALS" },
      { "type": "screenshot", "name": "dashboard" },
      {
        "type": "loop",
        "items": "scenicSpots",
        "actions": [
          {
            "type": "click",
            "selector": "button:contains('同步票付通')"
          },
          { "type": "screenshot", "name": "sync-dialog-{item.name}" },
          {
            "type": "input",
            "selector": ".el-dialog input",
            "value": "{item.supplierId}",
            "submit": true
          },
          { "type": "wait", "duration": 2000 },
          {
            "type": "click",
            "selector": "button:contains('刷新门票价格')"
          },
          { "type": "screenshot", "name": "refresh-dialog-{item.name}" },
          {
            "type": "input",
            "selector": ".el-dialog input",
            "value": "{item.scenicCode}",
            "submit": true
          },
          { "type": "wait", "duration": 5000 },
          { "type": "screenshot", "name": "complete-{item.name}" }
        ]
      }
    ],
    "dataSource": {
      "scenicSpots": "SELECT * FROM scenic_spots WHERE enabled = 1"
    }
  }
}
```

#### Stealth 配置（防检测）

```javascript
// 使用 puppeteer-extra + stealth 插件
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function launchBrowser() {
  return await puppeteer.launch({
    headless: false,  // 非无头模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });
}
```

#### 飞书命令触发

```javascript
const syncCommands = {
  '/sync-scenic run': async () => {
    log(`用户 ${userId} 手动触发景点同步`);
    await scheduler.executeTask('sync-scenic');
    return '✅ 景点同步任务已启动';
  },
  '/sync-scenic status': async () => {
    const task = await database.tasks.getById('sync-scenic');
    return `📊 景点同步状态\n\n` +
           `状态：${task.enabled ? '✅ 运行中' : '❌ 已停止'}\n` +
           `调度：每天 08:00 和 16:00\n` +
           `上次执行：${task.last_run_at || '暂无'}`;
  },
  '/sync-scenic help': async () => {
    return `📖 景点同步命令帮助\n\n` +
           `/sync-scenic run - 手动执行任务\n` +
           `/sync-scenic status - 查看任务状态\n` +
           `/sync-scenic help - 显示帮助信息`;
  }
};
```

---

## 四、前端页面设计

### 页面结构

```
管理后台
├── 仪表盘（Dashboard）
│   ├── 任务状态概览
│   ├── 执行统计图表
│   └── 最近告警
│
├── 任务管理（Tasks）
│   ├── 任务列表
│   ├── 任务配置
│   └── 执行日志
│
├── 景点管理（Scenic Spots）
│   ├── 景点列表
│   ├── 添加景点
│   └── 批量操作
│
├── 供应商管理（Suppliers）
│   ├── 供应商列表
│   ├── 添加供应商
│   └── 关联景点
│
├── 采购记录（Records）
│   ├── 记录列表
│   ├── 统计分析
│   └── 导出功能
│
└── 系统设置（Settings）
    ├── 基础配置
    ├── 通知配置
    └── 数据备份
```

### 关键页面原型

#### 1. 仪表盘
```
┌─────────────────────────────────────────────────────────────┐
│  📊 自动化系统仪表盘                              🤖 v1.0.0  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 总任务数 │ │ 运行中   │ │ 今日执行 │ │ 失败告警 │      │
│  │    3     │ │    2     │ │   128    │ │    1     │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  任务状态                                            │   │
│  │  ✅ 订单监控      每 10 分钟   上次：2 分钟前        │   │
│  │  ✅ 景区采购      每 10 分钟   上次：2 分钟前        │   │
│  │  ⚠️  景点同步     每 1 分钟    上次：1 分钟前        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  最近告警                                            │   │
│  │  ⚠️  14:30 订单监控 - 发现 3 条失败订单              │   │
│  │  ❌ 14:20 景点同步 - 执行超时                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. 任务列表
```
┌─────────────────────────────────────────────────────────────┐
│  任务管理                              [+ 新建任务]          │
├─────────────────────────────────────────────────────────────┤
│  名称      状态    调度表达式    版本   上次执行   操作     │
│  ─────────────────────────────────────────────────────────  │
│  订单监控  🟢 运行  */10 * * * *  v12    2 分钟前   [⏹][▶][✏]│
│  景区采购  🟢 运行  */10 * * * *  v8     2 分钟前   [⏹][▶][✏]│
│  景点同步  🟡 运行  */1 * * * *   v25    1 分钟前   [⏹][▶][✏]│
│                                                             │
│  [1] [2] [3] ... [10]                                       │
└─────────────────────────────────────────────────────────────┘
```

#### 3. 景点管理
```
┌─────────────────────────────────────────────────────────────┐
│  景点管理                              [+ 添加景点]          │
├─────────────────────────────────────────────────────────────┤
│  名称              供应商 ID    景点编码      状态   操作   │
│  ─────────────────────────────────────────────────────────  │
│  美龄宫           243487      E20260210000301  ✅   [✏][🗑]│
│  金顶索道         556274      E20250718000171  ✅   [✏][🗑]│
│  卧佛院           676343      E20260108000001  ✅   [✏][🗑]│
│                                                             │
│  批量操作：[启用选中] [禁用选中] [删除选中]                 │
│                                                             │
│  [1] [2] [3] ... [5]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、API 接口设计

### 任务管理 API
```
GET    /api/tasks              # 获取任务列表
GET    /api/tasks/:id          # 获取任务详情
POST   /api/tasks              # 创建任务
PUT    /api/tasks/:id          # 更新任务
DELETE /api/tasks/:id          # 删除任务
POST   /api/tasks/:id/toggle   # 启停任务
POST   /api/tasks/:id/run      # 手动执行
GET    /api/tasks/:id/logs     # 获取日志
```

### 景点管理 API
```
GET    /api/scenic-spots       # 获取景点列表
GET    /api/scenic-spots/:id   # 获取景点详情
POST   /api/scenic-spots       # 添加景点
PUT    /api/scenic-spots/:id   # 更新景点
DELETE /api/scenic-spots/:id   # 删除景点
POST   /api/scenic-spots/batch # 批量操作
```

### 供应商管理 API
```
GET    /api/suppliers          # 获取供应商列表
POST   /api/suppliers          # 添加供应商
PUT    /api/suppliers/:id      # 更新供应商
DELETE /api/suppliers/:id      # 删除供应商
```

### 采购记录 API
```
GET    /api/records            # 获取采购记录
GET    /api/records/stats      # 统计数据
POST   /api/records/export     # 导出数据
```

### 系统管理 API
```
GET    /api/version            # 获取版本
POST   /api/version/increment  # 增加版本
GET    /api/logs               # 获取系统日志
POST   /api/backup             # 备份数据库
GET    /api/health             # 健康检查
```

---

## 六、安全设计

### 1. 敏感信息管理
```bash
# .env 文件
ORDER_USERNAME=daclaw
ORDER_PASSWORD=Qwert12345@@!!
PIAOFUTONG_USERNAME=xxx
PIAOFUTONG_PASSWORD=xxx
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
```

### 2. 数据脱敏
```javascript
// 日志脱敏
function sanitizeLog(data) {
  return {
    ...data,
    password: '***',
    credentials: '***'
  };
}
```

### 3. 操作审计
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 七、部署方案

### 开发环境
```bash
# 后端
cd backend
npm install
npm run init-db
npm run dev  # http://localhost:3000

# 前端
cd frontend
npm install
npm run dev  # http://localhost:3001
```

### 生产环境
```bash
# 使用 PM2 管理
pm2 start backend/src/index.js --name autoops
pm2 save
pm2 startup
```

### Docker 部署（可选）
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./
EXPOSE 3000

CMD ["node", "src/index.js"]
```

---

## 八、监控与告警

### 监控指标
- 任务执行成功率
- 平均执行时长
- 浏览器实例数
- 数据库连接数
- API 响应时间

### 告警规则
- 任务连续失败 3 次
- 执行超时（> 5 分钟）
- 数据库备份失败
- 系统资源不足

### 告警方式
- 飞书消息（即时）
- 邮件（汇总）
- 系统日志（持久化）

---

## 九、开发计划（优化版）

### Phase 1 - 基础框架（已完成）✅
- [x] 项目骨架
- [x] 数据库设计
- [x] API 路由
- [x] 任务调度器
- [x] 订单监控迁移（基础版）

### Phase 2 - 任务优化迁移（进行中）⏳

#### 2.1 订单监控优化
- [ ] 数据库去重逻辑实现
- [ ] 仅在有新订单时通知
- [ ] 通知模板优化

#### 2.2 景区采购迁移
- [ ] 任务脚本迁移
- [ ] 每天 2 次调度配置（08:00, 16:00）
- [ ] 截图功能 + 2 小时自动清理
- [ ] 飞书命令触发（/procurement run）
- [ ] 执行开始通知

#### 2.3 景点同步迁移
- [ ] 任务脚本迁移
- [ ] 每天 2 次调度配置（08:00, 16:00）
- [ ] Stealth 防检测配置
- [ ] 截图功能 + 2 小时自动清理
- [ ] 飞书命令触发（/sync-scenic run）
- [ ] 执行开始通知

#### 2.4 截图清理任务
- [ ] 定时清理脚本（每小时执行）
- [ ] 数据库截图记录表
- [ ] 清理日志记录

### Phase 3 - 飞书集成（待开始）
- [ ] 飞书命令接收接口
- [ ] 命令路由器（/procurement, /sync-scenic, /status）
- [ ] 命令响应模板
- [ ] 权限验证（可选）

### Phase 4 - 前端开发（待开始）
- [ ] 仪表盘页面
  - [ ] 任务状态概览
  - [ ] 执行统计图表
  - [ ] 最近告警列表
- [ ] 任务管理页面
  - [ ] 任务列表
  - [ ] 任务配置编辑
  - [ ] 执行日志查看
- [ ] 景点管理页面
  - [ ] 景点列表
  - [ ] 添加/编辑景点
  - [ ] 批量操作
- [ ] 供应商管理页面
  - [ ] 供应商列表
  - [ ] 关联景点
- [ ] 截图管理页面
  - [ ] 截图列表
  - [ ] 手动清理
  - [ ] 查看大图

### Phase 5 - 功能完善（待开始）
- [ ] 错误重试机制
- [ ] 数据导出功能（Excel/CSV）
- [ ] 统计分析图表
- [ ] 批量操作
- [ ] 告警规则配置

### Phase 6 - 测试部署（待开始）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 生产部署
- [ ] 监控告警配置

---

## 十、优化总结

### 核心优化点

| 优化项 | 原方案 | 优化后 | 收益 |
|--------|--------|--------|------|
| 景区采购频率 | 每 10 分钟 | 每天 2 次 | 减少 72 倍执行次数 |
| 景点同步频率 | 每 1 分钟 | 每天 2 次 | 减少 720 倍执行次数 |
| 截图管理 | 永久保存 | 2 小时自动清理 | 节省存储空间 |
| 订单监控通知 | 每次执行 | 仅新数据通知 | 减少骚扰 |
| 任务触发 | 仅定时 | 定时 + 飞书命令 | 更灵活 |

### 预期效果

1. **降低系统负载**
   - 景区采购：144 次/天 → 2 次/天
   - 景点同步：1440 次/天 → 2 次/天
   - 总体减少约 99% 的执行次数

2. **节省存储资源**
   - 截图自动清理，避免无限增长
   - 预计节省 80%+ 存储空间

3. **提升用户体验**
   - 减少重复通知骚扰
   - 支持飞书命令灵活触发
   - 执行开始通知，实时掌握状态

4. **增强安全性**
   - Stealth 防检测
   - 非无头模式更真实
   - 降低封号风险

---

**优化设计方案完成！** 🤖🚀

---

**设计方案完成！准备开始实施。** 🤖🚀
