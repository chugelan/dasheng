# 🚀 AutoOps Master - 完整启动指南

**更新时间：** 2026-03-07 22:40  
**版本：** v1.0.0

---

## 一、快速启动（3 步）

### 步骤 1: 启动后端

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/backend

# 安装依赖（首次运行）
npm install

# 导入任务配置
node scripts/import-tasks.js

# 启动服务
node src/index.js
```

**预期输出：**
```
✅ 数据库初始化成功
调度器启动成功
✅ 截图清理任务已启动
截图清理任务已启动
🚀 AutoOps 服务已启动：http://localhost:3000
📊 管理后台：http://localhost:3000
🔌 API 端点：http://localhost:3000/api
📱 飞书 Webhook: /feishu/message
```

---

### 步骤 2: 启动前端（新终端）

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system/frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
```

**预期输出：**
```
  VITE v5.1.0  ready in 500 ms

  ➜  Local:   http://localhost:3001/
  ➜  Network: use --host to expose
```

---

### 步骤 3: 访问管理后台

打开浏览器访问：**http://localhost:3001**

---

## 二、功能测试

### 1. 查看仪表盘

访问：http://localhost:3001

**应该看到：**
- ✅ 任务统计卡片（总任务数、运行中、已停止）
- ✅ 系统版本信息
- ✅ 截图存储统计
- ✅ 任务列表（3 个任务）
- ✅ 飞书命令提示

---

### 2. 查看任务列表

点击左侧菜单 **"任务管理"**

**应该看到：**
- ✅ 订单监控（每 10 分钟）
- ✅ 景区采购（每天 08:00 和 16:00）
- ✅ 景点同步（每天 08:00 和 16:00）

---

### 3. 查看截图管理

点击左侧菜单 **"截图管理"**

**应该看到：**
- ✅ 截图统计（总数、存储空间、即将过期）
- ✅ 截图列表（如果有截图）
- ✅ 清理按钮

---

### 4. 手动执行任务

#### 方式一：通过管理后台

1. 访问任务列表
2. 找到"订单监控"任务
3. 点击"执行"按钮
4. 等待执行完成

#### 方式二：通过 API

```bash
# 获取任务 ID
curl http://localhost:3000/api/tasks

# 执行任务
curl -X POST http://localhost:3000/api/tasks/order-monitor/run
```

#### 方式三：通过飞书（需配置）

在飞书群发送：
```
/order run
```

---

## 三、飞书机器人配置

### 1. 在飞书群添加机器人

1. 打开飞书群
2. 点击右上角设置
3. 选择"机器人"
4. 点击"添加机器人"
5. 选择"自定义机器人"
6. 命名机器人（如：AutoOps Master）

### 2. 配置 Webhook

**重要：** 需要在飞书开放平台配置

1. 访问：https://open.feishu.cn/app
2. 创建应用
3. 添加机器人能力
4. 配置事件订阅
5. 订阅消息接收事件
6. 配置请求地址：`http://你的服务器IP:3000/feishu/message`

### 3. 测试命令

在飞书群发送：
```
/help
```

**预期回复：**
```
🤖 AutoOps Master - 可用命令

/help - 显示帮助信息
/status - 查看系统状态
/tasks - 查看任务列表
/order - 订单监控命令
/procurement - 景区采购命令
/sync-scenic - 景点同步命令
```

---

## 四、环境变量配置

编辑 `backend/config/.env`：

```bash
# 系统配置
NODE_ENV=development
PORT=3000

# 订单系统凭据（必须配置）
ORDER_USERNAME=你的用户名
ORDER_PASSWORD=你的密码

# Chrome 路径（Mac）
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# 飞书 Webhook（已配置）
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/8b4130e0-b822-4c13-a6bb-0b1ad3b84685

# 票付通凭据（可选，默认使用订单系统凭据）
# PIAOFUTONG_USERNAME=xxx
# PIAOFUTONG_PASSWORD=xxx
```

