# 🚀 AutoOps Master - 发布流程文档

---

## 一、版本号规则

采用 **SemVer 2.0.0** 规范：

```
主版本号。次版本号.修订号 (MAJOR.MINOR.PATCH)
  ↑        ↑        ↑
  重大变更  新功能     Bug 修复
```

### 版本号递增规则

| 场景 | 版本号变化 | 示例 |
|------|-----------|------|
| 任务成功执行一次 | PATCH +1 | 1.0.1 → 1.0.2 |
| 新增功能模块 | MINOR +1 | 1.0.5 → 1.1.0 |
| 重大架构变更 | MAJOR +1 | 1.9.0 → 2.0.0 |

### 发布次数统计

- 每个任务独立统计 `publish_count`
- 每次成功执行自动 +1
- 版本号 = `1.0.{publish_count}`

---

## 二、发布流程

### 2.1 开发阶段

```bash
# 1. 创建功能分支
git checkout -b feature/new-task-type

# 2. 开发 + 测试
# ... 编码 ...

# 3. 本地测试
cd backend && npm run test
cd frontend && npm run build

# 4. 提交代码
git add .
git commit -m "feat: 新增 API 任务类型支持"
```

### 2.2 代码审查

```bash
# 1. 推送到 GitHub
git push origin feature/new-task-type

# 2. 创建 Pull Request
# - 填写变更说明
# - 关联 Issue
# - 等待 Review

# 3. CI/CD 自动检查
# - 代码风格检查
# - 单元测试
# - 构建验证
```

### 2.3 发布到 GitHub

```bash
# 1. 合并到主分支
git checkout main
git pull origin main
git merge feature/new-task-type

# 2. 更新版本号（自动）
# 每次任务执行成功会自动递增

# 3. 创建 Git Tag
git tag -a v1.0.5 -m "Release v1.0.5 - API 任务类型支持"
git push origin v1.0.5

# 4. 创建 GitHub Release
# - 访问 https://github.com/xxx/autoops/releases/new
# - 选择 Tag: v1.0.5
# - 填写 Release Notes
# - 发布
```

### 2.4 部署到生产环境

```bash
# 方式一：手动部署
cd /path/to/production
git pull origin main
cd backend && npm install && npm run start

# 方式二：Docker 部署
docker pull your-registry/autoops:latest
docker-compose up -d

# 方式三：自动化部署（推荐）
# 通过 GitHub Actions 自动部署
```

---

## 三、GitHub Actions 配置

### `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Build
        run: |
          cd frontend && npm run build
      
      - name: Run tests
        run: |
          cd backend && npm test
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/autoops
            git pull origin main
            cd backend && npm install
            pm2 restart autoops
```

---

## 四、备份策略

### 4.1 自动备份

```bash
# 每天凌晨 2 点自动备份数据库
0 2 * * * cd /path/to/autoops/backend && node scripts/backup-database.js
```

### 4.2 备份保留策略

- 保留最近 **10 个** 备份文件
- 每个备份文件约 **1-10 MB**
- 备份位置：`backend/data/backups/`

### 4.3 恢复流程

```bash
# 1. 停止服务
pm2 stop autoops

# 2. 找到要恢复的备份
ls -lh backend/data/backups/

# 3. 恢复数据库
cp backend/data/backups/autoops-backup-2026-03-07.db backend/data/autoops.db

# 4. 重启服务
pm2 start autoops
```

---

## 五、回滚流程

### 5.1 代码回滚

```bash
# 回滚到上一个版本
git revert HEAD

# 或者重置到指定 Tag
git reset --hard v1.0.4
git push -f origin main
```

### 5.2 数据库回滚

```bash
# 使用备份恢复（见 4.3）
```

### 5.3 通知用户

```markdown
## ⚠️ 紧急回滚通知

**回滚时间：** 2026-03-07 21:30
**回滚版本：** v1.0.5 → v1.0.4
**原因：** 发现严重 Bug

请知悉，服务已恢复正常。
```

---

## 六、发布检查清单

### 发布前 ✅

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 更新 CHANGELOG.md
- [ ] 更新版本号
- [ ] 备份数据库
- [ ] 通知相关人员

### 发布中 ✅

- [ ] 创建 Git Tag
- [ ] 推送 Tag 到 GitHub
- [ ] 创建 GitHub Release
- [ ] 触发 CI/CD 部署
- [ ] 监控部署日志

### 发布后 ✅

- [ ] 验证服务正常运行
- [ ] 检查任务执行状态
- [ ] 确认通知正常发送
- [ ] 更新文档
- [ ] 通知用户

---

## 七、监控与告警

### 7.1 健康检查端点

```bash
GET /api/health
```

响应示例：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-07T21:30:00Z",
    "uptime": 86400
  }
}
```

### 7.2 监控指标

- 任务执行成功率
- 平均执行时长
- 飞书通知成功率
- API 响应时间
- 数据库连接状态

### 7.3 告警配置

通过飞书机器人配置告警：
- 任务连续失败 3 次
- 服务不可用
- 数据库备份失败

---

## 八、变更日志模板

### `CHANGELOG.md`

```markdown
# 变更日志

## [1.0.5] - 2026-03-07

### ✨ 新增
- 新增 API 任务类型支持
- 新增任务配置导出功能

### 🐛 修复
- 修复登录超时问题
- 修复飞书通知格式错误

### 📝 文档
- 更新 API 文档
- 新增部署指南

## [1.0.4] - 2026-03-06

### ✨ 新增
- 新增任务执行日志查看

### 🐛 修复
- 修复数据库备份路径错误
```

---

**发布流程文档版本：** v1.0.0  
**最后更新：** 2026-03-07  
**维护者：** AutoOps Master
