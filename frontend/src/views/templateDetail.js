import { h, toast } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { tplCover, tplFlow, KIND_LABEL } from '../tplMeta.js';
import { startReplicate } from '../replicateModal.js';

/**
 * 模板详情页 (独立路由 /templates/:id)
 * 顶部提供统一「返回上一页」, 可回到来源页 (模板库 / 首页 / 我的作品)
 */
export async function renderTemplateDetail(root, { navigate, params, back }) {
  root.replaceChildren();

  const tplId = params?.id;
  let tpl;
  try {
    tpl = await api.getTemplate(tplId);
  } catch (e) {
    root.append(
      h('div', { class: 'page-head' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => back() }, icon('arrow-left', { size: 15 }), '返回上一页'),
      ),
    );
    renderApiError(root, e, {
      resource: '模板',
      onRetry: () => navigate(`/templates/${tplId}`),
      backTo: { label: '回模板库', href: '#/templates', onClick: () => navigate('/templates') },
    });
    return;
  }

  const { iconName, tint, color } = tplCover(tpl);

  // ---- 开工卡片 (头重脚轻: 主交互开关放页面顶部) ----
  const isLookbook = tpl.id === 'shopify-lookbook';
  const cta = h('div', { class: 'card head-cta' },
    h('div', { class: 'hc-text' },
      h('div', { class: 'hc-title' }, '准备好产品图就可以开始了'),
      h('div', { class: 'hc-desc' }, isLookbook
        ? '7 步出全套 Shopify 商品图 · 选择线路 a (AI 建模) 或线路 b (模特库)'
        : `消耗 ${tpl.credits} 额度 · ${tpl.timeLabel} · 生成后自动存入「我的作品」`),
    ),
    h('button', {
      class: 'btn btn-primary',
      onclick: () => startReplicate(tpl, { navigate }),
    }, isLookbook ? '开始出套图' : '做同款', icon('arrow-right', { size: 16 })),
  );

  // ---- 顶部: 统一返回 + 标题 + 开工卡片 ----
  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => back(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: `background:${tint};color:${color}` }, icon(iconName, { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, tpl.title),
      h('div', { class: 'ph-sub' }, tpl.subtitle),
    ),
    h('span', { class: 'pill pill-line' }, KIND_LABEL[tpl.type]),
    cta,
  );

  // ---- 效果预览 + 制作流程 (有成品图集的模板才显示, 如 Shopify 套图) ----
  const flowShots = tplFlow(tpl);
  const flowSection = [];
  if (flowShots) {
    flowSection.push(flowPreviewPanel(flowShots));
    if ((tpl.steps ?? []).length) flowSection.push(flowStepsPanel(tpl));
  }

  // ---- 准备信息 ----
  const facts = h('div', { class: 'card panel fact-card' },
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '你需要准备'), h('span', { class: 'v' }, tpl.needLabel)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '预计耗时'), h('span', { class: 'v' }, tpl.timeLabel)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '消耗额度'), h('span', { class: 'v' }, `${tpl.credits} 点`)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '所属类目'), h('span', { class: 'v' }, tpl.category)),
  );

  // ---- 提示词预览 ----
  const promptBox = h('div', { class: 'prompt-preview' }, '提示词加载中…');
  api.previewPrompt(tpl.id, {}).then((r) => {
    promptBox.textContent = r.prompt;
  }).catch(() => { promptBox.textContent = '(预览失败)'; });

  const promptPanel = h('div', { class: 'card panel' },
    h('h3', {}, '这张图会怎么拍（系统内部提示词，无需你编写）'),
    promptBox,
  );

  // ---- 微调项 ----
  const slotPanel = (tpl.slots ?? []).length
    ? h('div', { class: 'card panel' },
      h('h3', {}, '你可以点选的微调项'),
      h('div', { class: 'slot-list' },
        ...tpl.slots.map((s) => h('div', { class: 'slot-row' },
          h('span', { class: 'g-label' }, s.label),
          h('span', { class: 'slot-opts' },
            ...(s.options ?? []).map((o) => h('span', { class: 'opt-tag' },
              h('i', { class: 'sw', style: `background:${o.color}` }), o.label)),
            s.type === 'text' ? h('span', { class: 'opt-tag' }, s.placeholder || '可自由填写') : null,
          ),
        )),
      ),
    )
    : null;

  // ---- 使用建议 ----
  const tipsPanel = h('div', { class: 'card panel tip-panel' },
    h('h3', {}, '使用建议'),
    h('div', { class: 'guide-hint' }, tpl.tips),
  );

  root.append(
    header,
    // 效果预览 + 制作流程: 全宽模块, 压在双栏 (含右下「同类模板」导航卡) 之上
    flowSection.length ? h('div', { class: 'flow-section' }, ...flowSection) : null,
    h('div', { class: 'detail-layout' },
      h('div', {}, facts, promptPanel, slotPanel, tipsPanel),
      h('div', { class: 'detail-side' }, relatedPanel(tpl, navigate)),
    ),
  );
}

