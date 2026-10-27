/**
 * 模特库「+」卡片 E2E:
 *   1) POST /api/models/generate (真实图片模型) → 轮询任务 → 拿图
 *   2) POST /api/models  (frontUrl) → 入库「我的模特」
 *   3) GET  /api/models?userId=... → 校验隔离与 cover
 *   4) DELETE /api/models/:id → 清理
 */
const BASE = process.env.BASE ?? 'http://localhost:8787';
const USER = 'e2e-model-user';

const j = async (url, init) => {
  const r = await fetch(url, init);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(d)}`);
  return d;
};

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);

step(1, 'POST /api/models/generate — 真实生成模特形象');
const idea = '22岁欧美白人女性, 身高170, 苗条, 浅金色长直发, 淡妆, 时尚简约气质';
const gen = await j(`${BASE}/api/models/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idea, userId: USER, name: 'E2E 模特' }),
});
console.log('  taskId =', gen.taskId, '| mock =', gen.mock);
console.log('  prompt =', String(gen.prompt).split('\n')[0]);

step(2, '轮询任务直到出图');
let url = null;
const t0 = Date.now();
for (let i = 0; i < 90; i += 1) {
  await new Promise((r) => setTimeout(r, 4000));
  const t = await j(`${BASE}/api/tasks/${encodeURIComponent(gen.taskId)}`);
  if (i % 3 === 0) console.log(`  ... ${Math.round((Date.now() - t0) / 1000)}s status=${t.status}`);
  if (t.is_final) {
    if (t.status !== 'completed' || !t.data?.length) {
      throw new Error(`生成失败: ${JSON.stringify(t).slice(0, 500)}`);
    }
    url = t.data[0].url;
    console.log('  ✓ 出图:', url);
    break;
  }
}
if (!url) throw new Error('超时未出图');

step(3, 'POST /api/models (frontUrl) — 入库');
const model = await j(`${BASE}/api/models`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: USER, name: 'E2E 模特', desc: idea, frontUrl: url }),
});
console.log('  id =', model.id, '| cover =', model.cover);

step(4, 'GET /api/models?userId= — 校验入库');
const list = await j(`${BASE}/api/models?userId=${encodeURIComponent(USER)}`);
const mine = list.user ?? [];
const other = await j(`${BASE}/api/models?userId=someone-else`);
console.log(`  我的模特 = ${mine.length}, 系统模特 = ${list.system?.length}, 他人用户模特 = ${other.user?.length}`);
if (!mine.some((m) => m.id === model.id)) throw new Error('入库失败: 列表里找不到');
if ((other.user ?? []).length !== 0) throw new Error('用户隔离失败');
if (!/^https?:\/\//.test(model.cover)) throw new Error('cover 不是公网 URL');

step(5, 'DELETE 清理');
await j(`${BASE}/api/models/${model.id}?userId=${encodeURIComponent(USER)}`, { method: 'DELETE' });
const after = await j(`${BASE}/api/models?userId=${encodeURIComponent(USER)}`);
console.log(`  清理后我的模特 = ${after.user?.length ?? 0}`);

console.log('\n✅ 模特生成 E2E 全部通过');
