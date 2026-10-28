import { h, toast, fileToDataURI } from '../ui.js';
import { api, getApiBase } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';

/**
 * 批量套图 (Stage 1 MVP · 设计文档《批量生图-竞品拆解与落地设计方案.md》)
 *
 * 三个视图:
 *   列表   /#/batch          项目卡片 + 新建入口
 *   作业单 /#/batch?new=1     表格录入 (行 = SKU), 预算预览, 创建后进详情
 *   矩阵   /#/batch/:id       行 = SKU × 列 = 7 镜头, 试跑/全量/单格重跑/锁定/导出 ZIP
 *
 * 完成定义按「SKU 套齐」显示进度 (rowsDone/rowsTotal), 不是按张数 —— 见设计文档 §5 交互原则。
 * 后端自包含模块 /api/batch (队列/幂等/L1质检/断点续跑), 前端只做展示与轮询。
 */

const STATUS_LABEL = {
  draft: '待运行', pilot: '试跑中', running: '运行中', done: '已完成',
};
const CELL_BUSY = new Set(['queued', 'running']);

/** 模特封面是本地路径 (/models/...), 上游要公网 URL → 先转存 (与 lookbook 同方案) */
const publicUrlCache = new Map();
async function ensurePublicUrl(localUrl) {
  if (!localUrl) return null;
  if (/^https?:\/\//.test(localUrl) || localUrl.startsWith('mock://')) return localUrl;
  if (publicUrlCache.has(localUrl)) return publicUrlCache.get(localUrl);
  try {
    const blob = await (await fetch(localUrl)).blob();
    const fd = new FormData();
    fd.append('file', blob, localUrl.split('/').pop() || 'model.jpg');
    const res = await fetch(`${getApiBase()}/api/uploads`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data?.error) throw new Error(data.error.message);
    if (data.url && !data.url.startsWith('mock://')) {
      publicUrlCache.set(localUrl, data.url);
      return data.url;
    }
    return null;
  } catch (e) {
    console.warn('[batch] 模特图转公网 URL 失败:', e);
    return null;
  }
}

export async function renderBatch(root, { navigate, query, params, back }) {
  root.replaceChildren();
  if (params.id) return renderMatrix(root, params.id, { navigate, back });
  if (query.get('new') === '1') return renderWorksheet(root, { navigate, back });
  return renderList(root, { navigate, back });
}

/* ==================== 列表 ==================== */

async function renderList(root, { navigate, back }) {
  root.append(h('div', { class: 'page-head' },
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => (back ? back() : navigate('/templates')) },
      icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#f5f3ff;color:#7c3aed' }, icon('layers', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '批量套图'),
      h('div', { class: 'ph-sub' }, '一行一个 SKU · 自动跑完 Shopify 7 镜头 · 按 SKU 打包交付'),
    ),
    h('button', { class: 'btn btn-primary', onclick: () => navigate('/batch?new=1') }, '+ 新建批量项目'),
  ));

  const wrap = h('div', { class: 'card panel' }, h('div', { class: 'hint' }, '加载项目中…'));
  root.append(wrap);
  try {
    const { items } = await api.listBatchProjects();
    if (!items.length) {
      wrap.replaceChildren(h('div', { class: 'empty-state' },
        h('p', {}, '还没有批量项目。新建一个作业单，把多个商品一次交齐 7 张上架素材。'),
        h('button', { class: 'btn btn-primary', onclick: () => navigate('/batch?new=1') }, '+ 新建批量项目'),
      ));
      return;
    }
    wrap.replaceChildren(...items.map((p) => h('div', { class: 'bp-row' },
      h('button', { class: 'bp-row-main', onclick: () => navigate(`/batch/${p.id}`) },
        h('b', {}, p.name),
        h('span', { class: `pill ${p.status === 'done' ? 'pill-ok' : p.status === 'draft' ? 'pill-line' : 'pill-warn'}` }, STATUS_LABEL[p.status] || p.status),
        h('span', { class: 'bp-meta' }, `${p.rows} SKU · 成图 ${p.doneCells}/${p.totalCells}${p.failedCells ? ` · 失败 ${p.failedCells}` : ''}`),
      ),
      h('button', {
        class: 'btn btn-ghost btn-sm', title: '删除项目',
        onclick: async () => {
          if (!confirm(`删除项目「${p.name}」? 已生成的图会保留在服务器, 但入口消失。`)) return;
          await api.deleteBatchProject(p.id);
          renderList(root, { navigate, back });
        },
      }, '删除'),
    )));
  } catch (e) {
    wrap.replaceChildren();
    renderApiError(wrap, e, { resource: '批量项目', onRetry: () => renderList(root, { navigate, back }) });
  }
}

