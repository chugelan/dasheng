# 🚀 AutoOps Master - 快速启动指南

**更新时间：** 2026-03-07 21:30

---

## 一、环境准备

### 1. 检查 Node.js 版本

```bash
node -v
# 需要 >= 18.0.0
```

如果版本过低，请升级：
```bash
brew install node@20
```

### 2. 配置环境变量

编辑 `backend/config/.env` 文件，已配置：

```bash
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/8b4130e0-b822-4c13-a6bb-0b1ad3b84685
```

### 3. 配置订单系统凭据

在 `backend/config/.env` 中添加：

```bash
ORDER_USERNAME=你的订单系统用户名
ORDER_PASSWORD=你的订单系统密码
```

⚠️ **注意：** 不要将 `.env` 文件提交到 Git！

---

## 二、安装依赖

### 1. 安装后端依赖

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend
npm install
```

### 2. 安装前端依赖

```bash
cd ../frontend
npm install
```

---

## 三、初始化数据库

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend
npm run init-db
```

预期输出：
```
✅ 数据库初始化成功
系统版本：1.0.0 (build 1)
现有任务数：0
```

---

## 四、导入订单监控任务

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend
node scripts/import-task.js ../tasks/order-monitor.config.json
```

预期输出：
```
✅ 任务已创建：订单监控 (uuid)

📋 当前任务列表:
  - 订单监控 (运行中) - */10 * * * *
```

---

## 五、启动服务

### 方式一：开发模式（推荐首次使用）

**终端 1 - 启动后端：**
```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend
npm run dev
```

**终端 2 - 启动前端：**
```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/frontend
npm run dev
```

访问：
- 前端管理后台：http://localhost:3001
- 后端 API：http://localhost:3000/api

### 方式二：生产模式

**只启动后端（前端已构建）：**
```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend
npm start
```

访问：http://localhost:3000

---

## 六、验证功能

### 1. 检查健康状态

```bash
curl http://localhost:3000/api/health
```

预期响应：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-07T21:30:00Z",
    "uptime": 123.456
  }
}
```

### 2. 查看任务列表

```bash
curl http://localhost:3000/api/tasks
```

### 3. 手动执行订单监控任务

```bash
curl -X POST http://localhost:3000/api/tasks/{任务 ID}/run
```

或者在管理后台点击"执行"按钮。

### 4. 检查飞书通知

等待任务执行完成后，检查飞书群是否收到通知。

---

## 七、配置订单系统凭据

### 1. 编辑 .env 文件

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend/config
vim .env
```

### 2. 添加凭据

```bash
ORDER_USERNAME=your_username
ORDER_PASSWORD=your_password
```

### 3. 重启服务

```bash
# 停止后端（Ctrl+C）
# 重新启动
npm start
```

---

## 八、使用管理后台

### 1. 访问管理后台

打开浏览器：http://localhost:3001

### 2. 主要功能

- **任务列表** - 查看所有任务状态、启停任务、手动执行
- **任务配置** - 编辑任务参数、调度表达式
- **执行日志** - 查看任务执行历史
- **系统设置** - 备份数据库、查看版本

### 3. 创建新任务

1. 点击"新建任务"
2. 填写任务名称
3. 设置调度表达式（如 `*/10 * * * *` 表示每 10 分钟）
4. 配置任务参数
5. 保存

---

## 九、常用操作

### 查看任务状态

```bash
curl http://localhost:3000/api/tasks
```

### 查看任务日志

```bash
curl http://localhost:3000/api/tasks/{任务 ID}/logs
```

### 备份数据库

```bash
curl -X POST http://localhost:3000/api/backup
```

或在管理后台点击"备份"按钮。

### 查看系统版本

```bash
curl http://localhost:3000/api/version
```

---

## 十、故障排查

### 问题 1: 后端启动失败

**错误：** `Error: Cannot find module 'better-sqlite3'`

**解决：**
```bash
cd backend
npm install
```

### 问题 2: 飞书通知失败

**检查：**
1. Webhook URL 是否正确
2. 网络连接是否正常
3. 查看日志：`tail -f backend/logs/error.log`

### 问题 3: 订单监控任务执行失败

**检查：**
1. 订单系统凭据是否正确
2. Chrome 是否已安装
3. 查看任务日志

### 问题 4: 前端无法连接后端

**检查：**
1. 后端是否已启动
2. 端口 3000 是否被占用
3. 检查代理配置：`frontend/vite.config.js`

---

## 十一、下一步

### 1. 创建 GitHub 仓库

参考：[GITHUB_SETUP.md](GITHUB_SETUP.md)

### 2. 配置 CI/CD

推送代码后自动部署。

### 3. 添加更多任务

参考 `tasks/order-monitor.config.json` 创建新任务配置。

### 4. 定制通知模板

修改 `backend/src/notifier/index.js` 中的消息格式。

---

## 十二、命令速查表

```bash
# 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 初始化数据库
npm run init-db

# 导入任务
node scripts/import-task.js tasks/xxx.config.json

# 启动后端
npm start          # 生产模式
npm run dev        # 开发模式

# 启动前端
cd frontend && npm run dev

# 查看日志
tail -f logs/combined.log

# 备份数据库
npm run backup

# 推送 GitHub
git add . && git commit -m "message" && git push origin main
```

---

**有问题随时找我！** 🤖 AutoOps Master
