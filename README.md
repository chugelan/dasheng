# 🤖 AutoOps Master - 自动化系统

> 严谨、高效、安全优先的自动化任务管理平台

---

## 📖 项目简介

AutoOps Master 是一个完整的自动化系统管理平台，支持：

- ✅ **任务管理** - 创建、配置、启停定时任务
- ✅ **可视化后台** - 直观的任务列表、状态监控、日志查看
- ✅ **浏览器自动化** - 登录网站、执行操作、抓取数据
- ✅ **飞书通知** - 任务执行结果实时推送到飞书
- ✅ **版本追踪** - 自动记录发布次数和版本号
- ✅ **数据备份** - 定时备份 SQLite 数据库
- ✅ **模块化设计** - 易于扩展新任务类型

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React + Ant Design)       │
│                  http://localhost:3001               │
└─────────────────────────────────────────────────────┘
                          ↓ HTTP API
┌─────────────────────────────────────────────────────┐
│                  Backend (Node.js + Express)         │
│                  http://localhost:3000               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Scheduler│ │ Executor │ │ Notifier │            │
│  │ (node-cron)│ │(Puppeteer)│ │ (Feishu) │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Database │ │  Logger  │ │ Version  │            │
│  │ (SQLite) │ │ (Winston)│ │ Manager  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 3. 配置环境变量

```bash
# 复制配置模板
cd backend/config
cp .env.example .env

# 编辑 .env 文件，填入飞书 Webhook URL 等配置
```

### 4. 初始化数据库

```bash
cd backend
npm run init-db
```

### 5. 启动服务

```bash
# 启动后端（终端 1）
cd backend
npm start

# 启动前端（终端 2）
cd frontend
npm run dev
```

### 6. 访问管理后台

打开浏览器访问：http://localhost:3001

---

## 📋 API 文档

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/tasks` | 获取所有任务 |
| GET | `/api/tasks/:id` | 获取任务详情 |
| POST | `/api/tasks` | 创建任务 |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/tasks/:id/toggle` | 启停任务 |
| POST | `/api/tasks/:id/run` | 手动执行 |
| GET | `/api/tasks/:id/logs` | 获取日志 |

### 系统管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/version` | 获取系统版本 |
| POST | `/api/version/increment` | 增加版本号 |
| GET | `/api/logs` | 获取最近日志 |
| POST | `/api/backup` | 备份数据库 |
| GET | `/api/health` | 健康检查 |

---

## 📁 目录结构

```
automation-system/
├── backend/
│   ├── src/
│   │   ├── api/           # HTTP API 路由
│   │   ├── scheduler/     # 定时任务调度
│   │   ├── executor/      # 任务执行器
│   │   ├── notifier/      # 飞书通知
│   │   ├── database/      # SQLite 操作
│   │   ├── version/       # 版本管理
│   │   └── utils/         # 工具函数
│   ├── config/            # 配置文件
│   ├── scripts/           # 脚本工具
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面
│   │   ├── api/           # API 调用
│   │   └── styles/        # 样式
│   └── package.json
├── tasks/                 # 任务脚本
├── docs/                  # 文档
└── README.md
```

---

## 🔧 配置说明

### 环境变量（backend/config/.env）

```bash
# 系统配置
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# 数据库配置
DB_PATH=./data/autoops.db
BACKUP_DIR=./data/backups

# 飞书通知
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
FEISHU_APP_ID=cli_xxx          # API 方式需要
FEISHU_APP_SECRET=xxx          # API 方式需要
FEISHU_CHAT_ID=oc_xxx          # API 方式需要
```

---

## 📊 任务配置示例

### 订单监控任务

```json
{
  "name": "订单监控",
  "schedule": "*/10 * * * *",
  "config": {
    "type": "browser",
    "headless": true,
    "timeout": 60000,
    "actions": [
      {
        "type": "navigate",
        "url": "https://example.com/login"
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
        "selector": ".order-menu",
        "waitFor": ".order-list"
      },
      {
        "type": "scrape",
        "selector": ".order-item",
        "fields": [
          { "name": "orderId", "type": "text", "selector": ".order-id" },
          { "name": "status", "type": "text", "selector": ".order-status" },
          { "name": "amount", "type": "text", "selector": ".order-amount" }
        ]
      }
    ],
    "notifyOnSuccess": true,
    "notifyOnFailure": true
  }
}
```

---

## 📝 发布流程

详见：[docs/RELEASE_FLOW.md](docs/RELEASE_FLOW.md)

### 快速发布

```bash
# 1. 提交代码
git add .
git commit -m "feat: 新增功能描述"
git push origin main

# 2. 创建 Tag
git tag -a v1.0.5 -m "Release v1.0.5"
git push origin v1.0.5

# 3. 创建 GitHub Release
# 访问 https://github.com/xxx/autoops/releases/new
```

---

## 🔐 安全规范

### 敏感信息管理

- ✅ 使用环境变量存储凭据
- ✅ 不提交 `.env` 文件到 Git
- ✅ 日志中脱敏显示敏感信息
- ✅ 定期更新密码和 Token

### 操作安全

- ❌ 禁止删除生产环境文件
- ❌ 禁止访问受限域名
- ✅ 所有操作记录日志
- ✅ 危险操作前二次确认

---

## 📈 监控与日志

### 日志位置

```
backend/logs/
├── combined.log    # 所有日志
├── error.log       # 错误日志
└── tasks.log       # 任务执行日志
```

### 查看日志

```bash
# 实时查看
tail -f backend/logs/combined.log

# 查看错误
tail -f backend/logs/error.log
```

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交变更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 License

MIT License

---

## 👤 维护者

**AutoOps Master** 🤖

- 角色：自动化系统工程师
- 职责：自动化系统建设、代码开发、测试验证、GitHub 管理、部署发布

---

**最后更新：** 2026-03-07  
**当前版本：** v1.0.0
