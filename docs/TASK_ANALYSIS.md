# 📋 三个定时任务分析报告

**分析时间：** 2026-03-07 21:45  
**分析者：** AutoOps Master 🤖

---

## 一、任务概览

| 任务名称 | 目录 | 核心功能 | 执行频率 |
|---------|------|---------|---------|
| **订单监控** | `order-monitor` | 监控 12301 平台下游失败订单 | 每 10 分钟 |
| **景区采购** | `procurement` | 在 12301 资源中心搜索并采购景点 | 每 10 分钟 |
| **景点同步** | `sync-scenic` | 同步票付通数据 + 刷新门票价格 | 每 60 秒 |

---

## 二、详细分析

### 1. 📦 订单监控（order-monitor）

#### 功能描述
- 登录 12301 订单系统
- 抓取"下游失败订单"列表
- 数据去重（相同数据不重复通知）
- 飞书通知失败订单详情

#### 技术实现
```javascript
// 核心配置
{
  loginUrl: 'https://my.12301.cc/home.html',
  username: process.env.ORDER_USERNAME,
  password: process.env.ORDER_PASSWORD,
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  feishuWebhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
  maxOrders: 5,  // 最多输出 5 条
  schedule: '*/10 * * * *'  // 每 10 分钟
}
```

#### 执行流程
```
登录 12301 → 展开"近 7 天待办" → 点击"下游失败订单" 
→ 抓取表格数据 → 对比上次数据 → 去重判断 
→ 格式化消息 → 飞书通知 → 保存数据
```

#### 数据结构
```json
// last-orders.json
[
  {
    "cells": [
      "2026-03-07 10:00",  // 下单时间
      "12345678",          // 远端订单号
      "产品名称",
      "票种名称",
      "联系人",
      "手机号",
      "日志 ID",
      "票付通订单号",
      "失败描述"
    ]
  }
]
```

#### 优点
- ✅ 数据去重机制完善
- ✅ 日志记录详细
- ✅ 飞书通知及时

#### 缺点
- ❌ Chrome 路径硬编码（Windows）
- ❌ 无错误重试机制
- ❌ 无 Web 管理界面

---

### 2. 🛒 景区采购（procurement）

#### 功能描述
- 登录 12301 资源中心
- 根据配置文件搜索指定景点
- 自动执行采购流程
- 记录执行日志 + 飞书通知

#### 技术实现
```javascript
// 核心配置
{
  loginUrl: 'https://my.12301.cc/home.html',
  resourceUrl: 'https://my.12301.cc/new/resourcecenter.html',
  username: process.env.ORDER_USERNAME,
  password: process.env.ORDER_PASSWORD,
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  feishuWebhook: process.env.FEISHU_WEBHOOK,
  configDir: './config',
  logDir: './logs',
  schedule: '*/10 * * * *'  // 每 10 分钟
}
```

#### 配置文件
```json
// config/scenic-spots.json
{
  "scenicSpots": [
    {
      "name": "金顶索道",
      "suppliers": ["携程旅行（新）"],
      "enabled": true
    },
    {
      "name": "上海迪士尼度假区",
      "suppliers": ["携程旅行（新）"],
      "enabled": true
    }
  ]
}
```

#### 执行流程
```
登录 12301 → 进入资源中心 → 读取配置文件 
→ 遍历景点列表 → 搜索景点 → 筛选供应商 
→ 执行采购 → 记录日志 → 飞书通知
```

#### 核心功能函数
- `login(page)` - 自动登录
- `goToResourceCenter(page)` - 进入资源中心
- `searchScenicSpot(page, spotName)` - 搜索景点
- `closeAllDialogs(page)` - 关闭弹窗
- `procureProduct(page, supplier)` - 执行采购

#### 优点
- ✅ 配置文件管理景点列表
- ✅ 支持多个供应商
- ✅ 日志 + 截图双重记录

#### 缺点
- ❌ 无采购失败重试机制
- ❌ 供应商选择逻辑简单
- ❌ 无价格对比功能

---

### 3. 🔄 景点同步（sync-scenic）

#### 功能描述
- 登录票付通管理系统
- 同步供应商数据
- 刷新门票价格状态
- 高频执行（每 60 秒）

#### 技术实现
```javascript
// 核心配置
{
  url: 'https://vamall-admin.wfgravity.cn/#/event/index',
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  credentialsPath: './config/credentials.json',
  scenicSpotsPath: './config/scenic-spots.json',
  syncWaitTime: 60000,  // 60 秒
  headless: false  // 非无头模式（防检测）
}
```

#### 配置文件
```json
// config/scenic-spots.json
[
  {
    "name": "美龄宫",
    "supplierId": "243487",
    "scenicCode": "E20260210000301"
  },
  {
    "name": "金顶索道",
    "supplierId": "556274",
    "scenicCode": "E20250718000171"
  }
]
```

#### 执行流程
```
登录票付通 → 点击"同步票付通"按钮 
→ 输入供应商 ID → 确认同步 
→ 点击"刷新门票价格状态" → 输入景点编码 
→ 确认刷新 → 等待完成
```

#### 核心功能函数
- `login(page, credentials)` - 自动登录
- `clickSyncButton(page)` - 点击同步按钮
- `clickRefreshButton(page)` - 点击刷新按钮
- `fillSyncDialogInput(page, supplierId)` - 填写同步弹窗
- `fillRefreshDialogInput(page, scenicCode)` - 填写刷新弹窗