/* ---------- 效果预览 + 制作流程 (详情页分块展示) ---------- */

/** 点小图看大图 (全局 lightbox 单例); 视频条目用同一素材在灯箱内播放 */
function openLightbox(src, alt, caption, shot = {}) {
  let box = document.getElementById('tpl-lightbox');
  if (!box) {
    const close = () => {
      box.classList.remove('open');
      const v = box.querySelector('.lb-video');
      if (v) { v.pause(); }
    };
    box = h('div', {
      id: 'tpl-lightbox', class: 'lightbox', role: 'dialog', 'aria-modal': 'true',
      onclick: close,
    },
      h('div', { class: 'lb-inner', onclick: (e) => e.stopPropagation() },
        h('img', { class: 'lb-img', alt: '' }),
        h('video', { class: 'lb-video', controls: true, playsinline: true, preload: 'metadata' }),
        h('div', { class: 'lb-cap' }),
        h('button', { class: 'lb-close', type: 'button', 'aria-label': '关闭大图', onclick: close }, '✕'),
      ),
    );
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.append(box);
  }
  const img = box.querySelector('.lb-img');
  const video = box.querySelector('.lb-video');
  if (shot.video) {
    img.style.display = 'none';
    video.style.display = '';
    video.poster = shot.poster ?? '';
    video.src = shot.video;
    video.currentTime = 0;
    video.play().catch(() => { /* 自动播放被拦截时用户可点播放 */ });
  } else {
    video.pause();
    video.removeAttribute('src');
    video.style.display = 'none';
    img.style.display = '';
    img.src = src;
  }
  img.alt = alt;
  box.querySelector('.lb-cap').textContent = caption ?? alt;
  box.classList.add('open');
}

