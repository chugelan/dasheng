# 📋 设计方案优化总结

**优化时间：** 2026-03-07 21:55  
**优化者：** AutoOps Master 🤖

---

## 一、优化需求

用户提出的优化要求：

1. **订单监控** - 每 10 分钟执行，数据去重不重复通知
2. **景区采购** - 每天 2 次（08:00, 16:00），支持飞书命令触发，截图 2 小时后清除
3. **景点同步** - 每天 2 次（08:00, 16:00），支持飞书命令触发，stealth 防检测，截图 2 小时后清除

---

## 二、优化对比

### 执行频率优化

| 任务 | 原频率 | 优化后 | 减少倍数 |
|------|--------|--------|----------|
| 订单监控 | 每 10 分钟 | 每 10 分钟 | ✅ 不变 |
| 景区采购 | 每 10 分钟 | 每天 2 次 | ⬇️ 72 倍 |
| 景点同步 | 每 1 分钟 | 每天 2 次 | ⬇️ 720 倍 |

### Cron 表达式

```javascript
// 订单监控 - 保持不变
'*/10 * * * *'  // 每 10 分钟

// 景区采购 - 优化后
'0 8,16 * * *'  // 每天 08:00 和 16:00

// 景点同步 - 优化后
'0 8,16 * * *'  // 每天 08:00 和 16:00

// 截图清理 - 新增
'0 * * * *'     // 每小时整点
```

---

## 三、核心优化点

### 1. 📦 订单监控优化

#### 优化内容
- ✅ **数据去重增强** - 使用数据库存储历史数据
- ✅ **智能通知** - 仅在有新订单时通知
- ✅ **比较逻辑** - 远端订单号 + 失败描述 双重校验

#### 实现逻辑
```javascript
// 去重检查
async function isDuplicate(newOrders, taskId) {
  const lastOrders = await database.getLastOrders(taskId);
  
  if (newOrders.length !== lastOrders.length) return false;
  
  for (let i = 0; i < newOrders.length; i++) {
    const newKey = `${newOrders[i].orderId}|${newOrders[i].failReason}`;
    const lastKey = `${lastOrders[i].orderId}|${lastOrders[i].failReason}`;
    if (newKey !== lastKey) return false;
  }
  
  return true;  // 完全一样，跳过通知
}
```

#### 通知策略
| 场景 | 原方案 | 优化后 |
|------|--------|--------|
| 无新订单 | 发送"无订单"通知 | ❌ 不通知 |
| 数据相同 | 发送"无变化"通知 | ❌ 不通知 |
| 有新订单 | ✅ 发送订单列表 | ✅ 发送订单列表 |
| 执行失败 | ✅ 发送错误信息 | ✅ 发送错误信息 |

---

### 2. 🛒 景区采购优化

#### 优化内容
- ✅ **频率降低** - 每 10 分钟 → 每天 2 次
- ✅ **飞书命令触发** - 支持 `/procurement run` 手动执行
- ✅ **截图管理** - 自动截图 + 2 小时后清理
- ✅ **执行通知** - 开始时通知、完成时通知、失败时通知

#### 飞书命令
```
/procurement run      # 手动执行任务
/procurement status   # 查看任务状态
/procurement help     # 显示帮助信息
```

#### 截图管理
```javascript
// 截图配置
screenshot: {
  enabled: true,
  retentionHours: 2,  // 2 小时后自动清理
  path: "./logs/screenshots/procurement"
}

// 清理任务（每小时执行）
cron.schedule('0 * * * *', async () => {
  await cleanupScreenshots();
});
```

#### 通知模板
```markdown
🔔 景区采购任务已启动

执行时间：2026-03-07 16:00:00
触发方式：定时执行 / 手动触发
景点数量：8 个

请稍候，执行完成后将发送结果通知...
```

---

### 3. 🔄 景点同步优化

#### 优化内容
- ✅ **频率降低** - 每 1 分钟 → 每天 2 次
- ✅ **飞书命令触发** - 支持 `/sync-scenic run` 手动执行
- ✅ **Stealth 防检测** - puppeteer-extra + stealth 插件
- ✅ **非无头模式** - 更真实，降低封号风险
- ✅ **截图管理** - 自动截图 + 2 小时后清理
- ✅ **执行通知** - 开始时通知、完成时通知、失败时通知

#### Stealth 配置
```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

await puppeteer.launch({
  headless: false,  // 非无头模式
  args: [
    '--disable-blink-features=AutomationControlled'
  ],
  ignoreDefaultArgs: ['--enable-automation']
});
```

