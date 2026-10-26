/**
 * 后端 API 客户端
 *
 * 后端地址(base)解析优先级:
 * 1) 设置页本地配置 (localStorage: bs-api-base) —— 运行时可改, 无需重新构建
 * 2) 部署期配置 (public/config.js: window.__APP_CONFIG__.apiBase)
 * 3) 空字符串 —— 与前端同域的 /api (Vercel 一体化部署 / 本地开发)
 */

const RUNTIME_CFG = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

const trimBase = (v) => String(v ?? '').trim().replace(/\/+$/, '');

/** 当前生效的后端地址 (空 = 同域) */
export function getApiBase() {
  try {
    const local = localStorage.getItem('bs-api-base');
    if (local !== null) return trimBase(local);
  } catch { /* 隐私模式下忽略 */ }
  return trimBase(RUNTIME_CFG.apiBase);
}

/** 设置后端地址 (留空 = 同域 /api) */
export function setApiBase(v) {
  try { localStorage.setItem('bs-api-base', trimBase(v)); } catch { /* ignore */ }
}

/** API 错误: 带原因分类, 便于界面给出准确提示 */
export class ApiError extends Error {
  constructor(message, { status = 0, reason = 'unknown', url = '', code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.reason = reason; // network | no-api | not-found | server | http
    this.url = url;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, formData } = {}) {
  const url = `${getApiBase()}/api${path}`;
  const opts = { method };
  if (formData) opts.body = formData;
  else if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new ApiError('无法连接后端服务', { status: 0, reason: 'network', url });
  }

  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON 响应(可能是前端 HTML / 404 页) */ }

  if (!res.ok || data?.error) {
    // 返回的不是 JSON → 多半是 /api 没落到后端(前端被单独部署时的典型症状)
    const reason = data === null ? 'no-api'
      : res.status === 404 ? 'not-found'
        : res.status >= 500 ? 'server' : 'http';
    const msg = data?.error?.message || `请求失败 (${res.status})`;
    throw new ApiError(msg, { status: res.status, reason, url, code: data?.error?.code ?? null });
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  listTemplates: ({ category, type } = {}) => {
    const q = new URLSearchParams();
    if (category && category !== 'all') q.set('category', category);
    if (type) q.set('type', type);
    const qs = q.toString();
    return request(`/templates${qs ? `?${qs}` : ''}`);
  },
  getTemplate: (id) => request(`/templates/${id}`),
  previewPrompt: (id, slotValues) => request(`/templates/${id}/preview-prompt`, { method: 'POST', body: { slotValues } }),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/uploads', { method: 'POST', formData: fd });
  },
  generateImage: (payload) => request('/generate/image', { method: 'POST', body: payload }),
  generateVideo: (payload) => request('/generate/video', { method: 'POST', body: payload }),
  getTask: (taskId) => request(`/tasks/${taskId}`),
  optimizePrompt: (prompt, imageUrl) => request('/prompt/optimize', { method: 'POST', body: { prompt, imageUrl } }),
  listWorks: (type) => request(`/works${type ? `?type=${type}` : ''}`),
  deleteWork: (id) => request(`/works/${id}`, { method: 'DELETE' }),
  updateWork: (id, patch) => request(`/works/${id}`, { method: 'PATCH', body: patch }),
};
