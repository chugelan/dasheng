# 🧪 快速测试指南

**更新时间：** 2026-03-07 22:05  
**适用版本：** Phase 1

---

## 一、环境准备

### 1. 安装依赖

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend

# 安装基础依赖
npm install

# 安装额外依赖（用于 stealth 功能）
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

### 2. 配置环境变量

编辑 `backend/config/.env`：

```bash
# 系统配置
NODE_ENV=development
PORT=3000

# 数据库配置
DB_PATH=./data/autoops.db

# 订单系统凭据
ORDER_USERNAME=daclaw
ORDER_PASSWORD=Qwert12345@@!!

# Chrome 路径（Mac）
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# 飞书 Webhook
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/8b4130e0-b822-4c13-a6bb-0b1ad3b84685
```

---

## 二、数据库初始化

### 1. 初始化基础数据库

```bash
cd backend
npm run init-db
```

**预期输出：**
```
✅ 数据库初始化成功
系统版本：1.0.0 (build 1)
现有任务数：0
```

### 2. 执行数据库迁移

```bash
npm run migrate
```

**预期输出：**
```
✅ 数据库迁移完成
当前数据库表：order_monitor_data, procurement_records, scenic_spots, screenshots, suppliers, tasks, ...
景点数量：3
供应商数量：2
```

---

## 三、启动服务

### 1. 启动后端

```bash
# 开发模式（自动重启）
npm run dev

# 或生产模式
npm start
```

**预期输出：**
```
✅ 数据库初始化成功
调度器启动成功
✅ 截图清理任务已启动（每小时执行）
截图清理任务已启动
🚀 AutoOps 服务已启动：http://localhost:3000
📊 管理后台：http://localhost:3000
🔌 API 端点：http://localhost:3000/api
```

### 2. 启动前端（可选）

```bash
cd ../frontend
npm install
npm run dev
```

访问：http://localhost:3001

---

## 四、功能测试

### 测试 1: 健康检查

```bash
curl http://localhost:3000/api/health
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-07T14:05:00.000Z",
    "uptime": 123.456
  }
}
```

---

### 测试 2: 截图统计

```bash
curl http://localhost:3000/api/screenshots/stats
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "total": 0,
    "size": 0,
    "sizeFormatted": "0 B",
    "expiringSoon": 0
  }
}
```

---

### 测试 3: 查看任务列表

```bash
curl http://localhost:3000/api/tasks
```

**预期响应：**
```json
{
  "success": true,
  "data": []
}
```

---

### 测试 4: 创建订单监控任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单监控",
    "description": "监控 12301 平台下游失败订单",
    "schedule": "*/10 * * * *",
    "config": {
      "type": "script",
      "command": "node tasks/order-monitor-enhanced.js",
      "cwd": "/Users/ti.zen/.openclaw/workspace/automation-system",
      "timeout": 120000,
      "notifyOnSuccess": true,
      "notifyOnFailure": true
    },
    "enabled": true
  }'
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "name": "订单监控",
    "schedule": "*/10 * * * *",
    "enabled": true
  }
}
```

---

### 测试 5: 手动执行订单监控

```bash
# 获取任务 ID
TASK_ID=$(curl http://localhost:3000/api/tasks | jq -r '.data[0].id')

# 执行任务
curl -X POST http://localhost:3000/api/tasks/$TASK_ID/run
```

**预期输出（后端日志）：**
```
开始执行订单监控任务...
开始登录订单系统...
页面加载完成
正在登录...
✅ 登录成功
展开"近 7 天待办"...
点击"下游失败订单"...
抓取到 3 条订单
数据与上次相同，跳过通知
任务执行完成 (15234ms)
```

---

### 测试 6: 查看订单监控数据

```bash
curl http://localhost:3000/api/tasks/$TASK_ID/logs
```

**预期响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "task_id": "uuid-xxx",
      "status": "success",
      "message": "发现 0 条新订单",
      "started_at": "2026-03-07T14:05:00.000Z",
      "duration_ms": 15234
    }
  ]
}
```

---

### 测试 7: 查看数据库表

```bash
cd backend
sqlite3 data/autoops.db ".tables"
```

**预期输出：**
```
order_monitor_data    procurement_records   scenic_spots        
screenshots           suppliers             tasks               
task_logs             system_version        backup_records      
```

---

### 测试 8: 查看景点数据

```bash
sqlite3 data/autoops.db "SELECT * FROM scenic_spots;"
```

**预期输出：**
```
1|美龄宫|243487|E20260210000301|1|0|2026-03-07 22:05:00|2026-03-07 22:05:00
2|卧佛院|676343|E20260108000001|1|0|2026-03-07 22:05:00|2026-03-07 22:05:00
3|金顶索道|556274|E20250718000171|1|0|2026-03-07 22:05:00|2026-03-07 22:05:00
```

---

## 五、飞书通知测试

### 1. 检查 Webhook 配置

```bash
grep FEISHU_WEBHOOK_URL backend/config/.env
```

**预期输出：**
```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

### 2. 手动测试飞书通知

```bash
cd backend
node -e "
const notifier = require('./src/notifier');
notifier.send({
  taskName: '测试任务',
  status: 'success',
  message: '这是一条测试通知',
  color: 'green'
}).then(() => {
  console.log('✅ 测试通知已发送');
  process.exit(0);
}).catch(err => {
  console.error('❌ 发送失败:', err);
  process.exit(1);
});
"
```

**预期输出：**
```
✅ 飞书消息发送成功
✅ 测试通知已发送
```

---

## 六、截图清理测试

### 1. 创建测试截图

```bash
node -e "
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, 'backend/logs/screenshots/test');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// 创建一个 2 小时前的假截图文件
const filePath = path.join(screenshotDir, 'test-old.png');
fs.writeFileSync(filePath, 'fake image data');

