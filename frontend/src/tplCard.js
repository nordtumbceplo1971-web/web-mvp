import { h } from './ui.js';
import { icon } from './icons.js';
import { tplCover, tplLogo, tplPreview, KIND_LABEL } from './tplMeta.js';

/**
 * 模板卡片（统一版式，首页预览区与模板库共用）
 *
 *   ┌──────────────────────┐
 *   │   效果预览区 (约70%)   │  分类色块 + 图标占位，预留 preview 图位
 *   ├──────────────────────┤
 *   │   一键复刻 (红色条)     │  快速入口，点它直接开始出图
 *   ├──────────────────────┤
 *   │  模板名称      [logo]  │  蓝框 logo 在右，名称在左
 *   │  ┌────────────────┐  │
 *   │  │ 简单描述 (可展开)│  │  卡片自适应缩放
 *   │  └────────────────┘  │
 *   └──────────────────────┘
 *
 * @param {object} tpl 模板对象
 * @param {{navigate:Function, onReplicate?:Function, cardAttrs?:object}} opts
 */
export function tplCard(tpl, { navigate, onReplicate, cardAttrs = {} } = {}) {
  const { iconName, tint, color } = tplCover(tpl);
  const logo = tplLogo(tpl);
  const preview = tplPreview(tpl);

  // 一键复刻 = 直接进创作流 (create.js 会把多步骤模板分流到 /lookbook)
  const replicate = onReplicate ?? (() => navigate(`/create?tpl=${tpl.id}`));
  const goDetail = () => navigate(`/templates/${tpl.id}`);

  // ---- 可展开描述 ----
  const descText = [tpl.subtitle, tpl.tips].filter(Boolean).join('　');
  const descEl = h('p', { class: 'tc-desc' }, descText);
  const moreBtn = h('button', {
    class: 'tc-more', type: 'button',
    onclick: (e) => { e.stopPropagation(); toggleDesc(); },
  }, '展开');

  function toggleDesc() {
    const open = descEl.classList.toggle('open');
    moreBtn.textContent = open ? '收起' : '展开';
    moreBtn.classList.toggle('is-open', open);
  }

  const info = h('div', { class: 'tc-info' },
    h('div', { class: 'tc-head' },
      h('h3', { class: 'tc-title' }, tpl.title),
      h('div', { class: 'tc-logo', title: logo ? logo.alt : tpl.title },
        logo
          ? h('img', { src: logo.src, alt: logo.alt, loading: 'lazy' })
          : icon(iconName, { size: 18 }),
      ),
    ),
    h('div', { class: 'tc-desc-box' }, descEl),
    moreBtn,
  );

  const card = h('article', {
    class: 'card card-hover tpl-card2', role: 'button', tabindex: 0,
    onclick: goDetail,
    onkeydown: (e) => { if (e.key === 'Enter') goDetail(); },
    ...cardAttrs,
  },
    h('div', {
      class: `tc-preview${preview ? ' has-img' : ''}`,
      style: preview ? '' : `background:linear-gradient(150deg, ${tint} 0%, #ffffff 100%)`,
    },
      h('span', { class: 'pill pill-line kind' }, KIND_LABEL[tpl.type]),
      preview
        ? h('img', { class: 'tc-img', src: preview.src, alt: preview.alt || tpl.title, loading: 'lazy' })
        : h('div', { class: 'tc-art' },
          h('div', { class: 'tc-art-blob' }),
          h('div', { class: 'tc-art-blob b2' }),
          h('span', { class: 'tc-art-ico', style: `color:${color}` }, icon(iconName, { size: 34 })),
          h('span', { class: 'tc-art-label' }, '效果预览'),
        ),
    ),
    h('button', {
      class: 'tc-replicate', type: 'button',
      onclick: (e) => { e.stopPropagation(); replicate(); },
    },
      h('span', { class: 'tr-ico' }, icon('sparkles', { size: 15 })),
      h('span', { class: 'tr-label' }, '一键复刻'),
      h('span', { class: 'tr-go' }, icon('arrow-right', { size: 15 })),
    ),
    info,
  );

  // 描述不溢出时收起「展开」按钮，避免多余控件
  requestAnimationFrame(() => {
    if (descEl.scrollHeight <= descEl.clientHeight + 1) {
      moreBtn.style.display = 'none';
      descEl.classList.add('open');
    }
  });

  return card;
}
