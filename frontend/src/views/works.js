import { h, toast } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { startReplicate } from '../replicateModal.js';

/** 我的作品 (PRD 模块 5): 按 product 归档的 MVP 形态 — 列表 + 再做一张 + 收藏 + 删除 */
export async function renderWorks(root, { navigate }) {
  root.replaceChildren();

  const head = h('div', {},
    h('h1', { style: 'font-size:28px;font-weight:900;margin-top:8px' }, '我的作品'),
    h('p', { style: 'color:var(--ink-2);margin:6px 0 0' }, '做好的图和视频都在这里。悬浮卡片可以「再做一张」或删除。'),
  );
  const filterRow = h('div', { class: 'works-filter' });
  const grid = h('div', { class: 'works-grid' });
  root.append(head, filterRow, grid);

  const filters = [['', '全部'], ['image', '图片'], ['video', '视频']];
  let currentType = '';
  let works = [];

  function drawFilters() {
    filterRow.replaceChildren(...filters.map(([v, label]) =>
      h('button', { class: `chip ${currentType === v ? 'active' : ''}`, onclick: () => { currentType = v; drawFilters(); drawGrid(); } }, label),
    ));
  }

  async function load() {
    grid.replaceChildren(h('div', { style: 'color:var(--ink-3);padding:30px' }, '加载中…'));
    try {
      const res = await api.listWorks();
      works = res.items ?? [];
    } catch (e) {
      // 说清真实原因 (后端未部署 / 地址不对 / 网络不通), 而不是笼统的「加载失败」
      grid.replaceChildren();
      renderApiError(grid, e, {
        resource: '作品',
        onRetry: () => load(),
        backTo: { label: '去用户设置', href: '#/settings', onClick: () => navigate('/settings') },
      });
      return;
    }
    drawGrid();
  }

  function drawGrid() {
    const items = currentType ? works.filter((w) => w.type === currentType) : works;
    if (!items.length) {
      grid.replaceChildren(h('div', { class: 'empty-state', style: 'grid-column:1/-1' },
        h('div', { class: 'ico' }, icon('folder', { size: 40 })),
        h('div', { style: 'font-weight:900;color:var(--ink-2);margin:8px 0' }, '还没有作品'),
        h('div', { style: 'margin-bottom:16px' }, '去模板库选一个, 1 分钟出第一张图'),
        h('button', { class: 'btn btn-primary', onclick: () => navigate('/templates') }, '去模板库 →'),
      ));
      return;
    }
    grid.replaceChildren(...items.map(card));
  }

  function card(w) {
    const cover = h('div', { class: 'work-cover' },
      w.type === 'video'
        ? h('video', { src: w.coverUrl ?? w.urls?.[0], controls: true, playsinline: true, preload: 'metadata' })
        : h('img', { src: w.coverUrl ?? w.urls?.[0], alt: w.title, loading: 'lazy' }),
      w.type === 'video' ? h('span', { class: 'pill pill-line badge-video' }, '视频') : null,
      w.isMock ? h('span', { class: 'pill pill-line badge-video', style: 'left:auto;right:10px' }, '演示') : null,
    );
    const favBtn = h('button', {
      class: 'btn btn-ghost btn-sm', title: '保存为常用',
      onclick: async () => {
        await api.updateWork(w.id, { favorite: !w.favorite });
        toast(w.favorite ? '已取消常用' : '已保存为常用', 'ok');
        load();
      },
    }, w.favorite ? '已收藏' : '收藏');
    return h('div', { class: 'card card-hover work-card' },
      cover,
      h('div', { class: 'work-body' },
        h('div', { class: 't' }, w.title),
        h('div', { class: 'meta' },
          `${w.status === 'completed' ? '✅ 完成' : w.status === 'failed' ? '❌ 失败' : '⏳ 生成中'} · ${new Date(w.createdAt).toLocaleString('zh-CN', { hour12: false })}`),
        h('div', { class: 'work-actions' },
          h('button', {
            class: 'btn btn-primary btn-sm', style: 'flex:1',
            onclick: () => w.templateId && startReplicate(w.templateId, { navigate }),
          }, icon('refresh', { size: 14 }), '再做一张'),
          favBtn,
          h('button', {
            class: 'btn btn-danger-ghost btn-sm', title: '删除', 'aria-label': '删除作品',
            onclick: async () => {
              await api.deleteWork(w.id);
              toast('已删除', 'ok');
              load();
            },
          }, icon('trash', { size: 14 })),
        ),
      ),
    );
  }

  drawFilters();
  await load();
}
