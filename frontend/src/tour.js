import { h } from './ui.js';
import { isTourDone, markTourDone } from './store.js';

/**
 * 页面初始化视觉引导 (需求 7): 金色聚光 + 遮罩 + 分步气泡
 * steps: [{ title, text, selector }] — selector 缺失时聚光居中
 */
const DEFAULT_STEPS = [
  {
    title: '欢迎来到 BrandStudio',
    text: '这里不需要懂 AI、不用写提示词——选模板、传产品图, 内容自动做出来。先带你逛 4 个地方 (共 5 步)。',
  },
  {
    title: '第 1 站 · 模板库',
    text: '按「你要做的事」分类: 主图、上身图、视频、改图……点「做同款」就开工。',
    selector: '[data-tour="nav-templates"]',
  },
  {
    title: '第 2 站 · 自由工作台',
    text: '想自己折腾? 生图改图工作台带「一键优化提示词」, 写大白话也行。',
    selector: '[data-tour="nav-studio"]',
  },
  {
    title: '第 3 站 · 我的作品',
    text: '做好的图和视频都在这里, 随时「再做一张」。',
    selector: '[data-tour="nav-works"]',
  },
  {
    title: '第 4 站 · 体验额度',
    text: '新用户送 100 额度, 每次生成前都会显示消耗, 不够会提前提醒你。',
    selector: '[data-tour="credits"]',
  },
];

export function startTour({ force = false, onDone } = {}) {
  if (!force && isTourDone()) return;
  const overlay = h('div', { class: 'tour-overlay' });
  const mask = h('div', { class: 'tour-mask' });
  const hole = h('div', { class: 'tour-hole' });
  const card = h('div', { class: 'tour-card' });
  overlay.append(mask, hole, card);
  document.body.append(overlay);

  let idx = 0;
  let prevRing = null;

  function clearRing() {
    if (prevRing) { prevRing.classList.remove('guide-ring'); prevRing = null; }
  }

  function place() {
    const step = DEFAULT_STEPS[idx];
    const target = step.selector ? document.querySelector(step.selector) : null;
    clearRing();
    if (target) {
      const r = target.getBoundingClientRect();
      Object.assign(hole.style, {
        left: `${r.left - 8}px`, top: `${r.top - 8}px`,
        width: `${r.width + 16}px`, height: `${r.height + 16}px`,
      });
      // 气泡放目标下方, 放不下放上方
      const below = window.innerHeight - r.bottom > 190;
      Object.assign(card.style, {
        left: `${Math.max(16, Math.min(r.left, window.innerWidth - 352))}px`,
        top: below ? `${r.bottom + 18}px` : `${Math.max(16, r.top - 200)}px`,
      });
      target.classList.add('guide-ring');
      prevRing = target;
    } else {
      Object.assign(hole.style, {
        left: '50%', top: '38%', width: '0px', height: '0px',
      });
      Object.assign(card.style, {
        left: `${Math.max(16, window.innerWidth / 2 - 170)}px`, top: '42%',
      });
    }
    card.replaceChildren(
      h('div', { class: 'step-no' }, `引导 ${idx + 1} / ${DEFAULT_STEPS.length}`),
      h('h3', {}, step.title),
      h('p', {}, step.text),
      h('div', { class: 'row' },
        h('div', { class: 'tour-dots' }, DEFAULT_STEPS.map((_, i) => h('i', { class: i === idx ? 'on' : '' }))),
        h('button', {
          class: 'skip', style: 'background:none;border:0;font-weight:800;color:var(--ink-3);font-size:13px',
          onclick: finish,
        }, '跳过'),
        h('button', { class: 'btn btn-primary btn-sm', onclick: next }, idx === DEFAULT_STEPS.length - 1 ? '开始使用' : '下一步'),
      ),
    );
  }

  function next() {
    if (idx >= DEFAULT_STEPS.length - 1) return finish();
    idx += 1;
    place();
  }

  function finish() {
    clearRing();
    overlay.remove();
    markTourDone();
    onDone?.();
  }

  window.addEventListener('resize', place, { once: true });
  place();
}