/** 效果预览: 参考图 + 结果预览 (小图网格, 点击放大; 视频条目跨 2 槽位, 与封面同一条素材) */
function flowPreviewPanel(shots) {
  // 含视频的混合比例素材 (TVC): 走定高胶片条, 宽度随素材原始比例, 三卡才能同高
  // 纯图流程 (lookbook): 保持等宽网格, 视频条目占 2 槽位, 列数按占位累加
  const hasVideo = shots.some((s) => s.video);
  const cols = Math.min(shots.reduce((n, s) => n + (s.video ? 2 : 1), 0), 8);
  // 条目少 (≤4) 的纯图流程 (如模特上身图) 走等宽网格会把卡片撑到 1/3 面板宽,
  // 且各素材原始比例不同必被裁切 —— 同样改用定高胶片条: 窗口按素材比例等比展开, 同高不裁切
  const strip = hasVideo || shots.length <= 4;
  return h('section', { class: 'card panel flow-panel' },
    h('h3', {}, icon('image', { size: 15 }), ' 效果预览'),
    h('p', { class: 'flow-note' }, '参考素材与成片预览 · 点小图看大图'),
    h('div', { class: `flow-gallery${strip ? ' flow-gallery-media' : ''}`, style: strip ? '' : `--flow-cols: ${cols}` },
      ...shots.map((s, i) => {
        const isVideo = !!s.video;
        const btn = h('button', {
          class: `flow-shot${i === 0 ? ' is-product' : ''}${isVideo ? ' is-video' : ''}`,
          type: 'button', title: `${s.cap} · 点击看大图`,
          style: isVideo ? 'grid-column: span 2' : '',
          onclick: () => openLightbox(s.src, s.alt, s.cap, s),
        },
          isVideo
            ? h('video', {
              class: 'flow-video', src: s.video, poster: s.poster,
              muted: true, loop: true, playsinline: true, preload: 'metadata',
              'aria-label': s.alt || s.cap,
            })
            : h('img', { src: s.src, alt: s.alt, loading: 'lazy' }),
          h('span', { class: 'fs-cap' }, s.cap),
        );
        if (isVideo) {
          // 缩略图悬停即播 (静音), 移开暂停
          const v = btn.querySelector('video');
          btn.addEventListener('mouseenter', () => v.play().catch(() => {}));
          btn.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
        }
        return btn;
      }),
    ),
  );
}

/** 制作流程: 产品原图 + 分步横向时间线 (一排, 不占竖向大片空间) */
function flowStepsPanel(tpl) {
  const steps = tpl.steps ?? [];
  return h('section', { class: 'card panel flow-panel' },
    h('h3', {}, icon('layers', { size: 15 }), ` 制作流程 · ${steps.length} 步出全套`),
    h('div', { class: 'flow-steps' },
      h('div', { class: 'flow-node is-input' },
        h('div', { class: 'fn-top' }, h('span', { class: 'fs-no' }, '输入'), h('b', {}, '产品原图')),
        h('p', { class: 'fs-desc' }, '外观、印花、颜色与版型的唯一参考, 每一步都不得改产品'),
        h('div', { class: 'fs-tags' }, h('span', { class: 'pill pill-line' }, tpl.needLabel)),
      ),
      ...steps.map((s) => h('div', { class: 'flow-node' },
        h('div', { class: 'fn-top' }, h('span', { class: 'fs-no' }, s.id), h('b', {}, s.name)),
        h('p', { class: 'fs-desc' }, s.desc),
        (s.needModel || (s.refSteps ?? []).length)
          ? h('div', { class: 'fs-tags' },
            s.needModel ? h('span', { class: 'pill pill-soft' }, '需要模特') : null,
            (s.refSteps ?? []).length ? h('span', { class: 'pill pill-line' }, `参考 ${s.refSteps.join(' / ')}`) : null,
          )
          : null,
      )),
    ),
  );
}

/** 同类目其它模板 */
function relatedPanel(tpl, navigate) {
  const wrap = h('div', { class: 'card panel' }, h('h3', {}, '同类模板'));
  api.listTemplates().then(({ items }) => {
    const others = items.filter((t) => t.category === tpl.category && t.id !== tpl.id).slice(0, 4);
    if (!others.length) { wrap.replaceChildren(h('h3', {}, '同类模板'), h('div', { class: 'desc' }, '暂无其它同类模板')); return; }
    wrap.replaceChildren(
      h('h3', {}, '同类模板'),
      h('div', { class: 'related-list' },
        ...others.map((t) => {
          const c = tplCover(t);
          return h('button', {
            class: 'related-item', type: 'button',
            onclick: () => navigate(`/templates/${t.id}`),
          },
            h('span', { class: 'ri-ico', style: `background:${c.tint};color:${c.color}` }, icon(c.iconName, { size: 15 })),
            h('span', { class: 'ri-t' }, t.title),
            h('span', { class: 'pill pill-line' }, `${t.credits} 额度`),
          );
        }),
      ),
    );
  }).catch(() => { /* ignore */ });
  return wrap;
}
