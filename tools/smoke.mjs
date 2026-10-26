/**
 * 端到端冒烟: 连接状态 + 模板加载 + MOCK 生成轮询
 * 用法: BASE_URL=http://127.0.0.1:4173 node tools/smoke.mjs
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const j = async (path, init) => {
  const res = await fetch(BASE + path, init);
  return res.json();
};

const log = (...a) => console.log(...a);
let ok = true;
const assert = (cond, msg) => { log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) ok = false; };

// 1) 健康检查
const health = await j('/api/health');
assert(health.ok === true, `健康检查通过 · 模式=${health.mode} · 运行时=${health.runtime} · 存储=${health.storage}`);

// 2) 模板库
const tpl = await j('/api/templates');
assert(tpl.items.length >= 17, `模板库返回 ${tpl.items.length} 个模板, ${tpl.categories.length} 个分类`);

// 3) 静态素材
const img = await fetch(BASE + '/mock-assets/image-1.svg');
assert(img.ok, `占位素材可访问 (HTTP ${img.status})`);

// 4) MOCK 生成全流程 (创建 → 轮询 → 完成)
const gen = await j('/api/generate/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ templateId: 'main-white', slotValues: { product: '白色运动鞋' }, count: 2 }),
});
assert(!!gen.taskId, `任务已创建: ${gen.taskId}`);

let task = null;
for (let i = 0; i < 8; i += 1) {
  await sleep(1500);
  task = await j(`/api/tasks/${gen.taskId}`);
  if (task.is_final) break;
}
assert(task?.is_final && task.status === 'completed', `任务完成 · 输出 ${task?.data?.length} 张 · ${task?.data?.[0]?.url}`);

// 5) 作品入库
const works = await j('/api/works');
assert(works.total > 0, `作品库共 ${works.total} 件`);

log(ok ? '\n端到端冒烟全部通过 ✅' : '\n存在失败 ❌');
process.exit(ok ? 0 : 1);
