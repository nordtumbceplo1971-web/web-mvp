import { h, toast } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { tplCover, tplFlow, KIND_LABEL, CATEGORY_LABEL } from '../tplMeta.js';
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

  // ---- 效果预览 + 制作流程 (多步骤模板才有流程时间线) ----
  const flowShots = tplFlow(tpl);
  const flowSection = [];
  if ((tpl.steps ?? []).length) flowSection.push(flowStepsPanel(tpl));

  // ---- 效果预览区 (大图 + 缩略图; 无素材时给示意占位) ----
  const heroPanel = detailHero(tpl, flowShots, tint, color, iconName);

  // ---- 拍摄方案 (提示词拆段, 可读地讲清「系统会怎么拍」) ----
  const planPanel = shootingPlanPanel(tpl);

  // ---- 可点选的微调项 ----
  const slotPanel = (tpl.slots ?? []).length
    ? h('div', { class: 'card panel' },
      h('h3', {}, icon('palette', { size: 15 }), ' 你可以点选的微调项'),
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
    h('h3', {}, icon('info', { size: 15 }), ' 使用建议'),
    h('div', { class: 'guide-hint' }, tpl.tips),
  );

  root.append(
    header,
    // 效果预览 + 制作流程: 全宽模块, 压在双栏 (含右下「同类模板」导航卡) 之上
    // 注意: 原生 append(null) 会渲染出字符串 "null", 必须用数组展开过滤
    ...(flowSection.length ? [h('div', { class: 'flow-section' }, ...flowSection)] : []),
    h('div', { class: 'detail-layout' },
      h('div', { class: 'detail-main' },
        heroPanel,
        planPanel,
        slotPanel,
        tipsPanel,
      ),
      h('div', { class: 'detail-side' },
        detailCtaCard(tpl, navigate, isLookbook),
        relatedPanel(tpl, navigate),
      ),
    ),
  );
}

/* ---------- 效果预览区 (大图 + 缩略图切换; 无素材给示意占位) ---------- */

/** 素材真实宽高比 (图片取 naturalWidth, 视频取 videoWidth) */
function mediaRatio(el) {
  if (!el) return null;
  const w = el.naturalWidth || el.videoWidth;
  const h = el.naturalHeight || el.videoHeight;
  return w && h ? w / h : null;
}

/**
 * 自适应适配器画布:
 * - 容器宽高按素材真实比例收敛 (竖图 → 窄而高, 横图 → 宽而扁), 不留大片空白
 * - 宽不超过所在列, 高不超过可视高度 (calc(100vh - 240px))
 * - 素材 contain 完整显示, 不裁切、不以原始像素溢出
 * - 窗口尺寸变化时重算
 */
function fitCanvas(container, mediaEl) {
  if (!mediaEl) return;
  const apply = () => {
    const r = mediaRatio(mediaEl);
    if (!r) return;
    container.style.width = '100%';                  // 先还原成列宽, 再按比例收敛
    // 可用宽 = 预览区总宽 - 右侧缩略图列(148) - 间距(14); 窄屏为单列
    const grid = container.parentElement;
    const cols = window.innerWidth > 640 ? 162 : 0;
    const availW = Math.max(220, (grid?.clientWidth ?? container.clientWidth) - cols);
    const maxH = Math.max(320, window.innerHeight - 240);
    const w = Math.max(220, Math.min(availW, maxH * r));
    container.style.width = `${Math.round(w)}px`;
    container.style.height = `${Math.round(Math.min(maxH, w / r))}px`;
  };
  if (mediaEl.tagName === 'IMG') {
    if (mediaEl.complete && mediaEl.naturalWidth) apply();
    else mediaEl.addEventListener('load', apply, { once: true });
  } else if (mediaEl.videoWidth) apply();
  else mediaEl.addEventListener('loadedmetadata', apply, { once: true });

  // resize 重算 (替换旧监听, 避免切换素材后累积)
  if (container._fitResize) window.removeEventListener('resize', container._fitResize);
  container._fitResize = () => apply();
  window.addEventListener('resize', container._fitResize);
}

/**
 * 详情页顶部效果预览:
 * - 有成品图集 (flows): 左侧自适应画布 + 右侧缩略图列, 点缩略图切换, 点大图看原图
 * - 无成品图集: 示意占位 (分类色 + 构图说明), 告诉用户"上传产品图后按此方案生成"
 */
