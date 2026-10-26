/**
 * Vercel Serverless Function 入口
 * 路由: /api/*  →  本函数 (catch-all)
 * 说明: 前端与 API 同域部署, 前端 api.js 用的相对路径 /api/... 直接命中这里
 */
import { createApp } from '../backend/src/app.js';

const app = createApp();

export default async function handler(req, res) {
  // 兼容不同部署形态下的 req.url: 统一还原为 /api/<path>
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = url === '/' ? '/api' : `/api${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return app(req, res);
}
