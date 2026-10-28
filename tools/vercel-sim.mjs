/**
 * 本地模拟 Vercel Serverless 调用, 验证 api/dispatch.js 的路由还原逻辑
 * 模拟行为: vercel.json rewrite 后函数收到 req.url=/api/dispatch, 原始路径在 x-original-url
 * 用法: node tools/vercel-sim.mjs
 */
import { createServer } from 'node:http';

const mod = await import('../api/dispatch.js');
const handler = mod.default;

const server = createServer(async (req, res) => {
  const orig = req.url;
  req.url = '/api/dispatch';
  req.headers['x-original-url'] = orig;
  await handler(req, res);
});

server.listen(8899, async () => {
  const base = 'http://127.0.0.1:8899';
  const check = async (path, expect) => {
    const r = await fetch(base + path);
    const text = await r.text();
    const ok = text.includes(expect);
    console.log(`${ok ? '✓' : '✗'} ${path} → ${r.status} ${ok ? '(内容正确)' : `(期望包含 ${expect}, 实际 ${text.slice(0, 120)})`}`);
    return ok;
  };
  let all = true;
  all = (await check('/api/health', '"ok":true')) && all;
  all = (await check('/api/templates', '"categories"')) && all;
  all = (await check('/api/works', '"items"')) && all;
  // 多段路径必须能进 express (关键回归: 线上 catch-all 只匹配单段导致 404)
  all = (await check('/api/templates/main-white', '"id":"main-white"')) && all;
  all = (await check('/api/batch', '"items"')) && all;
  // 不带 /api 前缀的旧形态 (部分部署形态 req.url 被剥前缀)
  all = (await check('/index', '"name":"996 Studio API"')) && all;
  // 未注册的多段路由应到 express 默认 404 (而非平台 NOT_FOUND 页) → 证明多段路径进了 express
  all = (await check('/generate/nope', 'Cannot GET')) && all;
  console.log(all ? '\n全部通过 ✅' : '\n存在失败 ❌');
  server.close();
  process.exit(all ? 0 : 1);
});
