/**
 * CDP 驱动的页面体检脚本 (Node 22 + 内置 WebSocket)
 * 用法: node tools/page-check.mjs [width] [height] [hash]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const width = Number(process.argv[2] || 1440);
const height = Number(process.argv[3] || 900);
const hash = process.argv[4] || '';
const PORT = 9333 + (width % 7);

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${width},${height}`,
  `--user-data-dir=C:/Users/Admin/AppData/Local/Temp/bs-cdp-${PORT}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
proc.stderr.on('data', (b) => process.stderr.write(`[edge] ${b.toString().slice(0, 200)}\n`));

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
const consoleLogs = [];

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
  if (msg.method === 'Runtime.consoleAPICalled') {
    consoleLogs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleLogs.push(`[exception] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description ?? ''}`);
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
await send('Page.navigate', { url: `http://127.0.0.1:5173/#/${hash}` });
await sleep(3000);

const expr = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollWidth: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, overflow: [] };
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.width > vw + 1) {
      const cls = (typeof el.className === 'string') ? el.className : '';
      out.overflow.push(el.tagName + '.' + cls + ' w=' + Math.round(r.width) + ' right=' + Math.round(r.right) + ' text=' + (el.textContent||'').trim().slice(0, 24));
    }
  });
  out.overflow = out.overflow.slice(0, 25);
  out.title = document.querySelector('.page-title')?.textContent;
  out.error = document.querySelector('.empty-state')?.textContent?.slice(0, 60) || null;
  return JSON.stringify(out);
})()`;
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(`=== ${width}x${height} #/${hash} ===`);
console.log(res.result.value);
if (consoleLogs.length) console.log('--- console ---\n' + consoleLogs.join('\n'));

ws.close();
proc.kill();
process.exit(0);
