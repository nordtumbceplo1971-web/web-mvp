import { config, isMockMode } from '../config.js';

/**
 * 上游 API 客户端（优创AIGC 开放 API, 见《上游API文档.md》）
 * - 鉴权: Authorization: Bearer sk-xxx
 * - 判成败: 图片同步端点 5 秒后进入保活, 状态码恒为 200 —— 一律以 body.error 判定
 */
export class UpstreamError extends Error {
  constructor(message, { status = 502, code = 'upstream_error', detail } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', body, formData, timeoutMs = 120_000 } = {}) {
  if (isMockMode()) {
    throw new UpstreamError('MOCK 模式下不应请求上游', { status: 500, code: 'mock_mode' });
  }
  const url = `${config.upstream.baseUrl}${path}`;
  const headers = { Authorization: `Bearer ${config.upstream.apiKey}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new UpstreamError(`上游请求超时: ${path}`, { status: 504, code: 'upstream_timeout' });
    }
    throw new UpstreamError(`上游网络错误: ${err.message}`, { status: 502, code: 'upstream_network' });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* 保留 text 形态 */
  }

  // 统一按文档规则判成败: body 里带 error 即失败（保活后状态码恒为 200）
  const errBody = data?.error;
  if (errBody) {
    throw new UpstreamError(errBody.message || '上游返回错误', {
      status: res.status >= 400 ? res.status : 502,
      code: errBody.code || 'upstream_error',
      detail: errBody,
    });
  }
  if (!res.ok) {
    throw new UpstreamError(`上游 HTTP ${res.status}`, {
      status: res.status,
      code: 'upstream_http_error',
      detail: typeof data === 'string' ? text.slice(0, 500) : data,
    });
  }
  return data;
}

/** 对话补全（GT 兼容）— glm-5.3-flash 等, 视觉输入走 content 数组的 image_url */
export function chatCompletions(payload, timeoutMs = 90_000) {
  return request('/v1/chat/completions', { method: 'POST', body: payload, timeoutMs });
}

/** 统一调用入口（图片真异步, 立即返回 task_id） */
export function modelRuntimeInvoke(payload) {
  return request('/api/v1/model-runtime/invoke', { method: 'POST', body: payload });
}

/** 媒体生成任务统一入口（视频异步） */
export function mediaGenerate(payload) {
  return request('/v1/media/generate', { method: 'POST', body: payload });
}

/** 任务状态查询 */
export function getTask(taskId) {
  return request(`/v1/tasks/${encodeURIComponent(taskId)}`);
}

/** 上传本地文件换取公网 URL */
export function uploadFile(fileBuffer, filename, contentType) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType || 'application/octet-stream' });
  formData.append('file', blob, filename);
  return request('/v1/files', { method: 'POST', formData, timeoutMs: 120_000 });
}
