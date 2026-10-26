/**
 * 干净截图: 自动跳过新手引导遮罩后按视口截图
 * 用法: node tools/shot.mjs <输出png> [hash] [宽] [高] [BASE_URL]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out = process.argv[2] || 'shot.png';
const hash = process.argv[3] || '';
const width = Number(process.argv[4] || 1440);
const height = Number(process.argv[5] || 900);
const BASE = process.argv[6] || 'http://127.0.0.1:4173';
const PORT = 9350 + (out.length % 17);

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=C:/Users/Admin/AppData/Local/Temp/bs-shot-${PORT}`,
  'about:blank',
], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40; i += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
    if (target) break;
  } catch { /* retry */ }
  await sleep(250);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  id += 1;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
await send('Page.navigate', { url: `${BASE}/#/${hash}` });
await sleep(1500);
// 跳过新手引导遮罩后重载
await send('Runtime.evaluate', { expression: "localStorage.setItem('bs-tour-done-v1','1')" });
await send('Page.reload', {});
await sleep(2500);

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`已保存 ${out} (${width}x${height})`);

ws.close();
proc.kill();
process.exit(0);
