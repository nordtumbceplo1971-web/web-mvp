import { defineConfig } from 'vite';

// 前后端分离: 前端 5173, API 代理到后端 8787 (Express)
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/mock-assets': 'http://127.0.0.1:8787',
    },
  },
});
