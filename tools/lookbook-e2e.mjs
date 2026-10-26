/**
 * Shopify 套图 · 完整 7 步真实 E2E 测试 (模拟前端完整流程)
 *
 * 按依赖分波执行:
 *   波1: [01, 04, 05, 06] 并行 (独立节点)
 *   波2: [02, 03] 并行 (依赖 01 的生成结果)
 *   波3: [07] (依赖 01/03 + 06 的生成结果)
 *
 * 用法: node tools/lookbook-e2e.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const POLL_INTERVAL = 5000;
const POLL_MAX = 40; // 200s/步

const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

async function jfetch(pathname, init) {
  const res = await fetch(BASE + pathname, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    throw new Error(`${pathname} → ${res.status} ${JSON.stringify(data?.error || data).slice(0, 200)}`);
  }
  return data;
}

async function uploadFile(filePath, name) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'image/jpeg' }), name);
  const res = await fetch(`${BASE}/api/uploads`, { method: 'POST', body: fd });
  const data = await res.json();
  if (data?.error || data?.mock) {
    throw new Error(`上传失败: ${JSON.stringify(data).slice(0, 150)} (live 模式才能跑本测试)`);
  }
  log(`  ✓ 上传 ${name} → ${data.url.slice(0, 60)}...`);
  return data.url;
}

async function pollTask(taskId, label) {
  for (let i = 0; i < POLL_MAX; i += 1) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const t = await jfetch(`/api/tasks/${encodeURIComponent(taskId)}`);
    if (t.is_final) {
      if (t.status === 'completed' && t.data?.length) {
        log(`  ✓ ${label} 完成 (${(i + 1) * POLL_INTERVAL / 1000}s) → ${t.data[0].url.slice(0, 70)}...`);
        return t.data[0].url;
      }
      throw new Error(`${label} 失败: ${JSON.stringify(t.error || t.status).slice(0, 150)}`);
    }
    process.stdout.write(`  … ${label} ${(i + 1) * POLL_INTERVAL / 1000}s\r`);
  }
  throw new Error(`${label} 轮询超时 (${POLL_MAX * POLL_INTERVAL / 1000}s)`);
}

/** 单步生成: 提示词 → 参考图 → 任务 → 轮询 */
async function runStep(stepId, stepName, mode, opts) {
  const { productDesc = 'T恤', inspiration = '', modelDesc = '', secondModelDesc = '', images = [] } = opts;
  const t0 = Date.now();
  log(`▶ ${stepId} ${stepName} 开始 (${images.length} 张参考图)`);
  const { prompt } = await jfetch('/api/shopify/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, step: stepId, productDesc, inspiration, modelDesc, secondModelDesc, productBackAvailable: true }),
  });
  const gen = await jfetch('/api/generate/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'shopify-lookbook', prompt,
      aspect_ratio: '4:5', resolution: '2K', quality: 'high', count: 1,
      imageUrls: images, title: `E2E ${stepId} ${stepName}`,
    }),
  });
  const url = await pollTask(gen.taskId, `${stepId} ${stepName}`);
  return { stepId, url, seconds: Math.round((Date.now() - t0) / 1000) };
}

