/**
 * 快速测试脚本
 * 测试核心功能
 */

const db = require('./src/database/simple-db');
const logger = require('./src/utils/logger');

console.log('🧪 开始测试 AutoOps Master 功能...\n');

// 测试 1: 数据库初始化
console.log('测试 1: 数据库初始化');
try {
  db.initialize();
  console.log('✅ 数据库初始化成功\n');
} catch (error) {
  console.log('❌ 数据库初始化失败:', error.message, '\n');
}

// 测试 2: 读取景点数据
console.log('测试 2: 读取景点数据');
try {
  const spots = db.getCollection('scenic_spots');
  console.log(`✅ 景点数量：${spots.length}`);
  spots.forEach(spot => {
    console.log(`  - ${spot.name} (供应商 ID: ${spot.supplier_id})`);
  });
  console.log();
} catch (error) {
  console.log('❌ 读取景点数据失败:', error.message, '\n');
}

// 测试 3: 读取供应商数据
console.log('测试 3: 读取供应商数据');
try {
  const suppliers = db.getCollection('suppliers');
  console.log(`✅ 供应商数量：${suppliers.length}`);
  suppliers.forEach(s => {
    console.log(`  - ${s.name} (${s.platform})`);
  });
  console.log();
} catch (error) {
  console.log('❌ 读取供应商数据失败:', error.message, '\n');
}

// 测试 4: 插入任务
console.log('测试 4: 创建任务');
try {
  const task = db.insert('tasks', {
    id: 'test-task-1',
    name: '测试任务',
    enabled: 1,
    schedule: '*/10 * * * *'
  });
  console.log(`✅ 任务创建成功：${task.name} (ID: ${task.id})\n`);
} catch (error) {
  console.log('❌ 创建任务失败:', error.message, '\n');
}

// 测试 5: 查询任务
console.log('测试 5: 查询任务');
try {
  const tasks = db.getCollection('tasks');
  console.log(`✅ 任务数量：${tasks.length}`);
  tasks.forEach(t => {
    console.log(`  - ${t.name} (${t.schedule})`);
  });
  console.log();
} catch (error) {
  console.log('❌ 查询任务失败:', error.message, '\n');
}

// 测试 6: 更新任务
console.log('测试 6: 更新任务');
try {
  const task = db.find('tasks', { id: 'test-task-1' });
  if (task) {
    db.update('tasks', task.id, { enabled: 0 });
    const updated = db.find('tasks', { id: 'test-task-1' });
    console.log(`✅ 任务更新成功：${updated.name} (enabled: ${updated.enabled})\n`);
  }
} catch (error) {
  console.log('❌ 更新任务失败:', error.message, '\n');
}

// 测试 7: 截图管理
console.log('测试 7: 截图统计');
try {
  const screenshots = db.getCollection('screenshots');
  console.log(`✅ 截图数量：${screenshots.length}\n`);
} catch (error) {
  console.log('❌ 截图统计失败:', error.message, '\n');
}

// 测试 8: 系统版本
console.log('测试 8: 系统版本');
try {
  const version = db.getData()?.system_version;
  console.log(`✅ 系统版本：v${version.version} (build ${version.build_number})\n`);
} catch (error) {
  console.log('❌ 获取版本失败:', error.message, '\n');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 所有测试完成！\n');

// 保存数据
db.save();
console.log('💾 数据已保存到：data/simple-db.json\n');
