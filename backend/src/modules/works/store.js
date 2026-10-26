import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 作品存储 (三级降级, 兼容 Serverless 只读文件系统)
 * 1) WORKS_DATA_DIR 环境变量指定的目录
 * 2) 本地开发: backend/data (可写磁盘, 数据持久)
 * 3) Serverless: /tmp/brandstudio-data (实例内持久, 冷启动会丢)
 * 4) 全部不可写 → 纯内存 (仍可完整演示, 但数据不跨实例/冷启动保留)
 */
function resolveDataDir() {
  const candidates = [
    process.env.WORKS_DATA_DIR,
    path.join(__dirname, '..', '..', '..', 'data'),
    path.join('/tmp', 'brandstudio-data'),
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch { /* 试下一个候选 */ }
  }
  return null;
}

const DATA_DIR = resolveDataDir();
const WORKS_FILE = DATA_DIR ? path.join(DATA_DIR, 'works.json') : null;
let memoryOnly = !DATA_DIR;
let memoryWorks = [];

/** 当前存储模式 (供 /api/health 展示, 便于排查部署问题) */
export const storageMode = () => (memoryOnly ? 'memory' : (DATA_DIR ?? 'memory'));

function readAll() {
  if (memoryOnly) return memoryWorks;
  try {
    const parsed = JSON.parse(fs.readFileSync(WORKS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(works) {
  if (memoryOnly) { memoryWorks = works; return; }
  try {
    fs.writeFileSync(WORKS_FILE, JSON.stringify(works, null, 2), 'utf8');
  } catch (err) {
    console.warn('[works] 磁盘写入失败, 降级为内存存储:', err.message);
    memoryOnly = true;
    memoryWorks = works;
  }
}

export function listWorks({ type, page = 1, pageSize = 60 } = {}) {
  const all = readAll()
    .sort((a, b) => b.createdAt - a.createdAt);
  const filtered = type ? all.filter((w) => w.type === type) : all;
  const start = (page - 1) * pageSize;
  return { total: filtered.length, items: filtered.slice(start, start + pageSize) };
}

export function createWork(input) {
  const work = {
    id: `work-${crypto.randomUUID().slice(0, 8)}`,
    taskId: input.taskId ?? null,
    type: input.type, // image | video
    templateId: input.templateId ?? null,
    title: input.title ?? '未命名作品',
    prompt: input.prompt ?? '',
    count: input.count ?? null,
    slotValues: input.slotValues ?? null,
    extraIdea: input.extraIdea ?? '',
    status: input.status ?? 'processing',
    urls: [],
    coverUrl: null,
    error: null,
    isMock: input.isMock ?? false,
    createdAt: Date.now(),
    completedAt: null,
  };
  const works = readAll();
  works.push(work);
  writeAll(works);
  return work;
}

export function findWorkByTask(taskId) {
  return readAll().find((w) => w.taskId === taskId) ?? null;
}

export function updateWork(id, patch) {
  const works = readAll();
  const idx = works.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  works[idx] = { ...works[idx], ...patch };
  writeAll(works);
  return works[idx];
}

export function deleteWork(id) {
  const works = readAll();
  const idx = works.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  works.splice(idx, 1);
  writeAll(works);
  return true;
}

/** 任务完成时回写作品 (由任务查询路由触发) */
export function completeWorkByTask(taskId, { urls, status, error }) {
  const work = findWorkByTask(taskId);
  if (!work || work.status === 'completed' || work.status === 'failed') return work;
  const updated = updateWork(work.id, {
    status: status ?? (urls?.length ? 'completed' : 'failed'),
    urls: urls ?? [],
    coverUrl: urls?.[0] ?? null,
    error: error ?? null,
    completedAt: Date.now(),
  });
  return updated;
}
