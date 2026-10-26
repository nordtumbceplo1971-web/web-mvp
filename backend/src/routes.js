import { Router } from 'express';
import multer from 'multer';
import { config, isMockMode } from './config.js';
import { templates, categories, getTemplate, composePrompt } from './modules/templates/templates.js';
import { generateImage, generateVideo } from './modules/generation/service.js';
import { isMockTaskId, getMockTask, parseMockTaskId } from './modules/generation/taskSimulator.js';
import { getTask, uploadFile, UpstreamError } from './upstream/client.js';
import { optimizePrompt, OPTIMIZER_SYSTEM_PROMPT } from './modules/prompt/optimizer.js';
import { listWorks, deleteWork, completeWorkByTask, findWorkByTask, updateWork, storageMode } from './modules/works/store.js';

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
  res.json({ name: 'BrandStudio API', version: '0.1.2', docs: '/api/health' });
});
api.get('/index', (req, res) => {
  res.json({ name: 'BrandStudio API', version: '0.1.2', docs: '/api/health' });
});
api.get('/health', (req, res) => {
  res.json({
    ok: true,
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