// ================= 主流程 =================
const results = {};
try {
  const health = await jfetch('/api/health');
  log(`模式=${health.mode} 版本=${health.version}`);
  if (health.mode !== 'live') throw new Error('本测试需要 live 模式 (配置 UPSTREAM_API_KEY)');

  // ---- 准备素材 ----
  log('\n== 准备素材 ==');
  const assetDir = 'D:/ai-server-mvp/frontend/public/models/system';
  // 用两张模特三视图充当产品正/背面 (pipeline 测试, 图像内容不影响流程验证)
  const productFront = await uploadFile(path.join(assetDir, 'Male-(1).jpg'), 'product-front.jpg');
  const productBack = await uploadFile(path.join(assetDir, 'Male-(2).jpg'), 'product-back.jpg');
  // 模特库封面 → 公网 URL (前端 ensurePublicUrl 的等效逻辑)
  const tpl = await jfetch('/api/templates/shopify-lookbook');
  if (!tpl?.isLookbook) throw new Error('shopify-lookbook 模板缺失');
  const models = await jfetch('/api/models');
  const model1 = models.system[0];
  const model2 = models.system[1];
  const model1Url = await uploadFile(path.join('D:/ai-server-mvp/frontend/public', model1.cover), 'model1.jpg');
  const model2Url = await uploadFile(path.join('D:/ai-server-mvp/frontend/public', model2.cover), 'model2.jpg');
  log(`  主模特: ${model1.name} | 第二模特: ${model2.name}`);

  // ---- 波1: 独立节点 [01, 04, 05, 06] 并行 ----
  log('\n== 波1: [01, 04, 05, 06] 并行 (独立) ==');
  const wave1 = await Promise.allSettled([
    runStep('01', '列表主图', 'b', { modelDesc: model1.desc, images: [productFront, model1Url] }),
    runStep('04', '印花细节', 'b', { images: [productFront] }),
    runStep('05', '面料做工', 'b', { images: [productFront] }),
    runStep('06', '另一位模特', 'b', { secondModelDesc: model2.desc, images: [productFront, model2Url] }),
  ]);
  const [r01, r04, r05, r06] = wave1.map((w, i) => {
    if (w.status === 'fulfilled') return w.value;
    log(`  ✗ 波1节点${['01', '04', '05', '06'][i]} 失败: ${String(w.reason).slice(0, 120)}`);
    return null;
  });
  if (r01) results['01'] = r01;
  if (r04) results['04'] = r04;
  if (r05) results['05'] = r05;
  if (r06) results['06'] = r06;
  if (!r01) throw new Error('节点01 失败, 波2/波3 无法继续');

  // ---- 波2: [02, 03] 并行 (依赖 01 结果) ----
  log('\n== 波2: [02, 03] 并行 (依赖01) ==');
  const wave2 = await Promise.allSettled([
    runStep('02', '背面展示', 'b', { images: [productBack, r01.url] }),
    runStep('03', '完整穿搭', 'b', { images: [productFront, r01.url] }),
  ]);
  const [r02, r03] = wave2.map((w, i) => {
    if (w.status === 'fulfilled') return w.value;
    log(`  ✗ 波2节点${['02', '03'][i]} 失败: ${String(w.reason).slice(0, 120)}`);
    return null;
  });
  if (r02) results['02'] = r02;
  if (r03) results['03'] = r03;
  if (!r06) throw new Error('节点06 失败, 波3 无法继续 (07 需要第二模特效果图)');

  // ---- 波3: [07] (依赖 01/03 + 06) ----
  log('\n== 波3: [07] (依赖01/03 + 06) ==');
  const m1Ref = (r03 || r01).url; // 优先用 03 全身图
  const r07 = await runStep('07', '品牌生活方式', 'b', { images: [productFront, m1Ref, r06.url] });
  results['07'] = r07;

  // ---- 汇总 ----
  log('\n===== E2E 结果汇总 =====');
  const names = { '01': '列表主图', '02': '背面展示', '03': '完整穿搭', '04': '印花细节', '05': '面料做工', '06': '另一位模特', '07': '品牌生活方式' };
  let ok = 0;
  for (const id of ['01', '02', '03', '04', '05', '06', '07']) {
    const r = results[id];
    if (r) { ok += 1; log(`✓ ${id} ${names[id]} — ${r.seconds}s`); }
    else log(`✗ ${id} ${names[id]} — 失败`);
  }
  log(`\n${ok}/7 步成功`);
  fs.writeFileSync('D:/ai-server-mvp/.skill-tmp/e2e-results.json', JSON.stringify(results, null, 2));
  process.exit(ok === 7 ? 0 : 1);
} catch (e) {
  log(`\n✗ E2E 中止: ${e.message}`);
  log(`已完成: ${Object.keys(results).join(', ') || '无'}`);
  process.exit(1);
}