#### 飞书命令
```
/sync-scenic run      # 手动执行任务
/sync-scenic status   # 查看任务状态
/sync-scenic help     # 显示帮助信息
```

---

### 4. 🧹 截图清理任务（新增）

#### 职责
- 每小时检查一次截图文件夹
- 删除超过 2 小时的截图
- 记录清理日志

#### 实现代码
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
        
        // 更新数据库记录
        await database.run(`
          UPDATE screenshots SET cleaned = 1 WHERE file_path = ?
        `, [filePath]);
      }
    }
  }
  
  log(`清理完成：删除 ${deletedCount} 个过期截图`);
  return deletedCount;
}
```

#### 数据库表
```sql
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

CREATE INDEX idx_screenshots_expires_at ON screenshots(expires_at);
CREATE INDEX idx_screenshots_cleaned ON screenshots(cleaned);
```

---

## 四、预期效果

### 1. 系统负载降低

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 景区采购执行次数/天 | 144 | 2 | ⬇️ 98.6% |
| 景点同步执行次数/天 | 1440 | 2 | ⬇️ 99.9% |
| 总体执行次数/天 | 1584 | 146 | ⬇️ 90.8% |

### 2. 存储空间节省

| 项目 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| 截图存储 | 无限增长 | 最多 2 小时 | ~80%+ |
| 日志存储 | 无限增长 | 定期清理 | ~50%+ |

### 3. 用户体验提升

- ✅ **减少通知骚扰** - 订单监控仅在有新数据时通知
- ✅ **灵活触发** - 支持飞书命令随时手动执行
- ✅ **实时状态** - 执行开始时即发送通知
- ✅ **更安全** - Stealth 防检测降低封号风险

---

## 五、实施计划

### 已完成 ✅
- [x] 设计方案优化文档
- [x] 数据库表设计
- [x] Cron 配置更新
- [x] 截图清理逻辑设计

### 待实施 ⏳

#### Phase 1: 核心功能（优先级：高）
- [ ] 订单监控去重逻辑实现
- [ ] 景区采购任务迁移
- [ ] 景点同步任务迁移
- [ ] 截图清理任务实现

#### Phase 2: 飞书集成（优先级：高）
- [ ] 飞书命令接收接口
- [ ] 命令路由器
- [ ] 命令响应模板

#### Phase 3: 通知优化（优先级：中）
- [ ] 执行开始通知
- [ ] 通知模板优化
- [ ] 通知频率控制

#### Phase 4: 前端开发（优先级：低）
- [ ] 截图管理页面
- [ ] 任务配置页面
- [ ] 统计图表

---

## 六、风险提示

### 1. 频率降低风险
- **风险：** 景点同步从每 1 分钟降为每天 2 次，可能导致数据更新不及时
- **缓解：** 支持飞书命令手动触发，需要时随时执行

### 2. 截图清理风险
- **风险：** 2 小时后自动清理，可能丢失重要截图
- **缓解：** 
  - 重要截图手动保存
  - 可配置保留时长
  - 数据库保留记录

### 3. Stealth 兼容性
- **风险：** stealth 插件可能与某些网站不兼容
- **缓解：** 
  - 测试验证
  - 准备备用方案
  - 日志记录详细错误

---

## 七、配置示例

### 完整任务配置

```json
{
  "id": "procurement",
  "name": "景区采购",
  "description": "在 12301 资源中心采购指定景点",
  "type": "browser",
  "schedule": "0 8,16 * * *",
  "enabled": true,
  "config": {
    "loginUrl": "https://my.12301.cc/home.html",
    "resourceUrl": "https://my.12301.cc/new/resourcecenter.html",
    "headless": false,
    "timeout": 120000,
    "screenshot": {
      "enabled": true,
      "retentionHours": 2,
      "path": "./logs/screenshots/procurement"
    },
    "notifyOnStart": true,
    "notifyOnSuccess": true,
    "notifyOnFailure": true,
    "feishuCommand": {
      "enabled": true,
      "trigger": "/procurement",
      "actions": ["run", "status", "help"]
    },
    "retryPolicy": {
      "maxRetries": 3,
      "retryDelay": 5000
    }
  }
}
```

---

## 八、总结

### 核心优化
1. ✅ **降低执行频率** - 减少 90%+ 的系统负载
2. ✅ **智能通知** - 仅在有变化时通知
3. ✅ **飞书命令** - 灵活手动触发
4. ✅ **截图清理** - 自动管理存储空间
5. ✅ **Stealth 防检测** - 提升安全性

### 下一步
1. 实施核心功能代码
2. 测试验证
3. 部署上线

---

**优化方案完成！准备开始实施。** 🤖🚀