// 修改文件时间到 2 小时前
const oldTime = Date.now() - (3 * 60 * 60 * 1000); // 3 小时前
fs.utimesSync(filePath, new Date(oldTime), new Date(oldTime));

console.log('✅ 测试截图已创建:', filePath);
"
```

### 2. 手动触发清理

```bash
curl -X POST http://localhost:3000/api/screenshots/cleanup
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "cleaned": 1
  }
}
```

### 3. 验证清理结果

```bash
ls -la backend/logs/screenshots/test/
```

**预期：** 目录为空或文件已被标记为清理

---

## 七、性能测试

### 1. 并发请求测试

```bash
# 使用 ab 工具（Apache Benchmark）
ab -n 100 -c 10 http://localhost:3000/api/health
```

**预期：** 所有请求成功，响应时间 < 100ms

### 2. 内存使用测试

```bash
# 监控 Node.js 进程内存
watch -n 1 "ps aux | grep 'node src/index.js' | grep -v grep | awk '{print \$6}'"
```

**预期：** 内存稳定，无持续增长

---

## 八、常见问题排查

### 问题 1: 数据库迁移失败

**错误：** `table already exists`

**解决：**
```bash
# 删除数据库重新初始化
rm backend/data/autoops.db
npm run init-db
npm run migrate
```

### 问题 2: Chrome 无法启动

**错误：** `Chrome failed to launch`

**解决：**
```bash
# 检查 Chrome 路径
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 或安装 Chrome
brew install --cask google-chrome
```

### 问题 3: 飞书通知失败

**错误：** `Invalid webhook token`

**解决：**
- 检查 Webhook URL 是否正确
- 确认飞书机器人在群里
- 测试 Webhook：`curl -X POST <webhook_url> -d '{"msg_type":"text","content":{"text":"test"}}'`

### 问题 4: 端口被占用

**错误：** `EADDRINUSE: address already in use`

**解决：**
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或修改端口
export PORT=3001
```

---

## 九、测试检查清单

### 基础测试
- [ ] 后端服务启动成功
- [ ] 前端服务启动成功（可选）
- [ ] 健康检查 API 正常
- [ ] 数据库表创建成功

### 功能测试
- [ ] 订单监控任务执行成功
- [ ] 数据去重逻辑正常
- [ ] 飞书通知发送成功
- [ ] 截图管理 API 正常

### 性能测试
- [ ] API 响应时间 < 100ms
- [ ] 内存使用稳定
- [ ] 截图清理正常

### 集成测试
- [ ] 定时任务正常调度
- [ ] 截图清理定时执行
- [ ] 日志记录完整

---

**测试指南完成！如有问题请查看日志或联系我。** 🤖🔧
