import { h, toast, confirmDialog } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { startReplicate } from '../replicateModal.js';

/**
 * 我的作品 (PRD 模块 5): 按 product 归档的 MVP 形态 — 列表 + 再做一张 + 收藏 + 删除
 *
 * 破坏性操作约束 (删除不可恢复):
 *   - 单条删除 → 二次确认弹窗, 取消/遮罩/Esc 一律视为「否」
 *   - 多选批量删除 → 顶部工具条勾选, 确认弹窗列出数量, 后端一次提交
 *   - 接口失败: 保留作品与选中状态, toast 说明原因, 不做「假删除」
 */
export async function renderWorks(root, { navigate }) {
  root.replaceChildren();

  const head = h('div', {},
    h('h1', { style: 'font-size:28px;font-weight:900;margin-top:8px' }, '我的作品'),
    h('p', { style: 'color:var(--ink-2);margin:6px 0 0' }, '做好的图和视频都在这里。悬浮卡片可以「再做一张」或删除。'),
  );
  const filterRow = h('div', { class: 'works-filter' });
  const pickBar = h('div', { class: 'work-pick-bar', style: 'display:none' });
  const grid = h('div', { class: 'works-grid' });
  root.append(head, filterRow, pickBar, grid);

  const filters = [['', '全部'], ['image', '图片'], ['video', '视频']];
  let currentType = '';
  let works = [];
  let selectMode = false;
  const selected = new Set(); // 多选: 作品 id

  /** 当前筛选下可见的作品 (多选只作用于可见项) */
  const visibleWorks = () => (currentType ? works.filter((w) => w.type === currentType) : works);

  function drawFilters() {
    filterRow.replaceChildren(
      h('div', { class: 'works-filter-chips' }, ...filters.map(([v, label]) =>
        h('button', { class: `chip ${currentType === v ? 'active' : ''}`, onclick: () => { currentType = v; drawFilters(); drawGrid(); drawPickBar(); } }, label),
      )),
      h('button', {
        class: `btn btn-sm ${selectMode ? 'btn-blue' : 'btn-ghost'}`,
        title: selectMode ? '退出多选' : '多选作品后可批量删除',
        onclick: () => {
          selectMode = !selectMode;
          if (!selectMode) selected.clear();
          drawFilters();
          drawPickBar();
          drawGrid();
        },
      }, selectMode ? '退出多选' : '多选'),
    );
  }

  function drawPickBar() {
    pickBar.style.display = selectMode ? 'flex' : 'none';
    if (!selectMode) { pickBar.replaceChildren(); return; }
    pickBar.replaceChildren(
      h('span', { class: 'wpb-count' }, `已选 ${selected.size} 件`),
      h('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => {
          for (const w of visibleWorks()) selected.add(w.id);
          drawGrid();
          drawPickBar();
        },
      }, '全选'),
      h('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => {
          selected.clear();
          drawGrid();
          drawPickBar();
        },
      }, '取消选择'),
      h('button', {
        class: 'btn btn-danger btn-sm',
        disabled: selected.size === 0,
        onclick: () => batchDelete(),
      }, `批量删除 (${selected.size})`),
    );
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
    const items = visibleWorks();
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

  /** 勾选/取消勾选: 原地更新卡片, 不整页重绘 (避免视频重载) */
  function setSelected(id, on) {
    if (on) selected.add(id); else selected.delete(id);
    const el = grid.querySelector(`[data-work-id="${id}"]`);
    if (el) {
      el.classList.toggle('selected', on);
      const cb = el.querySelector('.work-pick input');
      if (cb) cb.checked = on;
    }
    drawPickBar();
  }

  function card(w) {
    const isSel = selected.has(w.id);
    const cover = h('div', {
      class: 'work-cover',
      onclick: (e) => {
        if (!selectMode) return;
        if (e.target.closest('.work-pick')) return; // checkbox 自己处理
        setSelected(w.id, !selected.has(w.id));
      },
    },
      w.type === 'video'
        ? h('video', { src: w.coverUrl ?? w.urls?.[0], controls: true, playsinline: true, preload: 'metadata' })
        : h('img', { src: w.coverUrl ?? w.urls?.[0], alt: w.title, loading: 'lazy' }),
      w.type === 'video' ? h('span', { class: 'pill pill-line badge-video' }, '视频') : null,
      w.isMock ? h('span', { class: 'pill pill-line badge-video', style: 'left:auto;right:10px' }, '演示') : null,
      selectMode
        ? h('label', { class: 'work-pick', onclick: (e) => e.stopPropagation() },
          h('input', {
            type: 'checkbox', checked: isSel, 'aria-label': `选择 ${w.title}`,
            onchange: (e) => setSelected(w.id, e.target.checked),
          }),
        )
        : null,
    );
    const favBtn = h('button', {
      class: 'btn btn-ghost btn-sm', title: '保存为常用',
      onclick: async () => {
        await api.updateWork(w.id, { favorite: !w.favorite });
        toast(w.favorite ? '已取消常用' : '已保存为常用', 'ok');
        load();
      },
    }, w.favorite ? '已收藏' : '收藏');
    return h('div', {
      class: `card card-hover work-card${selectMode ? ' pickable' : ''}${isSel ? ' selected' : ''}`,
      dataset: { workId: w.id },
    },
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
          // 多选模式下隐藏单条删除 (统一走批量删除的确认闸门), 避免误触
          selectMode ? null : h('button', {
            class: 'btn btn-danger-ghost btn-sm', title: '删除', 'aria-label': '删除作品',
            onclick: () => deleteOne(w),
          }, icon('trash', { size: 14 })),
        ),
      ),
    );
  }

  /** 单条删除: 二次确认弹窗 → 确认才删; 失败保留作品 */
  async function deleteOne(w) {
    const ok = await confirmDialog({
      title: '删除这件作品？',
      message: `「${w.title}」将被永久删除，删除后无法恢复。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteWork(w.id);
      selected.delete(w.id);
      toast('已删除', 'ok');
      await load();
    } catch (e) {
      toast(`删除失败：${e.message}`, 'err');
    }
  }

  /** 批量删除: 确认弹窗 → 一次提交; 部分失败只提示, 不清空未删成功的选择 */
  async function batchDelete() {
    const ids = [...selected];
    if (!ids.length) { toast('请先选择要删除的作品', 'err'); return; }
    const ok = await confirmDialog({
      title: `删除选中的 ${ids.length} 件作品？`,
      message: '这些作品将被永久删除，删除后无法恢复。',
      confirmText: `删除 ${ids.length} 件`,
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.deleteWorksBatch(ids);
      const missing = res?.missing ?? [];
      for (const id of ids) if (!missing.includes(id)) selected.delete(id);
      await load();
      if (missing.length) toast(`已删除 ${res.deleted} 件，${missing.length} 件已不存在`, 'err');
      else toast(`已删除 ${res.deleted} 件`, 'ok');
      drawPickBar();
    } catch (e) {
      toast(`批量删除失败：${e.message}`, 'err');
    }
  }

  drawFilters();
  drawPickBar();
  await load();
}
