import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// 请求拦截器
api.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API 请求失败:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
