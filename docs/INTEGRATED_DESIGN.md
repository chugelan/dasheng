# 🎯 自动化系统整合设计方案

**设计时间：** 2026-03-07 21:50  
**设计者：** AutoOps Master 🤖

---

## 一、系统架构

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

### 任务 1: 订单监控

#### 配置
```json
{
  "id": "order-monitor",
  "name": "订单监控",
  "description": "监控 12301 平台下游失败订单",
  "type": "browser",
  "schedule": "*/10 * * * *",
  "config": {
    "loginUrl": "https://my.12301.cc/home.html",
    "headless": true,
    "timeout": 60000,
    "deduplication": true,
    "maxOrders": 5,
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

#### 数据去重逻辑
```javascript
function isDuplicate(newOrders, lastOrders) {
  if (lastOrders.length === 0) return false;
  if (newOrders.length !== lastOrders.length) return false;
  
  // 比较关键指纹：远端订单号 + 失败描述
  for (let i = 0; i < newOrders.length; i++) {
    const newKey = `${newOrders[i].orderId}|${newOrders[i].failReason}`;
    const lastKey = `${lastOrders[i].orderId}|${lastOrders[i].failReason}`;
    if (newKey !== lastKey) return false;
  }
  
  return true;
}
```

---

### 任务 2: 景区采购

#### 配置
```json
{
  "id": "procurement",
  "name": "景区采购",
  "description": "在 12301 资源中心采购指定景点",
  "type": "browser",
  "schedule": "*/10 * * * *",
  "config": {
    "loginUrl": "https://my.12301.cc/home.html",
    "resourceUrl": "https://my.12301.cc/new/resourcecenter.html",
    "headless": false,
    "timeout": 120000,
    "actions": [
      { "type": "navigate", "url": "{loginUrl}" },
      { "type": "login", "credentials": "ORDER_CREDENTIALS" },
      { "type": "navigate", "url": "{resourceUrl}" },
      { 
        "type": "loop",
        "items": "scenicSpots",  // 从数据库读取
        "actions": [
          {
            "type": "search",
            "searchBox": ".search-bar input",
            "searchButton": ".search-bar button",
            "keyword": "{item.name}"
          },
          {
            "type": "filter",
            "supplier": "{item.suppliers}",
            "action": "procure"
          }
        ]
      }
    ],
    "dataSource": {
      "scenicSpots": "SELECT * FROM scenic_spots WHERE enabled = 1"
    }
  }
}
```

---

### 任务 3: 景点同步

#### 配置
```json
{
  "id": "sync-scenic",
  "name": "景点同步",
  "description": "同步票付通数据 + 刷新门票价格",
  "type": "browser",
  "schedule": "*/1 * * * *",  // 每 1 分钟
  "config": {
    "url": "https://vamall-admin.wfgravity.cn/#/event/index",
    "headless": false,  // 非无头模式防检测
    "stealth": true,    // 使用 stealth 插件
    "timeout": 180000,
    "actions": [
      { "type": "navigate", "url": "{url}" },
      { "type": "login", "credentials": "PIAOFUTONG_CREDENTIALS" },
      {
        "type": "loop",
        "items": "scenicSpots",
        "actions": [
          {
            "type": "click",
            "selector": "button:contains('同步票付通')"
          },
          {
            "type": "input",
            "selector": ".el-dialog input",
            "value": "{item.supplierId}",
            "submit": true
          },
          {
            "type": "wait",
            "duration": 2000
          },
          {
            "type": "click",
            "selector": "button:contains('刷新门票价格')"
          },
          {
            "type": "input",
            "selector": ".el-dialog input",
            "value": "{item.scenicCode}",
            "submit": true
          },
          {
            "type": "wait",
            "duration": 5000
          }
        ]
      }
    ],
    "dataSource": {
      "scenicSpots": "SELECT * FROM scenic_spots WHERE enabled = 1"
    }
  }
}
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

## 九、开发计划

### Phase 1 - 基础框架（已完成）✅
- [x] 项目骨架
- [x] 数据库设计
- [x] API 路由
- [x] 任务调度器
- [x] 订单监控迁移

### Phase 2 - 任务迁移（进行中）⏳
- [ ] 景区采购任务迁移
- [ ] 景点同步任务迁移
- [ ] 配置文件转换

### Phase 3 - 前端开发（待开始）
- [ ] 仪表盘页面
- [ ] 任务管理页面
- [ ] 景点管理页面
- [ ] 供应商管理页面

### Phase 4 - 功能完善（待开始）
- [ ] 错误重试机制
- [ ] 数据导出功能
- [ ] 统计分析图表
- [ ] 批量操作

### Phase 5 - 测试部署（待开始）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 生产部署

---

**设计方案完成！准备开始实施。** 🤖🚀
