/** UI 基础件: DOM 构建 / toast / 轮询生成任务 / 拟物文案 */
import { api } from './api.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

/**
 * 比例形状小图标 (比例选择 chips 用): 横版宽矩形 / 竖版窄矩形 / 1:1 方块
 * free=true 时画虚线小框 (表示任意比例)
 */
export function aspectShape(ratio, { free = false } = {}) {
  let css = 'width:13px;height:13px;';
  if (!free) {
    const [w, hNum] = String(ratio).split(':').map(Number);
    const H = 12;
    const W = Math.max(7, Math.min(20, Math.round((H * w) / hNum)));
    css = `width:${W}px;height:${H}px;`;
  }
  return h('i', { class: `asp-shape${free ? ' free' : ''}`, style: css, 'aria-hidden': 'true' });
}

export function toast(msg, kind = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = h('div', { class: 'toast-wrap' });
    document.body.append(wrap);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  wrap.append(t);
  setTimeout(() => t.remove(), 3200);
}

/** 文件 → data URI (本地预览) */
export function fileToDataURI(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 图片 URL (mock 协议跳过本地预览) */
export const isMockUrl = (u) => typeof u === 'string' && u.startsWith('mock://');

/** 生成中的拟物化阶段文案 (PRD 模块 2: 掩盖等待焦虑) */
export const IMAGE_STAGES = ['正在整理素材…', '正在打光…', '正在布景…', '正在拍摄…', '正在精修…'];
export const VIDEO_STAGES = ['正在写脚本…', '正在布置片场…', '正在打光…', '正在开拍…', '正在剪辑成片…'];

/**
 * 轮询任务直到完成。onUpdate({status, progress, stageIndex, urls, error})
 * 返回 { stop() }
 *
 * 注意: 必须走 api.getTask —— 后端地址可在「用户设置」里运行时配置,
 * 写死相对路径 /api 会导致独立部署后端时永远轮询不到结果。
 * 连续失败达到 maxErrors 即判定失败, 避免界面无限转圈。
 */
export function pollTask(taskId, onUpdate, { intervalMs = 3000, maxErrors = 5 } = {}) {
  let stopped = false;
  let timer = null;
  let errors = 0;
  async function tick() {
    if (stopped) return;
    try {
      const task = await api.getTask(taskId);
      if (stopped) return;
      errors = 0;
      const urls = Array.isArray(task?.data) ? task.data.map((d) => d.url).filter(Boolean) : [];
      const progress = Number(task?.progress ?? 0) || 0;
      onUpdate({
        status: task?.status ?? 'processing',
        isFinal: Boolean(task?.is_final),
        progress,
        stageIndex: Math.min(4, Math.floor(progress / 20)),
        urls,
        error: task?.error?.message || (task?.status === 'failed' ? '生成失败, 请重试' : null),
      });
      if (task?.is_final) return;
    } catch (e) {
      if (stopped) return;
      errors += 1;
      if (errors >= maxErrors) {
        onUpdate({
          status: 'failed',
          isFinal: true,
          progress: 0,
          stageIndex: 0,
          urls: [],
          error: `无法获取任务状态: ${e?.message ?? '未知错误'}`,
        });
        return;
      }
      onUpdate({ status: 'processing', progress: 0, stageIndex: 0, urls: [] });
    }
    timer = setTimeout(tick, intervalMs);
  }
  tick();
  return { stop() { stopped = true; clearTimeout(timer); } };
}