/* ==================== 作业单 (创建) ==================== */

async function renderWorksheet(root, { navigate, back }) {
  const nameInput = h('input', { class: 'text-input', placeholder: '例: 秋季上新 · 第一批 20 SKU', value: '' });

  /** @type {{sku:string, productName:string, productDesc:string, images:{dataUri:string,url:string|null}[], model:object|null}[]} */
  const rows = [emptyRow(), emptyRow()];
  let models = [];

  function emptyRow() {
    return { sku: '', productName: '', productDesc: '', images: [], model: null };
  }

  const tableWrap = h('div', { class: 'ws-table' });
  const budgetBar = h('div', { class: 'ws-budget' });

  function drawTable() {
    tableWrap.replaceChildren(
      // 表头必须是独立元素: 连续文本节点会被 grid 合并成单个匿名项, 挤进第一列
      h('div', { class: 'ws-head' }, h('span', {}, 'SKU'), h('span', {}, '商品名'), h('span', {}, '商品描述 (喂提示词)'), h('span', {}, '产品原图 (正面[,背面])'), h('span', {}, '模特 (可选)'), h('span', {}, '')),
      ...rows.map((r, ri) => h('div', { class: 'ws-row' },
        h('input', { class: 'text-input', placeholder: 'TS-001', value: r.sku, oninput: (e) => { r.sku = e.target.value; drawBudget(); } }),
        h('input', { class: 'text-input', placeholder: '黑色印花T恤', value: r.productName, oninput: (e) => { r.productName = e.target.value; } }),
        h('input', { class: 'text-input', placeholder: '例: 重磅纯棉宽松落肩, 胸前星空印花', value: r.productDesc, oninput: (e) => { r.productDesc = e.target.value; } }),
        h('div', { class: 'ws-imgs' },
          ...r.images.map((im, ii) => h('span', { class: 'ws-thumb', title: `${im.name || ''} · 点击移除` },
            h('img', { src: im.dataUri, alt: '' }),
            h('button', { class: 'rm', onclick: () => { r.images.splice(ii, 1); drawTable(); } }, '✕'),
          )),
          r.images.length < 2 ? h('label', { class: 'ws-add' }, '+',
            h('input', {
              type: 'file', accept: 'image/*', style: 'display:none',
              onchange: async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const dataUri = await fileToDataURI(f);
                try {
                  const res = await api.upload(f);
                  r.images.push({ dataUri, url: res.url, name: f.name });
                  drawTable();
                } catch (err) { toast(`上传失败: ${err.message}`, 'err'); }
              },
            }),
          ) : null,
        ),
        h('select', {
          class: 'text-input ws-model',
          onchange: (e) => { r.model = models.find((m) => m.id === e.target.value) || null; },
        }, h('option', { value: '', selected: !r.model }, 'AI 自动建模'),
          ...models.map((m) => h('option', { value: m.id, selected: r.model?.id === m.id }, m.name))),
        rows.length > 1 ? h('button', { class: 'btn btn-ghost btn-sm ws-del', onclick: () => { rows.splice(ri, 1); drawTable(); } }, '删行') : h('span'),
      )),
      h('div', { class: 'ws-foot' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { rows.push(emptyRow()); drawTable(); } }, '+ 添加 SKU 行'),
      ),
    );
  }

  function drawBudget() {
    const n = rows.filter((r) => r.sku || r.productName).length || rows.length;
    budgetBar.replaceChildren(
      h('span', {}, `预计: ${n} SKU × 7 镜头 = ${n * 7} 张 · ${n * 7 * 2} 额度 (2/张)`),
      h('span', { class: 'd' }, '建议先「试跑 1 套」确认效果, 再全量'),
    );
  }

  const createBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: create }, '创建项目');

  async function create() {
    const clean = rows.filter((r) => r.sku || r.productName);
    if (!clean.length) { toast('至少填一行 SKU', 'err'); return; }
    for (const r of clean) {
      if (!r.images.length) { toast(`「${r.sku || r.productName}」缺产品原图 —— 每个 SKU 至少 1 张正面图`, 'err'); return; }
    }
    createBtn.disabled = true;
    createBtn.textContent = '创建中…';
    try {
      const payload = {
        name: nameInput.value.trim() || '批量套图',
        rows: [],
      };
      for (const r of clean) {
        const row = {
          sku: r.sku.trim(), productName: r.productName.trim(), productDesc: r.productDesc.trim(),
          images: r.images.map((im) => im.url).filter(Boolean),
        };
        if (r.model) {
          row.modelId = r.model.id;
          row.modelName = r.model.name;
          row.modelCover = r.model.cover || null;
          row.modelPublicUrl = await ensurePublicUrl(r.model.cover);
        }
        payload.rows.push(row);
      }
      const p = await api.createBatchProject(payload);
      navigate(`/batch/${p.id}`);
    } catch (e) {
      toast(`创建失败: ${e.message}`, 'err');
      createBtn.disabled = false;
      createBtn.textContent = '创建项目';
    }
  }

  root.append(h('div', { class: 'page-head' },
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => (back ? back() : navigate('/batch')) },
      icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-title' },
      h('h1', {}, '新建批量项目 · 作业单'),
      h('div', { class: 'ph-sub' }, '行 = SKU。每个 SKU 有自己的原图与描述, 系统按 7 个镜头逐格生成'),
    ),
  ));

  const panel = h('div', { class: 'card panel' },
    h('h3', {}, '项目名'), nameInput,
    h('h3', { style: 'margin-top:16px' }, '作业单'),
    tableWrap, budgetBar,
    h('div', { style: 'margin-top:14px;display:flex;gap:10px' }, createBtn,
      h('button', { class: 'btn btn-ghost', onclick: () => navigate('/batch') }, '取消')),
  );
  root.append(panel);
  drawTable();
  drawBudget();

  try {
    const { system, user } = await api.listModels();
    models = [...system, ...(user ?? [])];
    drawTable();
  } catch { /* 模特库不可用不阻塞建单: 全部走 AI 自动建模 */ }
}

