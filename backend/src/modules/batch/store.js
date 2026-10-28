/**
 * 批量套图 · 项目存储 (自包含, 不与 works.json 交互)
 *
 * 数据落在 backend/data/batch/projects.json, 一个 Project 一条记录:
 *   Project { id, name, platform, recipeId, status, rows[], cells{}, budget, createdAt/UpdatedAt }
 *   JobRow  { id, sku, productName, productDesc, inspiration, images[], model*, modelPublicUrl* }
 *   Cell    { rowId, stepId, idempotencyKey, status, attempts, url, width/height, qa, fileName, locked, error, updatedAt }
 *
 * cells 以 `${rowId}|${stepId}` 为 key, 是矩阵视图与幂等去重的唯一事实来源。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'batch');
const FILE = path.join(DATA_DIR, 'projects.json');

let projects = [];
let loaded = false;

function load() {
  if (loaded) return;
  try {
    projects = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(projects)) projects = [];
  } catch {
    projects = [];
  }
  loaded = true;
}

export function saveProject(project) {
  load();
  project.updatedAt = Date.now();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) projects[idx] = project;
  else projects.unshift(project);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(projects, null, 2));
  return project;
}

export function createProject({ name, rows }) {
  load();
  const project = {
    id: `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name || '批量套图',
    platform: 'shopify',
    recipeId: 'shopify-7',
    status: 'draft', // draft | pilot | running | done
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rows: (rows ?? []).map((r, i) => ({
      id: r.id || `row-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
      sku: r.sku || `SKU-${i + 1}`,
      productName: r.productName || '',
      productDesc: r.productDesc || '',
      inspiration: r.inspiration || '',
      scene: r.scene || '',
      images: Array.isArray(r.images) ? r.images.filter(Boolean) : [],
      modelId: r.modelId || null,
      modelName: r.modelName || '',
      modelDesc: r.modelDesc || '',
      modelCover: r.modelCover || null,
      modelPublicUrl: r.modelPublicUrl || null,
      model2Id: r.model2Id || null,
      model2Name: r.model2Name || '',
      model2Cover: r.model2Cover || null,
      model2PublicUrl: r.model2PublicUrl || null,
    })),
    cells: {},
    budget: { perCellCredits: 2, spent: 0, failed: 0 },
  };
  for (const row of project.rows) {
    for (let n = 1; n <= 7; n += 1) {
      const stepId = String(n).padStart(2, '0');
      project.cells[`${row.id}|${stepId}`] = {
        rowId: row.id,
        stepId,
        idempotencyKey: null,
        status: 'pending', // pending|queued|running|success|failed|rejected_by_qa
        attempts: 0,
        url: null,
        width: 0,
        height: 0,
        qa: null,
        fileName: null,
        locked: false,
        error: null,
        updatedAt: Date.now(),
      };
    }
  }
  return saveProject(project);
}

export function getProject(id) {
  load();
  return projects.find((p) => p.id === id) ?? null;
}

export function listProjects() {
  load();
  return projects.map(summarize);
}

/** 全部原始项目 (含 cells) —— runner 断点续跑用 */
export function allProjects() {
  load();
  return projects;
}

/** 列表用轻量摘要 (不带 cells 明细) */
export function summarize(p) {
  const cells = Object.values(p.cells ?? {});
  const done = cells.filter((c) => c.url).length;
  return {
    id: p.id, name: p.name, platform: p.platform, recipeId: p.recipeId,
    status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
    rows: (p.rows ?? []).length, totalCells: cells.length,
    doneCells: done,
    failedCells: cells.filter((c) => c.status === 'failed' || c.status === 'rejected_by_qa').length,
  };
}

export function deleteProject(id) {
  load();
  const before = projects.length;
  projects = projects.filter((p) => p.id !== id);
  if (projects.length !== before) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(projects, null, 2));
  }
  return projects.length < before;
}

/** 统计一行是否完成 (所有格都有产出) */
export function rowComplete(project, rowId) {
  for (let n = 1; n <= 7; n += 1) {
    const c = project.cells[`${rowId}|${String(n).padStart(2, '0')}`];
    if (!c?.url) return false;
  }
  return true;
}
