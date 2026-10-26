/**
 * 本地模拟 Vercel Serverless 调用, 验证 api/[...path].js 的路由还原逻辑
 * 用法: node tools/vercel-sim.mjs
 */
import { createServer } from 'node:http';

const mod = await import('../api/[...path].js');
const handler = mod.default;

const server = createServer(async (req, res) => {
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
  // 模拟 Vercel 把路径改写成 /index 的情况
  all = (await check('/index', '"name":"BrandStudio API"')) && all;
  console.log(all ? '\n全部通过 ✅' : '\n存在失败 ❌');
  server.close();
  process.exit(all ? 0 : 1);
});