function detailHero(tpl, shots, tint, color, iconName) {
  const box = h('section', { class: 'card panel detail-hero-panel' });

  if (!shots?.length) {
    box.append(
      h('h3', {}, icon('image', { size: 15 }), ' 效果预览'),
      h('div', { class: 'hero-empty', style: `background:linear-gradient(155deg, ${tint} 0%, #ffffff 72%)` },
        h('div', { class: 'he-frame' },
          h('span', { class: 'he-ico', style: `color:${color}` }, icon(iconName, { size: 30 })),
        ),
        h('div', { class: 'he-text' },
          h('b', {}, '上传产品图, 按此方案出图'),
          h('span', {}, tpl.subtitle),
        ),
      ),
    );
    return box;
  }

  const main = h('div', { class: 'hero-main' });
  const thumbs = h('div', { class: 'hero-thumbs' });
  const capBar = h('div', { class: 'hero-capbar' });
  // 默认展示成片 (效果/成图/预览), 而不是输入素材 (产品图/模特图)
  const resultIdx = shots.findIndex((s) => /效果|成图|预览|结果/.test(s.cap ?? ''));
  let current = resultIdx >= 0 ? resultIdx : 0;

  const renderMain = (i) => {
    const s = shots[i];
    const media = s.video
      ? h('video', { src: s.video, poster: s.poster, controls: true, playsinline: true, preload: 'metadata', 'aria-label': s.alt || s.cap })
      : h('img', { src: s.src, alt: s.alt || s.cap, loading: 'lazy' });
    main.replaceChildren(media);
    fitCanvas(main, media);
    capBar.textContent = s.cap ?? '';
    [...thumbs.children].forEach((el, idx) => el.classList.toggle('active', idx === i));
  };

  shots.forEach((s, i) => {
    const btn = h('button', {
      class: 'hero-thumb', type: 'button', title: s.cap,
      onclick: () => { current = i; renderMain(i); },
    },
      s.video
        ? h('video', { src: s.video, poster: s.poster, muted: true, loop: true, playsinline: true, preload: 'metadata', 'aria-label': s.alt || s.cap })
        : h('img', { src: s.src, alt: s.alt || s.cap, loading: 'lazy' }),
      h('span', {}, s.cap),
    );
    if (s.video) {
      const v = btn.querySelector('video');
      btn.addEventListener('mouseenter', () => v.play().catch(() => {}));
      btn.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
    }
    thumbs.append(btn);
  });

  main.addEventListener('click', () => {
    const s = shots[current];
    openLightbox(s.src, s.alt, s.cap, s);
  });
  renderMain(current);

  box.append(
    h('h3', {}, icon('image', { size: 15 }), ' 效果预览'),
    h('div', { class: 'detail-hero' }, main, h('div', { class: 'hero-side' }, capBar, thumbs)),
    h('p', { class: 'hero-note' }, '点缩略图切换 · 点大图看原图'),
  );
  return box;
}

/* ---------- 拍摄方案 (提示词分段, 可读化) ---------- */

/**
 * 把模板提示词按行拆成「标题: 内容」分段
 * 无标题的行 (如整段说明) 原样作为正文, 不丢内容
 */
function promptSections(tpl) {
  const out = [];
  for (const line of (tpl.promptTemplate ?? '').split('\n')) {
    const text = line.trim();
    if (!text) continue;
    const m = text.match(/^([^:：]{2,28})[:：]\s*(.+)$/);
    if (m) out.push({ title: m[1].trim(), body: m[2].trim() });
    else out.push({ title: '', body: text });
  }
  return out;
}

const NEGATIVE_TAGS = ['负面约束', 'NEGATIVE', '负面'];

/**
 * 拍摄方案: 提示词分段展示 (负面约束段标红), 取代一整块原始文本
 * 用服务端 previewPrompt 取「槽位已解析」的版本, 避免把 {{占位符}} 暴露给用户
 */
function shootingPlanPanel(tpl) {
  const list = h('div', { class: 'plan-list' });
  const panel = h('section', { class: 'card panel plan-panel' },
    h('h3', {}, icon('clapperboard', { size: 15 }), ' 拍摄方案（系统内部提示词，无需你编写）'),
    h('p', { class: 'plan-note' }, '这一段决定成片长什么样：参考图怎么用、怎么摆、怎么打光、哪些不能出现'),
    list,
  );

  api.previewPrompt(tpl.id, {}).then((r) => {
    const sections = promptSections({ promptTemplate: r.prompt ?? '' });
    if (!sections.length) { list.remove(); return; }
    for (const s of sections) {
      const negative = NEGATIVE_TAGS.some((k) => (s.title || s.body).includes(k));
      list.append(h('div', { class: `plan-sec${negative ? ' is-negative' : ''}` },
        s.title ? h('div', { class: 'plan-tag' }, icon(negative ? 'x' : 'scan', { size: 13 }), s.title) : null,
        h('p', { class: 'plan-body' }, s.body),
      ));
    }
  }).catch(() => {
    list.replaceChildren(h('p', { class: 'plan-body' }, '(拍摄方案预览失败)'));
  });

  return panel;
}

/* ---------- 右栏开工卡 ---------- */

function detailCtaCard(tpl, navigate, isLookbook) {
  const fact = (k, v) => h('div', { class: 'dcta-fact' },
    h('span', { class: 'k' }, k),
    h('span', { class: 'v' }, v),
  );
  return h('div', { class: 'card panel detail-cta' },
    h('div', { class: 'dcta-title' }, tpl.title),
    h('div', { class: 'dcta-sub' }, tpl.subtitle),
    h('button', {
      class: 'btn btn-primary btn-lg dcta-btn',
      onclick: () => startReplicate(tpl, { navigate }),
    }, isLookbook ? '开始出套图' : '做同款', icon('arrow-right', { size: 16 })),
    h('div', { class: 'dcta-facts' },
      fact('消耗额度', `${tpl.credits} 点`),
      fact('预计耗时', tpl.timeLabel),
      fact('你需要准备', tpl.needLabel),
      fact('所属类目', CATEGORY_LABEL[tpl.category] ?? tpl.category),
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
