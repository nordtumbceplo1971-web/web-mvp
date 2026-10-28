/**
 * Vercel Serverless Function 入口 (由 vercel.json rewrites 显式路由: /api/(.*) → /api/dispatch)
 *
 * 为什么不用 api/[...path].js catch-all:
 *   线上实测 (v0.1.33) 平台路由只把「单段」/api/* 匹配进 catch-all 函数,
 *   多段路径 (/api/generate/image、/api/tasks/:id、/api/batch/:id) 全部被平台
 *   直接 404 (Vercel NOT_FOUND 页, 未进函数)。改用 rewrites + 无方括号函数名规避。
 *
 * Vercel rewrite 行为: 函数收到的 req.url 是 destination (/api/dispatch),
 * 原始路径 (含 query) 放在 x-original-url 头 → 从这里还原。
 */
import { createApp } from '../backend/src/app.js';

const app = createApp();

export default async function handler(req, res) {
  const orig = req.headers['x-original-url'] || req.url || '/';
  req.url = orig.startsWith('/api') ? orig : (orig === '/' ? '/api' : `/api${orig.startsWith('/') ? '' : '/'}${orig}`);
  return app(req, res);
}
