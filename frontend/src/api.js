/** 后端 API 客户端 (前后端分离: 全部走 /api 代理) */

async function request(path, { method = 'GET', body, formData } = {}) {
  const opts = { method };
  if (formData) opts.body = formData;
  else if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || data?.error) {
    const err = new Error(data?.error?.message || `请求失败 (${res.status})`);
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
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
