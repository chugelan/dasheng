/**
 * 简化版数据库 - 使用 JSON 文件存储
 * 用于快速测试，无需编译依赖
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/simple-db.json');

// 默认数据结构
const DEFAULT_DATA = {
  tasks: [],
  scenic_spots: [
    { id: 1, name: '美龄宫', supplier_id: '243487', scenic_code: 'E20260210000301', enabled: 1 },
    { id: 2, name: '卧佛院', supplier_id: '676343', scenic_code: 'E20260108000001', enabled: 1 },
    { id: 3, name: '金顶索道', supplier_id: '556274', scenic_code: 'E20250718000171', enabled: 1 }
  ],
  suppliers: [
    { id: 1, name: '携程旅行（新）', platform: '12301', enabled: 1 },
    { id: 2, name: '同程旅行', platform: '12301', enabled: 1 }
  ],
  task_logs: [],
  order_monitor_data: [],
  procurement_records: [],
  screenshots: [],
  system_version: { version: '1.0.0', build_number: 1 }
};

let data = null;

/**
 * 初始化数据库
 */
function initialize() {
  const dataDir = path.dirname(DB_PATH);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  
  data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  return data;
}

/**
 * 保存数据
 */
function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * 获取集合
 */
function getCollection(name) {
  if (!data) initialize();
  return data[name] || [];
}

/**
 * 查找
 */
function find(collection, predicate) {
  const items = getCollection(collection);
  if (typeof predicate === 'function') {
    return items.find(predicate);
  }
  return items.find(item => {
    for (const [key, value] of Object.entries(predicate)) {
      if (item[key] !== value) return false;
    }
    return true;
  });
}

/**
 * 查询所有
 */
function findAll(collection, predicate) {
  const items = getCollection(collection);
  if (!predicate) return items;
  
  if (typeof predicate === 'function') {
    return items.filter(predicate);
  }
  return items.filter(item => {
    for (const [key, value] of Object.entries(predicate)) {
      if (item[key] !== value) return false;
    }
    return true;
  });
}

/**
 * 插入
 */
function insert(collection, item) {
  if (!data) initialize();
  if (!data[collection]) data[collection] = [];
  
  const id = data[collection].length > 0 
    ? Math.max(...data[collection].map(i => i.id || 0)) + 1 
    : 1;
  
  const newItem = { ...item, id, created_at: new Date().toISOString() };
  data[collection].push(newItem);
  save();
  return newItem;
}

/**
 * 更新
 */
function update(collection, id, updates) {
  if (!data) initialize();
  const items = data[collection];
  if (!items) return null;
  
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return null;
  
  data[collection][index] = { 
    ...data[collection][index], 
    ...updates, 
    updated_at: new Date().toISOString() 
  };
  save();
  return data[collection][index];
}

/**
 * 删除
 */
function remove(collection, id) {
  if (!data) initialize();
  const items = data[collection];
  if (!items) return false;
  
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return false;
  
  data[collection].splice(index, 1);
  save();
  return true;
}

/**
 * 执行 SQL 风格的查询（简化版）
 */
function query(sql, params = []) {
  // 这是一个简化实现，仅支持基本查询
  if (sql.includes('SELECT')) {
    const match = sql.match(/FROM\s+(\w+)/i);
    if (match) {
      const collection = match[1];
      return findAll(collection);
    }
  }
  return [];
}

module.exports = {
  initialize,
  save,
  getCollection,
  find,
  findAll,
  insert,
  update,
  remove,
  query,
  getData: () => data
};
