import { Router } from 'express';
import multer from 'multer';
import { config, isMockMode } from './config.js';
import { templates, categories, getTemplate, composePrompt } from './modules/templates/templates.js';
import { generateImage, generateVideo } from './modules/generation/service.js';
import { isMockTaskId, getMockTask, parseMockTaskId } from './modules/generation/taskSimulator.js';
import { getTask, uploadFile, UpstreamError } from './upstream/client.js';
import { optimizePrompt, OPTIMIZER_SYSTEM_PROMPT } from './modules/prompt/optimizer.js';
import { listWorks, deleteWork, completeWorkByTask, findWorkByTask, updateWork, storageMode } from './modules/works/store.js';
import { systemModels } from './modules/models/systemModels.js';
import { listModels, getModel, createModel, updateModel, deleteModel, saveModelImage, getModelImagePath, modelsStorageMode } from './modules/models/store.js';
import { composeShopifyPrompt, composeShopifyRetouchPrompt, SHOPIFY_STEPS, SHOPIFY_TEMPLATE_ID } from './modules/templates/shopify.js';
import { APP_VERSION } from './version.js';

export const api = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 对外可访问的基础地址 (反向代理/Serverless 下需取 x-forwarded-*)
 * 例: Vercel 前面有网关 → req.protocol 可能是 http, 需用 x-forwarded-proto=https
 */
function publicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() || req.protocol;
  const host = req.headers['x-forwarded-host']?.split(',')[0]?.trim() || req.get('host');
  return `${proto}://${host}`;
}

// ---------- 系统 ----------
api.get('/', (req, res) => {
  res.json({ name: '996 Studio API', version: APP_VERSION, docs: '/api/health' });
});
api.get('/index', (req, res) => {
  res.json({ name: '996 Studio API', version: APP_VERSION, docs: '/api/health' });
});
api.get('/health', (req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    mode: isMockMode() ? 'mock' : 'live',
    models: config.models,
    upstream: config.upstream.baseUrl,
    storage: storageMode(),
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
  });
});

// ---------- 模板库 ----------
api.get('/templates', (req, res) => {
  const { category, type } = req.query;
  let items = templates;
  if (category && category !== 'all') items = items.filter((t) => t.category === category);
  if (type) items = items.filter((t) => t.type === type);
  res.json({ categories, items });
});

api.get('/templates/:id', (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.status(404).json({ error: { code: 'not_found', message: '模板不存在' } });
  res.json(t);
});

api.post('/templates/:id/preview-prompt', (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.status(404).json({ error: { code: 'not_found', message: '模板不存在' } });
  res.json({ prompt: composePrompt(t, req.body?.slotValues ?? {}) });
});

// ---------- 上传 ----------
api.post('/uploads', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: 'no_file', message: '缺少 file 字段' } });
  // 本地预览 URL (data URI 由前端自行生成, 这里只负责上游 URL)
  if (isMockMode()) {
    return res.json({
      url: `mock://${req.file.originalname}`,
      previewUrl: null,
      filename: req.file.originalname,
      bytes: req.file.size,
      mock: true,
    });
  }
  const data = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  if (!data?.url) {
    throw new UpstreamError('上传成功但未返回 url, 请重试', { status: 502, code: 'upload_no_url' });
  }
  res.json({ url: data.url, filename: data.filename ?? req.file.originalname, bytes: data.bytes, mock: false });
}));

// ---------- 生成 ----------
api.post('/generate/image', wrap(async (req, res) => {
  const out = await generateImage(req.body ?? {});
  res.json(out);
}));

api.post('/generate/video', wrap(async (req, res) => {
  const out = await generateVideo(req.body ?? {});
  res.json(out);
}));

// ---------- 任务 ----------
api.get('/tasks/:taskId', wrap(async (req, res) => {
  const { taskId } = req.params;

  if (isMockTaskId(taskId)) {
    const work = findWorkByTask(taskId);
    // 【Serverless】任务元信息从 taskId 自描述解析, 不依赖内存/磁盘, 跨实例也能正确推进
    const parsed = parseMockTaskId(taskId);
    const meta = {
      created_at: parsed?.createdAt ?? work?.createdAt ?? Date.now(),
      type: work?.type ?? parsed?.type ?? 'image',
      count: work?.count ?? parsed?.count ?? 1,
      title: work?.title,
    };
    const task = getMockTask({ ...meta, task_id: taskId }, publicBaseUrl(req));
    if (task.is_final && work && work.status === 'processing') {
      completeWorkByTask(taskId, { urls: task.data.map((d) => d.url), status: 'completed' });
    }
    return res.json(task);
  }

  const task = await getTask(taskId);
  const work = findWorkByTask(taskId);
  if (task?.is_final && work && work.status === 'processing') {
    const urls = Array.isArray(task.data) ? task.data.map((d) => d.url).filter(Boolean)
      : task.output_url ? [task.output_url] : [];
    completeWorkByTask(taskId, {
      urls,
      status: task.status === 'completed' ? 'completed' : 'failed',
      error: task.error?.message ?? null,
    });
  }
  res.json(task);
}));