/* ==================== 矩阵 (详情/执行/交付) ==================== */

async function renderMatrix(root, id, { navigate, back }) {
  let project = null;
  let pollTimer = null;
  let stopped = false;

  const head = h('div', { class: 'page-head' });
  const body = h('div', {});
  root.append(head, body);

  // 离开页面必须停轮询 (防泄漏)
  const cleanup = () => { stopped = true; clearTimeout(pollTimer); };
  const prevNavigate = navigate;

  async function load() {
    try {
      project = await api.getBatchProject(id);
    } catch (e) {
      body.replaceChildren();
      renderApiError(body, e, { resource: '批量项目', onRetry: () => load(), backTo: { label: '回列表', href: '#/batch', onClick: () => navigate('/batch') } });
      return;
    }
    drawHead();
    drawMatrix();
    const busy = project.status === 'running' || project.status === 'pilot'
      || Object.values(project.detail.cells).some((c) => CELL_BUSY.has(c.status));
    clearTimeout(pollTimer);
    if (busy && !stopped) pollTimer = setTimeout(load, 3000);
  }

  function drawHead() {
    const p = project;
    head.replaceChildren(
      h('div', { class: 'ph-line' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { cleanup(); navigate('/batch'); } },
          icon('arrow-left', { size: 15 }), '批量项目'),
        h('div', { class: 'ph-title' },
          h('h1', {}, p.name),
          h('div', { class: 'ph-sub' }, `${p.recipe.name} · ${p.rowsTotal} SKU × 7 镜头`),
        ),
        h('span', { class: `pill ${p.status === 'done' ? 'pill-ok' : p.status === 'draft' ? 'pill-line' : 'pill-warn'}` }, STATUS_LABEL[p.status] || p.status),
      ),
      h('div', { class: 'mx-progress' },
        h('div', { class: 'mx-prog-main' },
          h('span', { class: 'lbl' }, `SKU 齐套 ${p.rowsDone}/${p.rowsTotal}`),
          h('div', { class: 'bar' }, h('i', { style: `width:${p.totalCells ? Math.round((p.doneCells / p.totalCells) * 100) : 0}%` })),
          h('span', { class: 'lbl' }, `成图 ${p.doneCells}/${p.totalCells}${p.failedCells ? ` · 失败 ${p.failedCells}` : ''}`),
        ),
        h('div', { class: 'mx-actions' },
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => act(() => api.batchPilot(p.id, p.detail.rows[0]?.id), '试跑已启动 (第 1 个 SKU)') }, '▶ 试跑 1 套'),
          h('button', { class: 'btn btn-primary btn-sm', onclick: () => act(() => api.batchRun(p.id), '全量已入队') }, '开始全量'),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { location.href = api.batchExportUrl(p.id); } }, '导出 ZIP'),
        ),
      ),
    );
  }

  async function act(fn, okMsg) {
    try {
      await fn();
      toast(okMsg, 'ok');
      load();
    } catch (e) { toast(e.message, 'err'); }
  }

  function drawMatrix() {
    const p = project;
    const steps = p.recipe.steps;
    const cellBtn = (row, s) => {
      const c = p.detail.cells[`${row.id}|${s.id}`];
      const cls = ['mx-cell', `st-${c.status}`];
      if (c.locked) cls.push('locked');
      const inner = c.url
        ? h('img', { src: c.url, alt: `${row.sku} ${s.name}`, loading: 'lazy' })
        : c.status === 'running' || c.status === 'queued'
          ? h('span', { class: 'mx-spin' })
          : c.status === 'failed' || c.status === 'rejected_by_qa'
            ? h('span', { class: 'mx-fail', title: c.error || '失败' }, '!')
            : null;
      return h('button', {
        class: cls.join(' '), type: 'button',
        title: `${row.sku} · ${s.name} · ${c.status}${c.error ? ` (${c.error})` : ''}`,
        onclick: () => (c.url ? openCellLightbox(c, row, s) : (c.status === 'failed' || c.status === 'rejected_by_qa') ? rerun(row.id, s.id) : null),
      },
        inner,
        c.locked ? h('span', { class: 'mx-lock', title: '已锁定: 重跑不会覆盖' }, '🔒') : null,
        c.url ? h('span', { class: 'mx-cell-acts' },
          h('span', { class: 'act', title: '重跑此格', onclick: (e) => { e.stopPropagation(); rerun(row.id, s.id); } }, '↻'),
          h('span', { class: 'act', title: c.locked ? '解锁' : '锁定', onclick: (e) => { e.stopPropagation(); toggleLock(row.id, s.id, !c.locked); } }, c.locked ? '解锁' : '锁定'),
        ) : null,
      );
    };
    async function rerun(rowId, stepId) {
      await act(() => api.batchRerunCell(p.id, rowId, stepId), '已重跑该格');
    }
    async function toggleLock(rowId, stepId, locked) {
      await act(() => api.batchLockCell(p.id, rowId, stepId, locked), locked ? '已锁定' : '已解锁');
    }
    body.replaceChildren(
      h('div', { class: 'card panel mx-panel' },
        h('div', { class: 'mx-scroll' },
          h('table', { class: 'mx-table' },
            h('thead', {}, h('tr', {}, h('th', { class: 'mx-sku-th' }, 'SKU'),
              ...steps.map((s) => h('th', { title: s.desc }, s.id, ' ', s.name)))),
            h('tbody', {},
              ...p.detail.rows.map((row) => h('tr', {},
                h('td', { class: 'mx-sku' },
                  h('b', {}, row.sku),
                  h('div', { class: 'nm' }, row.productName || ''),
                  row.modelName ? h('div', { class: 'md' }, `模特: ${row.modelName}`) : null,
                  h('button', {
                    class: 'btn btn-ghost btn-sm', style: 'margin-top:4px',
                    onclick: () => { if (confirm(`重跑「${row.sku}」整行 7 格? (锁定格除外)`)) act(() => api.batchRerunRow(p.id, row.id), '整行已重跑'); },
                  }, '整行重跑'),
                ),
                ...steps.map((s) => h('td', {}, cellBtn(row, s))),
              ))),
          ),
        ),
      ),
    );
  }

  function openCellLightbox(c, row, s) {
    let box = document.getElementById('batch-lightbox');
    if (!box) {
      box = h('div', { id: 'batch-lightbox', class: 'lightbox', role: 'dialog', 'aria-modal': 'true', onclick: () => box.classList.remove('open') },
        h('div', { class: 'lb-inner', onclick: (e) => e.stopPropagation() },
          h('img', { class: 'lb-img', alt: '' }),
          h('div', { class: 'lb-cap' }),
          h('button', { class: 'lb-close', type: 'button', 'aria-label': '关闭大图', onclick: () => box.classList.remove('open') }, '✕'),
        ));
      document.body.append(box);
    }
    box.querySelector('.lb-img').src = c.url;
    box.querySelector('.lb-cap').textContent = `${row.sku} · ${s.name} · ${c.fileName || ''}${c.qa?.checked ? (c.qa.fail ? ' · 质检未过' : ' · 质检通过') : ''}`;
    box.classList.add('open');
  }

  await load();

  // 路由切走时清理轮询: 下一次 render 会重建 DOM, 用 MutationObserver 过重; 用简单方案 ——
  // 页面容器被替换 (root 不再在文档中) 时停止
  const iv = setInterval(() => { if (!document.contains(root)) { cleanup(); clearInterval(iv); } }, 1000);
  return prevNavigate;
}
