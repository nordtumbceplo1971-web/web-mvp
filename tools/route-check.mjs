/**
 * 批量路由体检: 对每条路由跑一次 CDP 检查, 汇总标题 / 溢出 / 控制台报错
 * 用法: node tools/route-check.mjs [width] [height]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const width = Number(process.argv[2] || 1440);
const height = Number(process.argv[3] || 900);
const PORT = 9400 + (width % 5);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

const ROUTES = [
  ['首页', ''],
  ['模板库', 'templates'],
  ['模板详情', 'templates/main-white'],
  ['创作页', 'create?tpl=main-white'],
  ['Shopify套图', 'lookbook'],
  ['自由工作台', 'studio'],
  ['我的作品', 'works'],
  ['模特库', 'models'],
  ['充值页', 'recharge'],
  ['用户设置', 'settings'],
];

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${width},${height}`,
  `--user-data-dir=C:/Users/Admin/AppData/Local/Temp/bs-route-${PORT}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

async function findTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error('devtools target not found');
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
let consoleLogs = [];

await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleLogs.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleLogs.push(`EXCEPTION ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  id += 1;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });

const expr = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollWidth: document.documentElement.scrollWidth, overflow: [] };
  // 找到所有可横向滚动的祖先, 这些容器内的元素不算页面溢出
  const scrollables = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el);
    return s.overflowX === 'auto' || s.overflowX === 'scroll';
  });
  const inScrollable = (el) => {
    let p = el.parentElement;
    while (p) { if (scrollables.includes(p)) return true; p = p.parentElement; }
    return false;
  };
  document.querySelectorAll('*').forEach((el) => {
    if (inScrollable(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.width > vw + 1) {
      const cls = (typeof el.className === 'string') ? el.className : '';
      out.overflow.push(el.tagName + '.' + cls + ' w=' + Math.round(r.width));
    }
  });
  out.overflow = out.overflow.slice(0, 6);
  out.title = document.querySelector('.page-title')?.textContent;
  out.errText = document.querySelector('.api-error-title')?.textContent || null;
  out.crash = document.body.innerText.includes('页面加载出错');
  return JSON.stringify(out);
})()`;

let allOk = true;
console.log(`=== ${width}x${height} ===`);
for (const [label, hash] of ROUTES) {
  consoleLogs = [];
  await send('Page.navigate', { url: `${BASE}/#/${hash}` });
  await sleep(2200);
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  const o = JSON.parse(res.result.value);
  const overflow = o.scrollWidth > o.vw + 1 || o.overflow.length > 0;
  const bad = overflow || o.crash || consoleLogs.length > 0;
  if (bad) allOk = false;
  console.log(`${bad ? '✗' : '✓'} ${label.padEnd(6)} 标题=${o.title ?? '-'} 溢出=${o.scrollWidth - o.vw} 错误页=${o.errText ?? '-'} 崩溃=${o.crash} 控制台=${consoleLogs.length}`);
  if (consoleLogs.length) console.log(`    ${consoleLogs.slice(0, 3).join('\n    ')}`);
  if (o.overflow.length) console.log(`    溢出元素: ${o.overflow.join(', ')}`);
}

ws.close();
proc.kill();
console.log(allOk ? '\n全部路由体检通过 ✅' : '\n存在失败 ❌');
process.exit(allOk ? 0 : 1);
