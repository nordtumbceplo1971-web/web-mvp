import { h } from './ui.js';
import { icon } from './icons.js';
import { getApiBase } from './api.js';

/**
 * 统一的接口错误展示
 * 目的: 把「后端没部署 / 地址不对 / 资源不存在 / 服务端异常」区分开,
 * 避免像以前那样一律提示「模板不存在」而掩盖真实原因。
 */

const REASONS = {
  network: {
    title: '无法连接后端服务',
    hint: '请求没有到达 /api —— 请确认后端已部署；若在设置里填了独立后端地址，还需让后端放行当前站点的 CORS（后端环境变量 CORS_ORIGIN）。',
  },
  timeout: {
    title: '请求超时',
    hint: '后端长时间没有响应 —— 可能是服务正在冷启动或负载过高，请稍后重试。',
  },
  'no-api': {
    title: '后端未响应（返回的不是接口数据）',
    hint: '多半是 /api 路径没有落到后端服务（前端被单独部署时最常见），请检查部署配置或在设置里指定后端地址。',
  },
  'not-found': {
    title: '请求的资源不存在',
    hint: '后端已连通，但该资源不存在（模板 ID 可能已变更）。',
  },
  server: {
    title: '后端服务出错',
    hint: '服务端返回 5xx，请查看后端日志。',
  },
  http: {
    title: '请求被拒绝',
    hint: '后端返回 4xx，请检查参数。',
  },
  unknown: {
    title: '请求失败',
    hint: '发生未知错误，请稍后重试。',
  },
};

/** 把 ApiError 翻译成 { title, hint, url } */
export function describeApiError(err, resource = '数据') {
  const reason = err?.reason && REASONS[err.reason] ? err.reason : 'unknown';
  const info = REASONS[reason];
  const base = getApiBase();
  return {
    title: info.title,
    hint: info.hint,
    reason,
    url: err?.url || `${base}/api`,
    detail: err?.message || '',
    resource,
  };
}

/**
 * 渲染接口错误页
 * @param {HTMLElement} root
 * @param {Error} err
 * @param {{resource?:string, onRetry?:Function, backTo?:{label:string,href:string,onClick?:Function}, compact?:boolean}} opts
 */
export function renderApiError(root, err, opts = {}) {
  const info = describeApiError(err, opts.resource);
  if (opts.compact) {
    root.append(h('div', { class: 'api-error api-error-compact' },
      h('div', { class: 'api-error-title' }, info.title),
      h('div', { class: 'desc' }, info.hint),
      h('div', { class: 'api-error-meta' }, `接口地址: ${info.url}`),
      opts.onRetry ? h('div', { class: 'api-error-actions' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: opts.onRetry }, '重试')) : null,
    ));
    return info;
  }
  root.append(h('div', { class: 'empty-state api-error' },
    h('div', { class: 'ico' }, icon('info', { size: 40 })),
    h('div', { class: 'api-error-title' }, info.title),
    h('div', { class: 'desc' }, info.hint),
    info.detail ? h('div', { class: 'api-error-detail' }, `服务端信息: ${info.detail}`) : null,
    h('div', { class: 'api-error-meta' }, `接口地址: ${info.url}`),
    h('div', { class: 'api-error-actions' },
      opts.onRetry ? h('button', { class: 'btn btn-primary', onclick: opts.onRetry }, '重试') : null,
      opts.backTo
        ? h('a', {
          class: 'btn btn-ghost', href: opts.backTo.href,
          onclick: (e) => { e.preventDefault(); opts.backTo.onClick?.(); },
        }, opts.backTo.label)
        : null,
    ),
  ));
  return info;
}
