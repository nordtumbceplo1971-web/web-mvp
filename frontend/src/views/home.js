import { h } from '../ui.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { tplCover, KIND_LABEL } from '../tplMeta.js';
import { getCredits } from '../store.js';
import { createAnnouncementBar } from '../announcements.js';

/**
 * 首页 v3 (上下比例布局):
 *   上 75% · 预览区 —— 各类快捷创作模板卡片, 点击直接进入创作
 *   下 25% · 快捷创作栏 —— 「图片生成」「视频生成」两个快捷板块
 */
export function renderHome(root, { navigate }) {
  root.replaceChildren();

  // ============================================================
  // 上半区 · 预览区 (75%)
  // ============================================================
  const stats = h('div', { class: 'home-stats' },
    statMini('累计作品', '—', '件'),
    statMini('今日创作', '—', '件'),
    statMini('剩余额度', String(getCredits()), '点'),
  );

  const grid = h('div', { class: 'home-preview-grid' },
    h('div', { class: 'home-loading' }, '模板加载中…'));

  const previewHead = h('div', { class: 'home-preview-head' },
    h('div', { class: 'hp-left' },
      h('div', { class: 'hp-title-row' },
        h('h1', {}, '一键生成', h('span', { class: 'hl' }, '电商营销视觉')),
        h('span', { class: 'guide-hint' }, 'AI 内容工作台 · 无需提示词经验'),
      ),
      h('p', { class: 'lead' }, '上传一张产品图，选择任务模板，自动产出上架主图、模特上身图、详情页与营销视频。全程不写提示词、不选模型、不调参数。'),
    ),
    h('div', { class: 'home-preview-side' },
      stats,
      h('a', {
        class: 'more', href: '#/templates',
        onclick: (e) => { e.preventDefault(); navigate('/templates'); },
      }, '查看全部模板 →'),
    ),
  );

  const preview = h('section', { class: 'home-preview' },
    previewHead,
    h('div', { class: 'home-preview-body' }, grid),
  );

  // ============================================================
  // 下半区 · 快捷创作栏 (25%)
  // ============================================================
  const QUICK = [
    {
      key: 'image',
      title: '图片生成',
      iconName: 'image',
      tint: '#eff6ff',
      color: '#2563eb',
      desc: '白底主图 · 场景主图 · 模特上身 · 详情套图 —— 上传产品图, 一步出图',
      tags: ['产品主图', '系列套图', '模特上身', '生图改图'],
      href: '/templates?type=image',
      cta: '选模板出图',
    },
    {
      key: 'video',
      title: '视频生成',
      iconName: 'video',
      tint: '#ecfdf5',
      color: '#16a34a',
      desc: '种草卖家秀 · 模特上身视频 · TVC 广告 —— 多语言口播, 直接成片',
      tags: ['种草视频', '上身视频', 'TVC 广告', '开箱视频'],
      href: '/templates?type=video',
      cta: '选模板出片',
    },
  ];

  const quick = h('section', { class: 'home-quick' },
    h('div', { class: 'quick-head' },
      h('h2', {}, '快捷创作'),
      h('span', { class: 'desc' }, '选一个方向, 立刻开始'),
    ),
    h('div', { class: 'quick-grid' },
      ...QUICK.map((q) => h('button', {
        class: 'quick-card', type: 'button',
        'data-quick': q.key,
        onclick: () => navigate(q.href),
      },
        h('span', { class: 'qc-ico', style: `background:${q.tint};color:${q.color}` }, icon(q.iconName, { size: 22 })),
        h('span', { class: 'qc-body' },
          h('span', { class: 'qc-title' }, q.title),
          h('span', { class: 'qc-desc' }, q.desc),
          h('span', { class: 'qc-tags' }, ...q.tags.map((t) => h('span', { class: 'qc-tag' }, t))),
        ),
        h('span', { class: 'qc-cta' }, q.cta, icon('arrow-right', { size: 15 })),
      )),
    ),
  );

  root.append(h('div', { class: 'home-split' }, preview, quick));

  // 轮播公告 (窄屏时顶栏放不下, 移到首页内容区顶部)
  const annBlock = createAnnouncementBar();
  if (annBlock) {
    annBlock.classList.add('ann-bar-block');
    root.insertBefore(annBlock, root.firstChild);
  }

  // ---- 数据填充 ----
  api.listTemplates().then(({ items }) => {
    const picked = pickPreviewTemplates(items);
    if (!picked.length) {
      grid.replaceChildren(h('div', { class: 'home-loading' }, '暂无模板, 请确认后端已启动'));
      return;
    }
    grid.replaceChildren(...picked.map((tpl) => tplCard(tpl, navigate)));
  }).catch(() => grid.replaceChildren(h('div', { class: 'home-loading' }, '模板加载失败, 请确认后端已启动')));

  api.listWorks().then(({ items }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    stats.children[0].querySelector('.v').replaceChildren(String(items.length), h('small', {}, '件'));
    stats.children[1].querySelector('.v').replaceChildren(
      String(items.filter((w) => w.createdAt >= today.getTime()).length), h('small', {}, '件'),
    );
  }).catch(() => { /* 保持占位 */ });
}

/** 预览区模板: 图片类目每个子类目取 1 个代表 + 全部视频模板 (共 8 个, 覆盖各类) */
function pickPreviewTemplates(items = []) {
  const seen = new Set();
  const picked = [];
  for (const t of items) {
    if (t.type === 'video') { picked.push(t); continue; }
    if (seen.has(t.category)) continue;
    seen.add(t.category);
    picked.push(t);
  }
  return picked.slice(0, 8);
}

function statMini(k, v, unit) {
  return h('div', { class: 'home-stat' },
    h('span', { class: 'k' }, k),
    h('span', { class: 'v' }, v, h('small', {}, unit)),
  );
}

function tplCard(tpl, navigate) {
  const { iconName, tint, color } = tplCover(tpl);
  const go = () => navigate(`/create?tpl=${tpl.id}`);
  return h('div', {
    class: 'card card-hover tpl-card tpl-card-preview', role: 'button', tabindex: 0,
    onclick: go, onkeydown: (e) => e.key === 'Enter' && go(),
  },
    h('div', { class: 'tpl-cover', style: `background:${tint}` },
      h('span', { class: 'pill pill-line kind' }, KIND_LABEL[tpl.type]),
      h('span', { class: 'ico-chip', style: `color:${color}` }, icon(iconName, { size: 22 })),
    ),
    h('div', { class: 'tpl-body' },
      h('h3', {}, tpl.title),
      h('div', { class: 'sub' }, tpl.subtitle),
      h('div', { class: 'tpl-meta' },
        h('span', { class: 'pill pill-line' }, `${tpl.timeLabel}`),
        h('span', { class: 'pill pill-line' }, `${tpl.credits} 额度`),
      ),
      h('div', { class: 'tpl-cta' },
        h('button', { class: 'btn btn-primary btn-sm', style: 'flex:1', onclick: (e) => { e.stopPropagation(); go(); } }, '做同款'),
        h('button', {
          class: 'btn btn-ghost btn-sm', 'aria-label': '查看详情',
          onclick: (e) => { e.stopPropagation(); navigate(`/templates/${tpl.id}`); },
        }, '详情'),
      ),
    ),
  );
}
