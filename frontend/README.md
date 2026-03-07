# AutoOps Master 前端

> React + Ant Design 管理后台

---

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问：http://localhost:3001

### 3. 构建生产版本

```bash
npm run build
```

---

## 页面列表

| 页面 | 路径 | 说明 |
|------|------|------|
| **仪表盘** | `/` | 系统概览、任务统计、截图存储 |
| **任务管理** | `/tasks` | 任务列表、启停控制、手动执行 |
| **截图管理** | `/screenshots` | 截图列表、预览、清理 |
| **执行日志** | `/logs` | 任务执行历史 |
| **系统设置** | `/settings` | 系统配置 |

---

## 功能特性

### 仪表盘
- ✅ 任务统计（总数/运行中/已停止）
- ✅ 系统版本显示
- ✅ 截图存储统计
- ✅ 任务列表快速查看
- ✅ 飞书命令提示

### 任务管理
- ✅ 任务列表展示
- ✅ 启用/禁用切换
- ✅ 手动执行任务
- ✅ 查看执行日志
- ✅ 编辑任务配置

### 截图管理
- ✅ 截图列表
- ✅ 图片预览
- ✅ 文件大小显示
- ✅ 过期时间提示
- ✅ 手动清理过期截图
- ✅ 存储统计

---

## API 配置

前端通过 Vite 代理连接到后端：

```javascript
// vite.config.js
server: {
  port: 3001,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

---

## 技术栈

- **React** 18.2.0
- **Ant Design** 5.14.1
- **Vite** 5.1.0
- **React Router** 6
- **Axios** (API 请求)
- **Zustand** (状态管理)

---

## 目录结构

```
frontend/
├── src/
│   ├── api/              # API 请求
│   │   └── request.js
│   ├── components/       # 公共组件
│   │   └── Layout.jsx
│   ├── pages/            # 页面
│   │   ├── Dashboard.jsx
│   │   ├── TaskList.jsx
│   │   ├── Screenshots.jsx
│   │   ├── Logs.jsx
│   │   └── Settings.jsx
│   ├── styles/           # 样式
│   │   └── index.css
│   ├── App.jsx           # 应用入口
│   └── main.jsx          # React 入口
├── index.html
├── package.json
└── vite.config.js
```

---

## 开发指南

### 添加新页面

1. 在 `src/pages/` 创建新组件
2. 在 `App.jsx` 添加路由
3. 在 `Layout.jsx` 添加菜单项

### 调用 API

```javascript
import api from '../api/request';

// GET 请求
const res = await api.get('/tasks');

// POST 请求
await api.post('/tasks', { name: '新任务' });
```

---

## 注意事项

1. **后端服务必须先启动** - 前端依赖后端 API
2. **代理配置** - 确保 Vite 代理指向正确的后端地址
3. **跨域问题** - 开发环境使用代理，生产环境需配置 CORS

---

## 故障排查

### 问题：页面空白

**检查：**
1. 浏览器控制台是否有错误
2. 后端服务是否已启动
3. API 地址是否正确

### 问题：API 请求失败

**解决：**
```bash
# 检查后端是否运行
curl http://localhost:3000/api/health

# 检查代理配置
cat vite.config.js
```

---

**前端开发完成！** 🎨
