# 📦 GitHub 仓库创建指南

---

## 一、创建 GitHub 仓库

### 步骤 1: 访问 GitHub

打开浏览器访问：https://github.com

### 步骤 2: 登录账号

使用你的 GitHub 账号登录（如果没有，先注册一个）

### 步骤 3: 创建新仓库

1. 点击右上角 **"+"** 图标
2. 选择 **"New repository"**

### 步骤 4: 填写仓库信息

```
Repository name: autoops-master
Description: AutoOps Master - 自动化系统管理平台
Visibility: ○ Private（推荐，保护配置信息）
☑ Initialize this repository with a README（不要勾选，我们已有 README）
```

### 步骤 5: 点击创建

点击 **"Create repository"** 按钮

### 步骤 6: 复制仓库地址

创建成功后，复制仓库 URL，格式：
```
https://github.com/你的用户名/autoops-master.git
```

---

## 二、配置本地 Git

### 1. 设置 Git 用户信息（首次使用）

```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
```

### 2. 关联远程仓库

```bash
cd /Users/ti.zen/.openclaw/workspace/automation-system

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/autoops-master.git

# 验证
git remote -v
```

### 3. 推送代码到 GitHub

```bash
# 推送 main 分支
git push -u origin main

# 如果是私有仓库且需要认证，会提示输入账号密码
# 建议使用 Personal Access Token (PAT) 代替密码
```

---

## 三、创建 Personal Access Token（推荐）

### 为什么需要 PAT？

GitHub 已不再支持使用账号密码进行 Git 操作，需要使用 Personal Access Token。

### 创建步骤

1. 访问：https://github.com/settings/tokens
2. 点击 **"Generate new token (classic)"**
3. 填写备注：`autoops-master`
4. 选择权限：
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. 点击 **"Generate token"**
6. **复制 Token**（只显示一次，妥善保存！）

### 使用 PAT 推送

```bash
# 推送时使用 Token 代替密码
git push -u origin main

# 当提示输入密码时，粘贴 Token
# 或者直接在 URL 中包含 Token（不推荐）：
# git remote set-url origin https://你的用户名:TOKEN@github.com/你的用户名/autoops-master.git
```

---

## 四、配置 GitHub Actions（可选）

### 1. 创建工作流文件

在仓库中创建：`.github/workflows/release.yml`

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

### 2. 推送工作流

```bash
git add .github/workflows/release.yml
git commit -m "ci: 添加 GitHub Actions 工作流"
git push origin main
```

---

## 五、发布第一个 Release

### 1. 创建 Tag

```bash
# 创建版本号 Tag
git tag -a v1.0.0 -m "Initial release - AutoOps Master v1.0.0"

# 推送 Tag
git push origin v1.0.0
```

### 2. 创建 GitHub Release

**方式一：通过 GitHub 网页**

1. 访问：https://github.com/你的用户名/autoops-master/releases
2. 点击 **"Create a new release"**
3. 选择 Tag: `v1.0.0`
4. 填写 Release Title: `v1.0.0 - Initial Release`
5. 填写描述（可自动生成）
6. 点击 **"Publish release"**

**方式二：通过 GitHub CLI**

```bash
# 安装 GitHub CLI
brew install gh

# 登录
gh auth login

# 创建 Release
gh release create v1.0.0 --title "v1.0.0 - Initial Release" --generate-notes
```

---

## 六、常见问题

### Q1: 推送时提示权限错误

```bash
# 检查远程仓库地址
git remote -v

# 重新设置（使用正确的用户名）
git remote set-url origin https://github.com/你的用户名/autoops-master.git

# 使用 Token 推送
git push -u origin main
```

### Q2: 忘记保存 Token

Token 只显示一次，如果忘记了：
1. 访问：https://github.com/settings/tokens
2. 删除旧 Token
3. 创建新 Token
4. 更新本地配置

### Q3: 私有仓库还是公有仓库？

**推荐私有仓库**，因为：
- 包含环境变量和配置信息
- 包含飞书 Webhook URL
- 包含业务逻辑

如果要用公有仓库：
- 确保 `.env` 文件在 `.gitignore` 中
- 使用 `.env.example` 作为模板
- 不要在代码中硬编码敏感信息

---

## 七、安全检查清单

推送前确认：

- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 没有硬编码密码、Token、Webhook URL
- [ ] 敏感配置使用环境变量
- [ ] `package-lock.json` 已忽略（可选）
- [ ] 日志文件已忽略

---

## 八、快速命令参考

```bash
# 查看远程仓库
git remote -v

# 添加远程仓库
git remote add origin https://github.com/用户名/仓库名.git

# 推送代码
git push -u origin main

# 创建 Tag
git tag -a v1.0.0 -m "Release message"

# 推送 Tag
git push origin v1.0.0

# 查看 Tag
git tag -l

# 拉取最新代码
git pull origin main
```

---

**仓库创建完成后，告诉我仓库地址，我帮你配置自动推送！** 🚀