---

## 五、任务说明

### 1. 订单监控

**频率：** 每 10 分钟  
**功能：** 监控 12301 平台下游失败订单  
**特点：**
- 数据去重（相同数据不重复通知）
- 仅新订单通知
- 飞书推送

**触发命令：** `/order run`

---

### 2. 景区采购

**频率：** 每天 08:00 和 16:00  
**功能：** 在 12301 资源中心采购指定景点  
**特点：**
- 自动截图（2 小时清理）
- 执行开始/完成通知
- 支持多供应商

**触发命令：** `/procurement run`

---

### 3. 景点同步

**频率：** 每天 08:00 和 16:00  
**功能：** 同步票付通数据 + 刷新门票价格  
**特点：**
- Stealth 防检测
- 非无头模式
- 自动截图（2 小时清理）

**触发命令：** `/sync-scenic run`

---

## 六、常见问题

### Q1: 后端启动失败

**错误：** `Cannot find module 'xxx'`

**解决：**
```bash
cd backend
npm install
```

---

### Q2: 前端页面空白

**检查：**
1. 后端是否已启动
2. 浏览器控制台是否有错误
3. API 地址是否正确

**解决：**
```bash
# 检查后端
curl http://localhost:3000/api/health

# 重启前端
cd frontend
npm run dev
```

---

### Q3: 任务执行失败

**检查：**
1. 环境变量是否配置（ORDER_USERNAME, ORDER_PASSWORD）
2. Chrome 是否已安装
3. 网络连接是否正常

**查看日志：**
```bash
tail -f backend/logs/combined.log
```

---

### Q4: 飞书命令无响应

**检查：**
1. 飞书机器人配置是否正确
2. Webhook 地址是否可访问
3. 服务器防火墙是否开放 3000 端口

**测试 Webhook：**
```bash
curl -X POST http://localhost:3000/feishu/message \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 七、目录结构

```
automation-system/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── api/               # API 路由
│   │   ├── database/          # 数据库
│   │   ├── executor/          # 任务执行器
│   │   ├── notifier/          # 通知模块
│   │   ├── scheduler/         # 调度器
│   │   └── utils/             # 工具函数
│   ├── scripts/               # 脚本工具
│   ├── config/                # 配置文件
│   ├── logs/                  # 日志
│   └── data/                  # 数据
│
├── frontend/                   # 前端管理后台
│   ├── src/
│   │   ├── api/               # API 请求
│   │   ├── components/        # 组件
│   │   ├── pages/             # 页面
│   │   └── styles/            # 样式
│   └── public/                # 静态资源
│
├── tasks/                      # 任务脚本
│   ├── order-monitor-enhanced.js
│   ├── procurement.js
│   └── sync-scenic.js
│
└── docs/                       # 文档
```

---

## 八、下一步

### 已实现功能 ✅
- ✅ 任务管理（创建/编辑/启停/执行）
- ✅ 定时调度（Cron 表达式）
- ✅ 浏览器自动化（Puppeteer）
- ✅ 飞书通知（Webhook + 命令）
- ✅ 截图管理（2 小时自动清理）
- ✅ 前端管理后台（仪表盘/任务/截图）

### 待实现功能 ⏳
- ⏳ 景点/供应商管理 UI
- ⏳ 任务配置编辑 UI
- ⏳ 统计图表
- ⏳ 数据导出

---

## 九、技术支持

**文档位置：**
- `docs/IMPLEMENTATION_PHASE1.md` - Phase 1 实施报告
- `docs/IMPLEMENTATION_PHASE2_3.md` - Phase 2&3 实施报告
- `docs/QUICK_TEST.md` - 快速测试指南
- `docs/TEST_RESULTS.md` - 测试结果

**GitHub 仓库：**
https://github.com/chugelan/dasheng

---

**祝使用愉快！** 🤖🚀
