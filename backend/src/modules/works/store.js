import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const WORKS_FILE = path.join(DATA_DIR, 'works.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(WORKS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(works) {
  ensureDataDir();
  fs.writeFileSync(WORKS_FILE, JSON.stringify(works, null, 2), 'utf8');
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