// ---------- 提示词优化 (glm-5.3-flash, 视觉理解) ----------
api.post('/prompt/optimize', wrap(async (req, res) => {
  const { prompt, imageUrl } = req.body ?? {};
  if (!prompt && !imageUrl) {
    return res.status(400).json({ error: { code: 'empty_input', message: '提示词与图片至少提供一项' } });
  }
  const out = await optimizePrompt({ prompt, imageUrl });
  res.json(out);
}));

api.get('/prompt/system', (req, res) => {
  // 供前端展示「优化提示词」能力的说明 (透明化, 不含敏感信息)
  res.json({ model: config.models.text, systemPrompt: OPTIMIZER_SYSTEM_PROMPT, mock: isMockMode() });
});

// ---------- 我的作品 ----------
api.get('/works', (req, res) => {
  res.json(listWorks({ type: req.query.type }));
});

api.delete('/works/:id', (req, res) => {
  const ok = deleteWork(req.params.id);
  if (!ok) return res.status(404).json({ error: { code: 'not_found', message: '作品不存在' } });
  res.json({ deleted: true });
});

api.patch('/works/:id', (req, res) => {
  const allowed = {};
  if (typeof req.body?.title === 'string') allowed.title = req.body.title.slice(0, 60);
  if (typeof req.body?.favorite === 'boolean') allowed.favorite = req.body.favorite;
  const updated = updateWork(req.params.id, allowed);
  if (!updated) return res.status(404).json({ error: { code: 'not_found', message: '作品不存在' } });
  res.json(updated);
});

// ---------- 模特库 (素材库 · 自定义模特) ----------
api.get('/models', (req, res) => {
  const userId = req.query.userId || null;
  const userModels = listModels(userId);
  res.json({
    system: systemModels,
    user: userModels,
    storage: modelsStorageMode(),
  });
});

api.get('/models/:id', (req, res) => {
  const sys = systemModels.find((m) => m.id === req.params.id);
  if (sys) return res.json(sys);
  const m = getModel(req.params.id);
  if (!m) return res.status(404).json({ error: { code: 'not_found', message: '模特不存在' } });
  res.json(m);
});

api.get('/models/:id/image/:filename', (req, res) => {
  const filePath = getModelImagePath(req.params.id, req.params.filename);
  if (!filePath) return res.status(404).json({ error: { code: 'not_found', message: '图片不存在' } });
  res.sendFile(filePath);
});

api.post('/models', upload.fields([
  { name: 'front', maxCount: 1 }, { name: 'side', maxCount: 1 }, { name: 'back', maxCount: 1 },
]), wrap(async (req, res) => {
  const userId = req.body.userId || null;
  const name = req.body.name || '未命名模特';
  const desc = req.body.desc || '';
  if (!req.files?.front) {
    return res.status(400).json({ error: { code: 'no_file', message: '缺少正面图 (front)' } });
  }
  const model = createModel({ userId, name, desc, views: {} });
  const views = {};
  for (const view of ['front', 'side', 'back']) {
    const file = req.files?.[view]?.[0];
    if (!file) continue;
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const url = saveModelImage(model.id, view, dataUri);
    if (url) views[view] = url;
  }
  if (!views.front) {
    deleteModel(model.id, userId);
    return res.status(500).json({ error: { code: 'save_failed', message: '图片保存失败' } });
  }
  model.views = { front: views.front, side: views.side ?? null, back: views.back ?? null };
  model.cover = views.front;
  updateModel(model.id, { cover: views.front });
  const updated = getModel(model.id);
  res.json(updated);
}));

api.patch('/models/:id', (req, res) => {
  const updated = updateModel(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: { code: 'not_found', message: '模特不存在' } });
  res.json(updated);
});

api.delete('/models/:id', (req, res) => {
  const userId = req.query.userId || null;
  const ok = deleteModel(req.params.id, userId);
  if (!ok) return res.status(404).json({ error: { code: 'not_found', message: '模特不存在或无权删除' } });
  res.json({ deleted: true });
});

// ---------- Shopify 套图 (7 步提示词) ----------
api.get('/shopify/steps', (req, res) => {
  res.json({ steps: SHOPIFY_STEPS, templateId: SHOPIFY_TEMPLATE_ID });
});

api.post('/shopify/prompt', (req, res) => {
  const { mode = 'a', step, ...opts } = req.body ?? {};
  if (!SHOPIFY_STEPS.find((s) => s.id === step)) {
    return res.status(400).json({ error: { code: 'bad_step', message: '步骤编号无效, 请传 01–07' } });
  }
  const prompt = composeShopifyPrompt(mode, step, opts);
  res.json({ prompt, step, mode });
});

api.post('/shopify/retouch', (req, res) => {
  const { step, issue } = req.body ?? {};
  if (!SHOPIFY_STEPS.find((s) => s.id === step)) {
    return res.status(400).json({ error: { code: 'bad_step', message: '步骤编号无效' } });
  }
  const prompt = composeShopifyRetouchPrompt(step, issue);
  res.json({ prompt, step });
});
