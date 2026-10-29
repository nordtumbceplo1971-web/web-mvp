import { h } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { tplCard, tplGrid } from '../tplCard.js';

/**
 * 模板库 v2: 「图片类目」「视频类目」两大板块分组展示
 * - 支持 ?cat=<分类id> 精确到子类目, ?type=image|video 精确到类目
 * - 分组展示, 消除图片/视频模板混杂无序的问题
 */
export async function renderTemplates(root, { navigate, query }) {
  root.replaceChildren();
  let activeCat = query.get('cat') || '';
  let activeType = query.get('type') || '';
  const head = h('div', { class: 'tpl-head' },
    h('h1', {}, '模板库'),
    h('p', {}, '按「你要做的事」找模板 —— 图片类目与视频类目分开陈列, 看到想要的，点击「做同款」。'),
  );

  const chipRow = h('div', { class: 'chip-row' });
  const body = h('div', { class: 'tpl-groups' }, h('div', { class: 'home-loading' }, '加载中…'));

  root.append(head, chipRow, body);

  let categories = [];
  let items = [];

  try {
    const res = await api.listTemplates();
    categories = res.categories ?? [];
    items = res.items ?? [];
  } catch (e) {
    // 后端未部署 / 地址不对 / 网络不通 —— 给出准确原因, 不再只说「加载失败」
    body.replaceChildren();
    renderApiError(body, e, {
      resource: '模板库',
      onRetry: () => navigate(`/templates${activeCat ? `?cat=${activeCat}` : ''}`),
      backTo: { label: '去用户设置', href: '#/settings', onClick: () => navigate('/settings') },
    });
    return;
  }

  function drawChips() {
    const chips = [
      { id: '', label: '全部', type: '' },
      { id: 'image', label: '图片类目', type: 'image' },
      { id: 'video', label: '视频类目', type: 'video' },
      ...categories.filter((c) => c.id !== 'all').map((c) => ({ id: c.id, label: c.label, type: '' })),
    ];
    chipRow.replaceChildren(...chips.map((c) => {
      const isActive = c.type
        ? activeType === c.type && !activeCat
        : activeCat === c.id && !activeType;
      return h('button', {
        class: `chip ${isActive ? 'active' : ''}`,
        'data-tour': c.id === '' ? 'cat-all' : null,
        onclick: () => {
          if (c.type) { activeType = activeType === c.type ? '' : c.type; activeCat = ''; }
          else { activeCat = activeCat === c.id ? '' : c.id; activeType = ''; }
          drawChips();
          drawBody();
        },
      }, c.label);
    }));
  }

  function drawBody() {
    let list = items;
    if (activeCat) list = list.filter((t) => t.category === activeCat);
    else if (activeType) list = list.filter((t) => t.type === activeType);

    if (!list.length) {
      body.replaceChildren(h('div', { class: 'empty-state' }, '这个分类还没有模板'));
      return;
    }

    // 按 类型 → 分类 两级分组
    const typeMeta = {
      image: { label: '图片类目', iconName: 'image', desc: '主图 / 套图 / 上身 / 改图, 全部图片任务', color: '#2563eb', tint: '#eff6ff' },
      video: { label: '视频类目', iconName: 'video', desc: '种草 / 上身 / TVC / 开箱, 全部视频任务', color: '#16a34a', tint: '#ecfdf5' },
    };

    const sections = [];
    for (const typeKey of ['image', 'video']) {
      const inType = list.filter((t) => t.type === typeKey);
      if (!inType.length) continue;
      const meta = typeMeta[typeKey];
      const subs = [];
      for (const c of categories) {
        if (c.id === 'all') continue;
        const subItems = inType.filter((t) => t.category === c.id);
        if (subItems.length) subs.push({ cat: c, items: subItems });
      }
      // 兜底: 后端新增了未登记的分类
      if (!subs.length) subs.push({ cat: { id: typeKey, label: KIND_LABEL[typeKey] }, items: inType });

      sections.push(h('section', { class: 'tpl-group', 'data-group': typeKey },
        h('div', { class: 'tpl-group-head' },
          h('span', { class: 'gi', style: `background:${meta.tint};color:${meta.color}` }, icon(meta.iconName, { size: 18 })),
          h('div', {},
            h('h2', {}, meta.label),
            h('span', { class: 'desc' }, meta.desc),
          ),
          h('span', { class: 'pill pill-line' }, `${inType.length} 个模板`),
        ),
        ...subs.map((s) => h('div', { class: 'tpl-sub' },
          h('div', { class: 'tpl-sub-head' },
            h('h3', {}, s.cat.label),
            h('span', { class: 'desc' }, s.cat.hint || ''),
            h('span', { class: 'pill pill-line' }, `${s.items.length} 个`),
          ),
          h('div', { class: 'tpl-grid' }, ...tplGrid(s.items, card)),
        )),
      ));
    }

    body.replaceChildren(...sections);
  }

  function card(tpl) {
    return tplCard(tpl, {
      navigate,
      cardAttrs: { 'data-tour': tpl.id === 'main-white' ? 'first-tpl-cta' : null },
    });
  }

  drawChips();
  drawBody();
}
