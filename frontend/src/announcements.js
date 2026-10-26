import { h } from './ui.js';

/**
 * 轮播公告模块 (顶栏)
 *
 * 使用方式: 往 ANNOUNCEMENTS 数组里加一条即自动进入轮播, 无需改动其它代码。
 * 交互: 自动切换(5s) · 悬停暂停 · 圆点点击直达 · 支持可选跳转链接。
 */

export const ANNOUNCEMENTS = [
  {
    id: 'test-version',
    level: 'warn', // warn(琥珀提示) | info(蓝色提示)
    label: '公告', // 标题前缀, 渲染为 !公告!
    text: '本版本为测试版本，仅为功能演示，尚未接入任何输出功能',
    link: null,
  },
];

const ROTATE_MS = 5000;
const FADE_MS = 160;

/**
 * 生成一个轮播公告条
 * @param {Array} items 公告列表
 * @param {{ onNavigate?: (item) => void }} opts
 */
export function createAnnouncementBar(items = ANNOUNCEMENTS, opts = {}) {
  if (!items?.length) return null;

  const labelEl = h('span', { class: 'ann-label' });
  const textEl = h('span', { class: 'ann-text' });
  const dotsEl = h('span', { class: 'ann-dots' });

  // 框内内容: !公告!：xxx —— 整体居中
  const content = h('span', { class: 'ann-content' },
    labelEl,
    h('span', { class: 'ann-sep' }, '：'),
    textEl,
  );

  const bar = h('div', {
    class: 'ann-bar', 'data-tour': 'announcement', role: 'status', 'aria-live': 'polite',
  }, content, dotsEl);

  let index = 0;
  let timer = null;

  function paint(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    labelEl.textContent = `!${item.label ?? '公告'}!`;
    textEl.classList.add('fade');
    setTimeout(() => {
      textEl.textContent = item.text;
      textEl.classList.remove('fade');
    }, FADE_MS);
    [...dotsEl.children].forEach((dot, k) => {
      dot.classList.toggle('on', k === index);
      dot.setAttribute('aria-selected', k === index ? 'true' : 'false');
    });
    bar.dataset.level = item.level ?? 'info';
  }

  function start() {
    stop();
    if (items.length > 1) timer = setInterval(() => paint(index + 1), ROTATE_MS);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  items.forEach((item, k) => {
    const dot = h('button', {
      class: 'ann-dot', type: 'button', role: 'tab',
      'aria-label': `第 ${k + 1} 条公告: ${item.text}`,
      onclick: () => { paint(k); start(); },
    });
    dotsEl.append(dot);
  });
  // 仅一条公告时不显示指示点
  if (items.length < 2) dotsEl.remove();

  // 点击文案: 有 link 的公告可跳转
  textEl.addEventListener('click', () => {
    const item = items[index];
    if (item.link) opts.onNavigate?.(item);
  });
  textEl.classList.toggle('linkable', !!items[index]?.link);

  bar.addEventListener('mouseenter', stop);
  bar.addEventListener('mouseleave', start);

  paint(0);
  start();
  return bar;
}
