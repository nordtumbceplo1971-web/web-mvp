/**
 * ZIP 打包接口实测: 用真实 CDN 图测试 /api/works/export-zip
 * 输出: .skill-tmp/e2e-results.json 里的 7 张图 → test-export.zip
 */
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const results = JSON.parse(fs.readFileSync('D:/ai-server-mvp/.skill-tmp/e2e-results.json', 'utf8'));
const NAMES = {
  '01': '01-列表主图', '02': '02-背面展示', '03': '03-完整穿搭',
  '04': '04-印花细节', '05': '05-面料做工', '06': '06-另一位模特', '07': '07-品牌生活方式',
};

const items = Object.entries(results).map(([id, r]) => ({ name: NAMES[id], url: r.url }));
console.log(`打包 ${items.length} 张真实 CDN 图...`);

const res = await fetch(`${BASE}/api/works/export-zip`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Shopify套图-E2E测试', items }),
});

console.log(`HTTP ${res.status} | content-type=${res.headers.get('content-type')} | packed=${res.headers.get('x-packed-count')}`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync('D:/ai-server-mvp/.skill-tmp/test-export.zip', buf);
console.log(`ZIP 已保存: ${(buf.length / 1024 / 1024).toFixed(2)} MB, 头部字节: ${buf.subarray(0, 2).toString()} (PK=正确)`);

// 空 items 应 400
const bad = await fetch(`${BASE}/api/works/export-zip`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [] }),
});
console.log(`空 items 防护: HTTP ${bad.status} (期望 400)`);
process.exit(res.ok && bad.status === 400 ? 0 : 1);
