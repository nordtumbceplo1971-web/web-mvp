/**
 * 批量套图 · API 路由 (挂载于 /api/batch)
 *
 * 自包含模块: 数据/队列/导出都在 modules/batch/, 不与 works.json、模板库等板块交互。
 * 创建项目 → 试跑 1 行 → 全量 → 矩阵盯进度/单格重跑/锁定 → 导出 ZIP (按 SKU 分文件夹 + manifest.csv)
 */
import { Router } from 'express';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { createProject, getProject, listProjects, deleteProject, summarize, rowComplete } from './modules/batch/store.js';
import { RECIPE, PER_CELL_CREDITS, sanitizeName } from './modules/batch/recipe.js';
import { enqueuePilot, enqueueFull, rerunCell, rerunRow, setCellLock, recoverOnBoot } from './modules/batch/runner.js';

export const batchApi = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 断点续跑: 服务重启后自动接续上次未完成的批次
recoverOnBoot();

/** 前端矩阵需要的视图数据: 项目 + 行 + 格 (含状态/产出/质检/锁定) */
function projectView(p) {
  const rowsDone = (p.rows ?? []).filter((r) => rowComplete(p, r.id)).length;
  const cells = Object.values(p.cells ?? {});
  return {
    ...summarize(p),
    recipe: { id: RECIPE.id, name: RECIPE.name, steps: RECIPE.steps },
    perCellCredits: PER_CELL_CREDITS,
    rowsDone,
    rowsTotal: (p.rows ?? []).length,
    detail: {
      rows: p.rows,
      cells: p.cells,
      budget: p.budget,
    },
  };
}

batchApi.post('/', wrap(async (req, res) => {
  const { name, rows } = req.body ?? {};
  const cleanRows = (Array.isArray(rows) ? rows : []).filter((r) => r && (r.sku || r.productName));
  if (!cleanRows.length) {
    return res.status(400).json({ error: { code: 'no_rows', message: '至少需要一行 SKU 作业单' } });
  }
  const project = createProject({ name, rows: cleanRows });
  res.json(projectView(project));
}));

batchApi.get('/', (req, res) => {
  res.json({ items: listProjects() });
});

batchApi.get('/:id', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  res.json(projectView(p));
});

batchApi.delete('/:id', (req, res) => {
  const ok = deleteProject(req.params.id);
  if (!ok) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  res.json({ ok: true });
});

/** 试跑: 只跑一行 (Stage 1 默认第一行, 前端可指定) */
batchApi.post('/:id/pilot', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  const rowId = req.body?.rowId || p.rows[0]?.id;
  if (!rowId) return res.status(400).json({ error: { code: 'no_rows', message: '项目里没有作业行' } });
  const out = enqueuePilot(p, rowId);
  res.json({ ...out, project: projectView(getProject(p.id)) });
}));

/** 全量 (幂等: 已成功/锁定的格自动复用) */
batchApi.post('/:id/run', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  const out = enqueueFull(p);
  res.json({ ...out, project: projectView(getProject(p.id)) });
}));

/** 单格重跑 (尊重锁定) */
batchApi.post('/:id/cells/rerun', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  const { rowId, stepId } = req.body ?? {};
  const out = rerunCell(p, rowId, stepId);
  if (out.error) return res.status(400).json({ error: { code: 'rerun_blocked', message: out.error } });
  res.json({ ...out, project: projectView(getProject(p.id)) });
}));

/** 整行重跑 (强制, 锁定格除外) */
batchApi.post('/:id/rows/:rowId/rerun', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  const out = rerunRow(p, req.params.rowId);
  res.json({ ...out, project: projectView(getProject(p.id)) });
}));

/** 锁定 / 解锁 (锁定后任何重跑不覆盖) */
batchApi.post('/:id/cells/lock', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });
  const { rowId, stepId, locked } = req.body ?? {};
  const out = setCellLock(p, rowId, stepId, locked);
  if (out.error) return res.status(400).json({ error: { code: 'lock_blocked', message: out.error } });
  res.json({ ...out, project: projectView(getProject(p.id)) });
}));

/** 导出 ZIP: 按 SKU 分文件夹 + manifest.csv + 合规说明 */
batchApi.get('/:id/export-zip', wrap(async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: { code: 'not_found', message: '批量项目不存在' } });

  const manifestLines = ['sku,step,step_name,file,width,height,qa_checked,template_version'];
  const entries = []; // { folder, file, url }
  for (const row of p.rows) {
    const folder = `${sanitizeName(row.sku)}_${sanitizeName(row.productName || '')}`;
    for (let n = 1; n <= 7; n += 1) {
      const stepId = String(n).padStart(2, '0');
      const c = p.cells[`${row.id}|${stepId}`];
      if (!c?.url || c.url.startsWith('/mock-assets/') || c.url.startsWith('mock://')) continue;
      const stepDef = RECIPE.steps.find((s) => s.id === stepId);
      const file = c.fileName || `${sanitizeName(row.sku)}_${stepId}_${stepDef.view}.jpg`;
      entries.push({ folder, file, url: c.url, row, stepId, c, stepDef });
      manifestLines.push([
        row.sku, stepId, stepDef.name, file, c.width || '', c.height || '',
        c.qa?.checked ? 'yes' : 'no', 'shopify-7 v1',
      ].map(csvEscape).join(','));
    }
  }
  if (!entries.length) {
    return res.status(400).json({ error: { code: 'empty', message: '还没有可导出的成图 (MOCK 模式下的占位图不参与导出)' } });
  }
  manifestLines.push('');
  manifestLines.push('_readme: 白底主图须为纯白背景、产品占比≥85%、无文字水印; 场景图 (细节/ lifestyle) 可豁免。');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeName(p.name)}-${p.id}.zip"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (e) => {
    console.error('[batch export-zip]', e);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);
  archive.append(manifestLines.join('\n'), { name: '_manifest.csv' });
  archive.append(
    '996 Studio 批量套图交付包\n'
    + `项目: ${p.name} (${p.id})\n配方: Shopify 7 步套图\n导出时间: ${new Date().toISOString()}\n`
    + `格数: ${entries.length} · 质检通过: ${entries.filter((e) => !e.c.qa?.fail).length}\n`,
    { name: '_readme.txt' },
  );

  // 逐格拉取远端图入包; 单张失败跳过并记录, 不拖垮整包
  await Promise.all(entries.map(async (e) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const r = await fetch(e.url, { signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      archive.append(buf, { name: `${e.folder}/${e.file}` });
    } catch (err) {
      console.warn(`[batch export-zip] 跳过 ${e.url.slice(0, 60)}: ${err.message}`);
      archive.append(`导出失败: ${e.url}\n原因: ${err.message}\n`, { name: `${e.folder}/_FAILED_${e.file}.txt` });
    }
  }));
  await archive.finalize();
}));

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
