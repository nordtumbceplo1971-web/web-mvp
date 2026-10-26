import { config, isMockMode } from '../../config.js';
import { modelRuntimeInvoke, mediaGenerate } from '../../upstream/client.js';
import { createMockTask } from './taskSimulator.js';
import { createWork } from '../works/store.js';
import { getTemplate, composePrompt } from '../templates/templates.js';

function imageModelRef(template, requested) {
  // 'primary' → gpt-image-2.5-flare · 'secondary' → gpt-image-2.5-sunburst
  const ref = requested ?? template.defaults.model ?? 'primary';
  return ref === 'secondary' ? config.models.imageSecondary : config.models.imagePrimary;
}

const ASPECT_WHITELIST = new Set(['1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '21:9', '9:21']);
const RESOLUTION_WHITELIST = new Set(['1K', '2K', '4K']);
const QUALITY_WHITELIST = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

/** 生成图片 (走统一调用入口 /api/v1/model-runtime/invoke, 真异步返回 task_id) */
export async function generateImage({
  templateId,
  slotValues = {},
  extraIdea = '',
  prompt: promptOverride = null,
  aspectRatio,
  resolution,
  quality,
  count,
  imageUrls = [],
  title,
}) {
  const template = getTemplate(templateId);
  if (!template || template.type !== 'image') {
    const err = new Error('模板不存在或类型不是图片'); err.status = 404; throw err;
  }
  const prompt = promptOverride || [composePrompt(template, slotValues), extraIdea?.trim()].filter(Boolean).join(' ');

  const params = {
    prompt,
    aspect_ratio: ASPECT_WHITELIST.has(aspectRatio) ? aspectRatio : template.defaults.aspect_ratio,
    resolution: RESOLUTION_WHITELIST.has(resolution) ? resolution : template.defaults.resolution,
    quality: QUALITY_WHITELIST.has(quality) ? quality : template.defaults.quality,
    count: Math.min(Math.max(Number(count) || template.defaults.count, 1), 4),
    mode: imageUrls.length > 1 ? 'multi-reference' : (imageUrls.length === 1 ? 'image-edit' : 'text-to-image'),
  };
  if (template.defaults.background) params.background = template.defaults.background;
  if (template.defaults.output_format) params.output_format = template.defaults.output_format;

  const model = imageModelRef(template);

  if (isMockMode()) {
    const task = createMockTask({ type: 'image', title, count: params.count });
    const work = createWork({
      taskId: task.task_id, type: 'image', templateId, title: title || template.title,
      prompt, count: params.count, slotValues, extraIdea, status: 'processing', isMock: true,
    });
    return { taskId: task.task_id, workId: work.id, prompt, params, model, mock: true };
  }

  // attachments: 参考图公网 URL 数组 (字符串数组)
  // 注意: params.images 是 upload 类型(文件上传), 不能传 URL 数组
  //       参考图统一走 attachments 字段
  const payload = {
    model_id: model,
    modality: 'image',
    operation: imageUrls.length ? 'edit' : 'generate',
    params,
  };
  if (imageUrls.length) {
    payload.attachments = imageUrls;
  }
  const res = await modelRuntimeInvoke(payload);
  const work = createWork({
    taskId: res.task_id, type: 'image', templateId, title: title || template.title,
    prompt, count: params.count, slotValues, extraIdea, status: 'processing',
  });
  return { taskId: res.task_id, workId: work.id, prompt, params, model, mock: false };
}

/** 生成视频 (走 /v1/media/generate, model=veo-4-omni) */
export async function generateVideo({
  templateId,
  slotValues = {},
  extraIdea = '',
  aspectRatio,
  resolution,
  duration,
  imageUrls = [],
  title,
}) {
  const template = getTemplate(templateId);
  if (!template || template.type !== 'video') {
    const err = new Error('模板不存在或类型不是视频'); err.status = 404; throw err;
  }
  const prompt = [composePrompt(template, slotValues), extraIdea?.trim()].filter(Boolean).join(' ');

  const params = {
    aspect_ratio: ['16:9', '9:16'].includes(aspectRatio) ? aspectRatio : template.defaults.aspect_ratio,
    resolution: ['720p', '1080p'].includes(resolution) ? resolution : template.defaults.resolution,
    duration: String(template.durationOptions?.includes(Number(duration)) ? Number(duration) : template.defaults.duration),
    mode: imageUrls.length ? 'first-frame' : 'text-to-video',
  };
  if (imageUrls.length) params.images = imageUrls.slice(0, 7);

  if (isMockMode()) {
    const task = createMockTask({ type: 'video', title });
    const work = createWork({
      taskId: task.task_id, type: 'video', templateId, title: title || template.title,
      prompt, slotValues, extraIdea, status: 'processing', isMock: true,
    });
    return { taskId: task.task_id, workId: work.id, prompt, params, model: config.models.video, mock: true };
  }

  const res = await mediaGenerate({ model: config.models.video, prompt, params });
  const work = createWork({
    taskId: res?.data?.task_id ?? res?.task_id, type: 'video', templateId,
    title: title || template.title, prompt, slotValues, extraIdea, status: 'processing',
  });
  return {
    taskId: work.taskId, workId: work.id, prompt, params,
    model: config.models.video, mock: false,
  };
}