#### 技术特点
- ✅ 使用 `puppeteer-extra` + `stealth` 插件防检测
- ✅ 非无头模式（更真实）
- ✅ 输入延迟模拟人工操作

#### 缺点
- ❌ 高频执行（60 秒）可能触发风控
- ❌ 按钮选择器硬编码（易失效）
- ❌ 无错误恢复机制

---

## 三、共同特点

### 技术栈
| 技术 | 用途 | 版本 |
|------|------|------|
| Puppeteer | 浏览器自动化 | ^22.0.0 ~ ^24.15.0 |
| node-cron | 定时任务调度 | ^3.0.3 |
| dotenv | 环境变量管理 | ^16.0.0 |
| https | 飞书通知（原生） | - |

### 依赖的外部系统
1. **12301 平台** - 订单系统 + 资源中心
2. **票付通系统** - 景点管理后台
3. **飞书机器人** - 消息通知

### 共同问题
1. ❌ **Chrome 路径硬编码**（Windows 路径）
2. ❌ **错误处理不完善**
3. ❌ **无统一配置管理**
4. ❌ **无 Web 管理界面**
5. ❌ **日志分散**（每个任务独立日志）
6. ❌ **无统一监控仪表板**

---

## 四、配置迁移需求（Windows → Mac）

### 1. Chrome 路径
```javascript
// Windows
chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

// Mac
chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

### 2. 环境变量
```bash
# .env
ORDER_USERNAME=daclaw
ORDER_PASSWORD=Qwert12345@@!!
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

### 3. 状态检查脚本
```bash
#!/bin/bash
# status.sh - Mac 版本
echo "📊 自动化任务状态"

# 检查订单监控
if pgrep -f "order-monitor" > /dev/null; then
    echo "✅ 订单监控：运行中"
else
    echo "❌ 订单监控：未运行"
fi

# 检查景区采购
if pgrep -f "procurement" > /dev/null; then
    echo "✅ 景区采购：运行中"
else
    echo "❌ 景区采购：未运行"
fi

# 检查景点同步
if pgrep -f "sync-scenic" > /dev/null; then
    echo "✅ 景点同步：运行中"
else
    echo "❌ 景点同步：未运行"
fi
```

---

## 五、优化建议

### 架构层面
1. ✅ **统一任务管理框架** - 已创建的 `automation-system`
2. ✅ **统一配置中心** - 所有任务配置集中管理
3. ✅ **统一日志系统** - Winston 日志 + 文件轮转
4. ✅ **统一通知模块** - 飞书 Webhook + API 双模式
5. ✅ **Web 管理后台** - React + Ant Design

### 功能层面
1. ✅ **任务启停控制** - 无需重启进程
2. ✅ **配置热更新** - 修改配置立即生效
3. ✅ **执行历史记录** - SQLite 持久化
4. ✅ **版本号管理** - 每次执行自动递增
5. ✅ **数据库备份** - 自动备份策略

### 安全层面
1. ✅ **敏感信息环境变量化**
2. ✅ **不提交 .env 到 Git**
3. ✅ **日志脱敏处理**
4. ✅ **操作审计日志**

---

## 六、迁移到 AutoOps Master 的方案

### 任务映射

| 原任务 | 新位置 | 状态 |
|--------|--------|------|
| order-monitor | `tasks/order-monitor.js` | ✅ 已迁移 |
| procurement | `tasks/procurement.js` | ⏳ 待迁移 |
| sync-scenic | `tasks/sync-scenic.js` | ⏳ 待迁移 |

### 配置映射

| 原配置 | 新位置 | 说明 |
|--------|--------|------|
| .env | `backend/config/.env` | 统一环境变量 |
| scenic-spots.json | `backend/data/scenic-spots.json` | 统一景点配置 |
| credentials.json | `backend/data/credentials.json` | 统一凭据管理 |
| last-orders.json | `backend/data/order-monitor.json` | 任务数据 |

### 数据库表设计

```sql
-- 任务配置表（已有）
tasks (
  id, name, description, enabled, schedule, config,
  version, publish_count, last_run_at, last_status
)

-- 景点配置表（新增）
scenic_spots (
  id, name, supplier_id, scenic_code, enabled,
  created_at, updated_at
)

-- 供应商表（新增）
suppliers (
  id, name, platform, contact, enabled
)

-- 采购记录表（新增）
procurement_records (
  id, scenic_spot_id, supplier_id, status, price,
  executed_at, result
)
```

---

## 七、下一步行动计划

### Phase 1 - 环境准备（今天）
- [ ] 安装 Node.js + Chrome（Mac）
- [ ] 配置 .env 文件
- [ ] 测试订单监控任务

### Phase 2 - 任务迁移（明天）
- [ ] 迁移 procurement 任务
- [ ] 迁移 sync-scenic 任务
- [ ] 统一配置文件格式

### Phase 3 - 功能完善（本周）
- [ ] 完善前端管理页面
- [ ] 添加景点配置管理 UI
- [ ] 添加供应商管理 UI

### Phase 4 - 优化迭代（下周）
- [ ] 添加错误重试机制
- [ ] 添加价格对比功能
- [ ] 添加风控检测

---

**分析完成！准备开始设计新方案。** 🤖
