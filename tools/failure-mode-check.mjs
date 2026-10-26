/**
 * 故障场景验收: 仅部署前端 (后端不可达) —— 报错必须「说真话」
 *
 * 覆盖两种典型故障:
 *   A) 同域 /api 落到前端静态页 (返回 HTML, 不是 JSON) → 应提示「后端未响应(返回的不是接口数据)」
 *   B) 配置的跨域后端不可达 (连接被拒)              → 应提示「无法连接后端服务」
 *
 * 用法: BASE_URL=http://127.0.0.1:4300 node tools/failure-mode-check.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FRONT = process.env.BASE_URL || 'http://127.0.0.1:4300';
const PORT = 9422;

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900',
  `--user-data-dir=C:/Users/Admin/AppData/Local/Temp/bs-fail-${PORT}`,
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
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval error');
  return res.result.value;
};

await send('Runtime.enable');
await send('Page.enable');

let ok = true;
const assert = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) ok = false; };

async function checkRoute(hash, label) {
  await send('Page.navigate', { url: `${FRONT}/#/${hash}` });
  await sleep(3000);
  return evaluate(`(() => {
    const t = document.querySelector('.api-error-title')?.textContent?.trim() || null;
    const hint = document.querySelector('.api-error .desc')?.textContent?.trim() || null;
    const meta = document.querySelector('.api-error-meta')?.textContent?.trim() || null;
    const acts = [...document.querySelectorAll('.api-error-actions button, .api-error-actions a')].map((b) => b.textContent.trim());
    const crash = document.body.innerText.includes('页面加载出错');
    const mode = document.querySelector('.mode-chip')?.textContent?.trim();
    return JSON.stringify({ t, hint, meta, acts, crash, mode });
  })()`);
}

// ---- A) 同域 /api 落到静态页 (无后端) ----
console.log('--- 场景 A: 仅前端部署, 同域 /api 无后端 ---');
await send('Page.navigate', { url: `${FRONT}/#/settings` });
await sleep(2000);
await evaluate(`localStorage.removeItem('bs-api-base'); 'ok'`);

for (const [hash, label] of [['templates', '模板库'], ['create?tpl=main-white', '创作页'], ['', '首页']]) {
  const r = JSON.parse(await checkRoute(hash, label));
  assert(!r.crash, `${label}: 未出现「页面加载出错」`);
  assert(!!r.t, `${label}: 显示错误原因 → ${r.t}`);
  assert(!/模板不存在/.test(r.t ?? ''), `${label}: 未误报「模板不存在」`);
  assert(r.acts.includes('重试'), `${label}: 提供「重试」按钮`);
  if (hash === 'templates') {
    assert(/后端未响应/.test(r.t ?? ''), `${label}: 提示准确 → ${r.t}`);
    assert(/接口地址/.test(r.meta ?? ''), `${label}: 显示实际接口地址 → ${r.meta}`);
  }
}

const mode = JSON.parse(await checkRoute('templates', '模板库')).mode;
assert(/后端未连接/.test(mode ?? ''), `侧栏状态 → ${mode}`);

// ---- B) 配置的跨域后端不可达 ----
console.log('\n--- 场景 B: 配置的后端地址不可达 ---');
await send('Page.navigate', { url: `${FRONT}/#/settings` });
await sleep(2000);
await evaluate(`localStorage.setItem('bs-api-base', 'http://127.0.0.1:59999'); 'ok'`);
const r2 = JSON.parse(await checkRoute('templates', '模板库'));
assert(!r2.crash, '未出现「页面加载出错」');
assert(/无法连接后端服务/.test(r2.t ?? ''), `提示准确 → ${r2.t}`);
assert(/CORS/.test(r2.hint ?? ''), '提示包含 CORS 排查指引');

// 恢复同域
await send('Page.navigate', { url: `${FRONT}/#/settings` });
await sleep(2000);
await evaluate(`localStorage.removeItem('bs-api-base'); 'ok'`);

ws.close();
proc.kill();
console.log(ok ? '\n故障场景全部通过 ✅' : '\n存在失败 ❌');
process.exit(ok ? 0 : 1);
