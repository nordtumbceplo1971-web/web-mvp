import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 模特库 — 用户自定义模特存储
 * - 系统模特 (11 位) 在 systemModels.js 里定义, 全局共享
 * - 用户模特按 userId 隔离: 上传或生成, 仅本人可见
 * - 图片存 data/models/{modelId}/, 元数据存 data/models.json
 * - Serverless 降级: /tmp → 内存 (与 works/store.js 同策略)
 */
function resolveDataDir() {
  const candidates = [
    process.env.WORKS_DATA_DIR,
    path.join(__dirname, '..', '..', '..', 'data'),
    path.join('/tmp', '996-studio-data'),
    path.join('/tmp', 'brandstudio-data'),
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch { /* next */ }
  }
  return null;
}

const DATA_DIR = resolveDataDir();
const MODELS_FILE = DATA_DIR ? path.join(DATA_DIR, 'models.json') : null;
const IMAGES_DIR = DATA_DIR ? path.join(DATA_DIR, 'models') : null;
let memoryModels = [];

function readAll() {
  if (!MODELS_FILE) return memoryModels;
  try {
    const parsed = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(models) {
  if (!MODELS_FILE) { memoryModels = models; return; }
  try {
    fs.writeFileSync(MODELS_FILE, JSON.stringify(models, null, 2), 'utf8');
  } catch (err) {
    console.warn('[models] 磁盘写入失败, 降级为内存:', err.message);
    memoryModels = models;
  }
}

/** 列出指定用户的模特 (系统模特 + 本人模特) */
export function listModels(userId = null) {
  const userModels = readAll().filter((m) => !userId || m.userId === userId);
  return userModels.sort((a, b) => b.createdAt - a.createdAt);
}

export function getModel(id) {
  return readAll().find((m) => m.id === id) ?? null;
}

/**
 * 创建用户模特
 * @param {{userId:string, name:string, desc?:string, views:{front:string, side?:string|null, back?:string|null}}} input
 */
export function createModel(input) {
  const model = {
    id: `um-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name?.slice(0, 40) || '未命名模特',
    scope: 'user',
    userId: input.userId ?? null,
    cover: input.views?.front ?? null,
    views: {
      front: input.views?.front ?? null,
      side: input.views?.side ?? null,
      back: input.views?.back ?? null,
    },
    desc: input.desc?.slice(0, 200) ?? '',
    tags: input.tags ?? [],
    createdAt: Date.now(),
  };
  const models = readAll();
  models.push(model);
  writeAll(models);
  return model;
}

export function updateModel(id, patch) {
  const models = readAll();
  const idx = models.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  if (patch.name !== undefined) models[idx].name = String(patch.name).slice(0, 40);
  if (patch.desc !== undefined) models[idx].desc = String(patch.desc).slice(0, 200);
  if (patch.cover !== undefined) models[idx].cover = patch.cover;
  writeAll(models);
  return models[idx];
}

export function deleteModel(id, userId = null) {
  const models = readAll();
  const idx = models.findIndex((m) => m.id === id && (!userId || m.userId === userId));
  if (idx === -1) return false;
  // 清理图片文件
  const model = models[idx];
  if (IMAGES_DIR && model.id.startsWith('um-')) {
    const dir = path.join(IMAGES_DIR, model.id);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  models.splice(idx, 1);
  writeAll(models);
  return true;
}

/** 保存 base64 图片到 data/models/{modelId}/，返回访问 URL */
export function saveModelImage(modelId, view, base64Data) {
  if (!IMAGES_DIR) return null;
  const dir = path.join(IMAGES_DIR, modelId);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const ext = base64Data.includes('image/png') ? 'png' : 'jpg';
    const filename = `${view}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), buf);
    return `/api/models/${modelId}/image/${filename}`;
  } catch (err) {
    console.warn('[models] 图片保存失败:', err.message);
    return null;
  }
}

/** 读取模特图片文件路径 */
export function getModelImagePath(modelId, filename) {
  if (!IMAGES_DIR) return null;
  const safe = path.basename(filename);
  const p = path.join(IMAGES_DIR, modelId, safe);
  return fs.existsSync(p) ? p : null;
}

export const modelsStorageMode = () => (DATA_DIR ?? 'memory');
