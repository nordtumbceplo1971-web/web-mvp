/**
 * 跨域后端场景验收 (驱动真实 UI, 适用于 dev 与静态构建产物)
 *
 * 场景: 前端与后端不同源 —— 前端 4300/5173, 后端 8787
 * 验证 v0.1.6 引入「后端地址运行时可配」后, 生成流程每一步都真正打到配置的地址:
 * - 模板库 / 健康检查走配置的地址
 * - 【关键】任务轮询也走配置的地址 —— 旧实现写死 /api/tasks/...,
 *   前后端分开部署时永远轮询不到结果, 生成界面会一直转圈
 *
 * 用法: BASE_URL=http://127.0.0.1:4300 node tools/cross-origin-check.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FRONT = process.env.BASE_URL || 'http://127.0.0.1:5173';
const BACK = process.env.API_BASE || 'http://127.0.0.1:8787';
const PORT = 9411;
const UPLOAD_FIXTURE = path.resolve('frontend/public/brand/logo-icon.png');

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900',
  `--user-data-dir=C:/Users/Admin/AppData/Local/Temp/bs-xorigin-${PORT}`,
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
const consoleErrors = [];
const apiRequests = [];

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
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (msg.method === 'Network.requestWillBeSent') {
    const u = msg.params.request.url;
    if (u.includes('/api/')) apiRequests.push(u);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  id += 1;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval error');
  return res.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('DOM.enable');

let ok = true;
const assert = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) ok = false; };

// ---- 1) 写入配置的跨域后端地址 ----
await send('Page.navigate', { url: `${FRONT}/#/settings` });
await sleep(2500);
await evaluate(`localStorage.setItem('bs-api-base', ${JSON.stringify(BACK)}); 'ok'`);

// ---- 2) 模板库加载 (证明请求真的打到了跨域后端) ----
await send('Page.navigate', { url: `${FRONT}/#/templates` });
await sleep(3000);
const tplCount = await evaluate(`document.querySelectorAll('.tpl-card').length`);
assert(tplCount >= 17, `模板库渲染 ${tplCount} 张卡片 (跨域后端可达)`);

const modeText = await evaluate(`document.querySelector('.mode-chip')?.textContent?.trim()`);
assert(/演示模式|正式模式/.test(modeText ?? ''), `侧栏状态: ${modeText}`);

// ---- 3) 走真实 UI: 创作页 → 上传 → 生成 → 出图 ----
await send('Page.navigate', { url: `${FRONT}/#/create?tpl=main-white` });
await sleep(3000);

// 上传素材 (通过 CDP 给隐藏的 file input 塞文件)
const doc = await send('DOM.getDocument', { depth: -1 });
const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
if (!node.nodeId) throw new Error('未找到文件上传控件');
await send('DOM.setFileInputFiles', { files: [UPLOAD_FIXTURE], nodeId: node.nodeId });
await sleep(2500);

const thumbCount = await evaluate(`document.querySelectorAll('.upload-thumbs .thumb:not(.add-more)').length`);
assert(thumbCount >= 1, `素材已上传 (缩略图 ${thumbCount} 张)`);

// 填产品名 + 点生成
await evaluate(`(() => {
  const input = document.querySelector('.slot-group .text-input');
  if (input) { input.value = '白色运动鞋'; input.dispatchEvent(new Event('input', { bubbles: true })); }
  return true;
})()`);
await sleep(400);
const genDisabled = await evaluate(`document.querySelector('[data-tour=generate-btn]')?.disabled`);
assert(genDisabled === false, '生成按钮已可用');

// 点生成, 等待出图 (MOCK 约 9 秒)
await evaluate(`document.querySelector('[data-tour=generate-btn]').click(); true`);
let resultSrc = null;
for (let i = 0; i < 40; i += 1) {
  await sleep(1000);
  resultSrc = await evaluate(`document.querySelector('.result-grid img')?.src || null`);
  if (resultSrc) break;
}
assert(!!resultSrc, `生成完成, 出图地址: ${resultSrc}`);
assert((resultSrc ?? '').startsWith(BACK), `结果图指向配置的跨域后端: ${resultSrc}`);

// ---- 4) 关键断言: 轮询请求必须打到配置的跨域后端 ----
const taskPolls = apiRequests.filter((u) => u.includes('/api/tasks/'));
assert(taskPolls.length > 0, `轮询请求 ${taskPolls.length} 次, 样例: ${taskPolls[0] ?? '-'}`);
assert(taskPolls.length > 0 && taskPolls.every((u) => u.startsWith(BACK)),
  '轮询请求全部发往配置的跨域后端 (未回落到同域 /api)');

const sameOriginPolls = apiRequests.filter((u) => u.includes('/api/tasks/') && !u.startsWith(BACK));
assert(sameOriginPolls.length === 0, `同域回落请求数: ${sameOriginPolls.length} (应为 0)`);

console.log(`\n共记录 ${apiRequests.length} 条 /api 请求`);
if (consoleErrors.length) {
  console.log(`控制台报错 ${consoleErrors.length} 条:`);
  console.log(consoleErrors.slice(0, 5).join('\n'));
} else {
  console.log('控制台报错 0 条');
}

ws.close();
proc.kill();
console.log(ok ? '\n跨域后端场景全部通过 ✅' : '\n存在失败 ❌');
process.exit(ok ? 0 : 1);
