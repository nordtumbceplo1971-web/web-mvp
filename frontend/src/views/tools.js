import { h } from '../ui.js';
import { icon } from '../icons.js';
import { compressImage, compressToTarget, resizeImage, cropImage, fmtBytes, downloadBlob } from '../imgops.js';

/**
 * 图片工具 (路线图 1.4.3 · 设计方案《996Studio-图片工具箱-需求整理与设计方案.md》)
 *
 *   /#/tools           工具广场: 日常处理 (本地 Canvas) / AI 增强 (占位开发中)
 *   /#/tools/:toolId   单工具工作台: 拖拽上传 → 参数 → 本地处理 → 对比 → 下载
 *
 * v1 试水范围 (定稿): 压缩 / 改尺寸 / 裁剪 —— 全部本地处理, 文件不上传, 免费。
 * 裁剪: 单张图拖拽框选 (比例锁定); 多张图按所选比例自动中心裁剪。
 */

const TOOLS = [
  { id: 'compress', name: '图片压缩', desc: '按质量压缩体积, 输出 JPG', icon: 'download', tint: '#eff4ff', color: '#2563eb' },
  { id: 'resize', name: '改尺寸', desc: '平台主图预设 / 自定义宽高', icon: 'scan', tint: '#ecfdf5', color: '#15803d' },
  { id: 'crop', name: '裁剪', desc: '按比例裁剪, 支持批量中心裁', icon: 'scissors', tint: '#fff7ed', color: '#c2410c' },
];

const AI_SOON = [
  { name: '一键抠图', desc: '透明底 PNG' },
  { name: '变清晰放大', desc: '老素材超分' },
  { name: '消除/去水印', desc: '涂抹标记 AI 修复' },
];

const ASPECTS = ['free', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];
const SIZE_PRESETS = [
  { label: '主图 800×800', w: 800, h: 800 },
  { label: 'Amazon 2000×2000', w: 2000, h: 2000 },
  { label: '宽 1080 等比', w: 1080, h: null },
  { label: '小红书 1080×1440', w: 1080, h: 1440 },
  { label: '抖音 1080×1920', w: 1080, h: 1920 },
];

export async function renderTools(root, { navigate, back, params }) {
  root.replaceChildren();
  if (params?.id) return renderWorkbench(root, { navigate, back, toolId: params.id });
  renderPlaza(root, { navigate, back });
}

/* ==================== 工具广场 ==================== */

function renderPlaza(root, { navigate, back }) {
  root.append(h('div', { class: 'page-head' },
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => (back ? back() : navigate('/')) },
      icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#fff7ed;color:#c2410c' }, icon('wrench', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '图片工具'),
      h('div', { class: 'ph-sub' }, '一站式日常处理 —— 本地完成、文件不上传、永久免费'),
    ),
  ));

  root.append(h('div', { class: 'card panel' },
    h('div', { class: 'section-head', style: 'margin:0 0 12px' },
      h('h2', {}, '日常处理'), h('span', { class: 'pill pill-ok' }, '本地处理 · 免费')),
    h('div', { class: 'tool-grid' },
      ...TOOLS.map((t) => h('button', { class: 'tool-card', type: 'button', onclick: () => navigate(`/tools/${t.id}`) },
        h('span', { class: 'tool-ico', style: `background:${t.tint};color:${t.color}` }, icon(t.icon, { size: 22 })),
        h('b', {}, t.name),
        h('span', { class: 'd' }, t.desc),
        h('span', { class: 'go' }, '打开', icon('arrow-right', { size: 14 })),
      )),
    ),
  ));

  root.append(h('div', { class: 'card panel', style: 'margin-top:16px' },
    h('div', { class: 'section-head', style: 'margin:0 0 12px' },
      h('h2', {}, 'AI 增强'), h('span', { class: 'pill pill-line' }, '下一批上线')),
    h('div', { class: 'tool-grid' },
      ...AI_SOON.map((t) => h('div', { class: 'tool-card soon' },
        h('span', { class: 'tool-ico' }, icon('sparkles', { size: 22 })),
        h('b', {}, t.name),
        h('span', { class: 'd' }, t.desc),
        h('span', { class: 'soon-tag' }, '开发中'),
      )),
    ),
    h('div', { class: 'hint', style: 'margin-top:10px' }, '规划中还有: 格式转换、旋转/翻转、加水印、拼长图、压缩到指定大小 —— 见工具箱设计文档。'),
  ));
}

/* ==================== 工作台骨架 ==================== */

async function renderWorkbench(root, { navigate, back, toolId }) {
  const meta = TOOLS.find((t) => t.id === toolId);
  if (!meta) { navigate('/tools'); return; }

  const state = {
    files: [],        // { file, url, w, h, size }
    results: [],      // { blob, url, name, width, height, size, originSize }
    busy: false,
  };

  async function runOne(file) {
    if (toolId === 'compress') {
      if (state.compressMode === 'target') return compressToTarget(file, Math.max(10, Number(state.targetKB) || 100) * 1024);
      return compressImage(file, state.quality ?? 0.8);
    }
    if (toolId === 'resize') return resizeImage(file, state.getResize());
    return state.runOne(file);
  }

  const listWrap = h('div', { class: 'tw-list' });
  const resultsWrap = h('div', { class: 'tw-results' });
  const processBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'button', style: 'width:100%', onclick: process, disabled: true }, '请先选择图片');
  const allBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: downloadAll, style: 'display:none' }, '全部下载');

  async function process() {
    if (state.busy || !state.files.length) return;
    state.busy = true;
    processBtn.disabled = true;
    processBtn.textContent = '处理中…';
    resultsWrap.replaceChildren(h('div', { class: 'hint' }, '正在本地处理, 文件不会上传…'));
    try {
      const outs = [];
      for (const f of state.files) {
        const r = await runOne(f.file);
        outs.push({ ...r, url: URL.createObjectURL(r.blob), size: r.blob.size, originSize: f.size });
      }
      state.results = outs;
      drawResults();
    } catch (e) {
      resultsWrap.replaceChildren(h('div', { class: 'empty-state' }, h('p', {}, `处理失败: ${e.message}`)));
    }
    state.busy = false;
    processBtn.disabled = false;
  }

  function drawResults() {
    if (!state.results.length) { resultsWrap.replaceChildren(h('div', { class: 'canvas-empty' }, '处理结果会出现在这里')); allBtn.style.display = 'none'; return; }
    listWrap.replaceChildren(...state.results.map((r, i) => h('div', { class: 'tw-result' },
      h('img', { src: r.url, alt: r.name }),
      h('div', { class: 'info' },
        h('b', {}, r.name),
        h('span', {}, `${r.width}×${r.height} · ${fmtBytes(r.originSize)} → ${fmtBytes(r.size)}`),
      ),
      h('button', { class: 'icon-btn', type: 'button', title: '下载', onclick: () => downloadBlob(state.results[i].blob, r.name) }, icon('download', { size: 15 })),
    )));
    resultsWrap.replaceChildren(listWrap);
    allBtn.style.display = '';
  }

  function downloadAll() {
    state.results.forEach((r, i) => setTimeout(() => downloadBlob(r.blob, r.name), i * 350));
  }

  const filesWrap = h('div', { class: 'tw-files' });
  function drawFiles() {
    filesWrap.replaceChildren(
      ...state.files.map((f, i) => h('div', { class: 'tw-file' },
        h('img', { src: f.url, alt: f.file.name }),
        h('button', { class: 'rm', type: 'button', title: '移除', onclick: () => { URL.revokeObjectURL(f.url); state.files.splice(i, 1); drawFiles(); } }, '✕'),
        h('span', { class: 'meta' }, `${f.w}×${f.h} · ${fmtBytes(f.size)}`),
      )),
    );
    dropzone.style.display = state.files.length ? 'none' : '';
  }

  const dropzone = h('div', { class: 'tw-drop' },
    icon('upload', { size: 22 }),
    h('div', { class: 't' }, '把图片拖到这里, 支持多张批量'),
    h('div', { class: 'd' }, '或点击选择 · JPG / PNG / WebP'),
  );
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
  fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = ''; };
  dropzone.onclick = () => fileInput.click();
  dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
  dropzone.ondragleave = () => dropzone.classList.remove('dragover');
  dropzone.ondrop = (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); addFiles(e.dataTransfer.files); };

  async function addFiles(fileList) {
    for (const file of [...fileList].filter((f) => f.type.startsWith('image/'))) {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
      state.files.push({ file, url: URL.createObjectURL(file), w: bitmap.width, h: bitmap.height, size: file.size });
      bitmap.close?.();
    }
    drawFiles();
  }

  const paramPanel = toolId === 'compress' ? compressParams(state)
    : toolId === 'resize' ? resizeParams(state)
    : cropParams(state);

  root.append(h('div', { class: 'page-head' },
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => (back ? back() : navigate('/tools')) },
      icon('arrow-left', { size: 15 }), '工具'),
    h('div', { class: 'ph-icon', style: `background:${meta.tint};color:${meta.color}` }, icon(meta.icon, { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, meta.name),
      h('div', { class: 'ph-sub' }, meta.desc),
    ),
    h('span', { class: 'pill pill-ok' }, '本地处理 · 免费'),
  ));

  root.append(h('div', { class: 'tw-layout' },
    h('div', { class: 'card panel' },
      h('h3', {}, '1 · 选择图片'), dropzone, fileInput, filesWrap,
      h('h3', { style: 'margin-top:16px' }, '2 · 设置'), paramPanel,
      h('div', { style: 'margin-top:14px' }, processBtn),
    ),
    h('div', { class: 'card panel' },
      h('div', { class: 'section-head', style: 'margin:0 0 10px' },
        h('h3', { style: 'margin:0' }, '3 · 结果'),
        allBtn,
      ),
      resultsWrap,
      h('div', { class: 'hint', style: 'margin-top:10px' }, '🔒 本地处理 · 文件不上传服务器 · 不消耗额度'),
    ),
  ));

  resultsWrap.replaceChildren(h('div', { class: 'canvas-empty' }, '处理结果会出现在这里'));
  drawFiles();

  // 离开页面清理 objectURL; 按钮状态跟随文件数
  const iv = setInterval(() => {
    if (!document.contains(root)) {
      clearInterval(iv);
      [...state.files, ...state.results].forEach((x) => URL.revokeObjectURL(x.url));
      return;
    }
    processBtn.disabled = state.busy || !state.files.length;
    if (!state.busy) processBtn.textContent = state.files.length ? '开始处理' : '请先选择图片';
  }, 500);
}

/* ==================== 参数面板: 压缩 ==================== */

function compressParams(state) {
  state.compressMode = 'quality';
  state.quality = 0.8;
  state.targetKB = 500;

  const val = h('b', {}, '80');
  const slider = h('input', {
    type: 'range', min: '10', max: '100', value: '80', style: 'width:100%',
    oninput: () => { val.textContent = slider.value; state.quality = Number(slider.value) / 100; },
  });
  const qualityBlock = h('div', {},
    h('div', { class: 'g-label' }, '压缩质量 ', val, h('small', { style: 'color:var(--ink-3);font-weight:400;margin-left:4px' }, '越低体积越小')),
    slider,
    h('div', { class: 'hint', style: 'margin-top:6px' }, '80 为画质优先档, 肉眼与原图几乎一致; 输出 JPG (透明区填白)。'),
  );

  const kbInput = h('input', {
    class: 'text-input', type: 'number', min: '10', value: '500', style: 'width:110px',
    oninput: (e) => { state.targetKB = Number(e.target.value) || 500; },
  });
  const targetChips = h('div', { class: 'rf-chips' }, ...[['≤100 KB', 100], ['≤500 KB', 500], ['≤2 MB', 2048]].map(([label, kb]) => h('button', {
    class: 'spec-chip', type: 'button',
    onclick: (e) => {
      kbInput.value = kb;
      state.targetKB = kb;
      [...targetChips.children].forEach((c) => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
    },
  }, label)));
  const targetBlock = h('div', { style: 'display:none' },
    h('div', { class: 'g-label' }, '目标体积'),
    h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px' }, '不超过', kbInput, h('span', { style: 'color:var(--ink-3)' }, 'KB')),
    targetChips,
    h('div', { class: 'hint', style: 'margin-top:6px' }, '算法: 先在不降分辨率的前提下二分最高质量; 实在压不进才降采样 —— 保证达标前提下画质最大。'),
  );

  const modeChips = h('div', { class: 'rf-chips', style: 'margin-bottom:10px' },
    h('button', {
      class: 'spec-chip active', type: 'button',
      onclick: (e) => {
        state.compressMode = 'quality';
        qualityBlock.style.display = ''; targetBlock.style.display = 'none';
        [...modeChips.children].forEach((c) => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
      },
    }, '按质量'),
    h('button', {
      class: 'spec-chip', type: 'button',
      onclick: (e) => {
        state.compressMode = 'target';
        qualityBlock.style.display = 'none'; targetBlock.style.display = '';
        [...modeChips.children].forEach((c) => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
      },
    }, '按目标体积'),
  );

  return h('div', {}, modeChips, qualityBlock, targetBlock);
}

/* ==================== 参数面板: 改尺寸 ==================== */

function resizeParams(state) {
  const wInput = h('input', { class: 'text-input', type: 'number', min: '16', placeholder: '宽', style: 'width:100px' });
  const hInput = h('input', { class: 'text-input', type: 'number', min: '16', placeholder: '高', style: 'width:100px' });
  const chips = h('div', { class: 'rf-chips' }, ...SIZE_PRESETS.map((p) => h('button', {
    class: 'spec-chip', type: 'button',
    onclick: (e) => {
      wInput.value = p.w ?? '';
      hInput.value = p.h ?? '';
      [...chips.children].forEach((c) => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
    },
  }, p.label)));
  state.getResize = () => ({ width: Number(wInput.value) || null, height: Number(hInput.value) || null, mode: 'fit' });
  return h('div', {},
    h('div', { class: 'g-label' }, '平台预设'),
    chips,
    h('div', { class: 'g-label', style: 'margin-top:10px' }, '自定义 (只填一边 = 等比缩放)'),
    h('div', { style: 'display:flex;align-items:center;gap:8px' }, wInput, h('span', { style: 'color:var(--ink-3)' }, '×'), hInput, h('span', { style: 'color:var(--ink-3)' }, 'px')),
    h('div', { class: 'hint', style: 'margin-top:6px' }, '预设为白底 contain 居中 (平台主图规范); PNG/WebP 保留透明。'),
  );
}

/* ==================== 参数面板: 裁剪 ==================== */

function cropParams(state) {
  state.ratio = 'free';
  state.sel = null; // 显示图坐标 {x,y,w,h}; 仅单文件交互模式用

  const chips = h('div', { class: 'rf-chips' }, ...ASPECTS.map((a) => h('button', {
    class: `spec-chip${a === 'free' ? ' active' : ''}`, type: 'button',
    onclick: (e) => {
      state.ratio = a;
      [...chips.children].forEach((c) => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      stage.classList.toggle('locked', a !== 'free');
      maxCenter(); // 切比例即给出该比例的最大选区, 免二次框选
      drawSel();
    },
  }, a === 'free' ? '自由' : a)));

  const centerBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { maxCenter(); drawSel(); } }, '重置为最大居中选区');

  const stage = h('div', { class: 'crop-stage locked', style: 'display:none' });
  let img = null;

  const ratioNum = () => (state.ratio === 'free' ? null : state.ratio.split(':').map(Number).reduce((a, b) => a / b));
  const scaleNat = () => (img ? img.naturalWidth / img.clientWidth : 1);

  /* ---- 选区几何 ---- */
  function maxCenterRect() {
    const cw = img.clientWidth, ch = img.clientHeight, r = ratioNum();
    if (!r) return { x: 0, y: 0, w: cw, h: ch };
    if (cw / ch > r) { const h2 = ch; return { x: (cw - h2 * r) / 2, y: 0, w: h2 * r, h: h2 }; }
    const w2 = cw; return { x: 0, y: (ch - w2 / r) / 2, w: w2, h: w2 / r };
  }
  function maxCenter() {
    if (!img) return;
    state.sel = maxCenterRect();
  }
  // 从锚点(anchor)到指针(p)生成不越界的矩形; 锁定比例时以可用空间收放, 比例永不破坏
  function fitRect(ax, ay, px, py) {
    const cw = img.clientWidth, ch = img.clientHeight, r = ratioNum();
    const dirX = px >= ax ? 1 : -1, dirY = py >= ay ? 1 : -1;
    const availW = dirX > 0 ? cw - ax : ax;
    const availH = dirY > 0 ? ch - ay : ay;
    let w, h;
    if (r) {
      w = Math.max(24, Math.min(Math.abs(px - ax), availW, availH * r));
      h = w / r;
    } else {
      w = Math.max(24, Math.min(Math.abs(px - ax), availW));
      h = Math.max(24, Math.min(Math.abs(py - ay), availH));
    }
    return { x: dirX > 0 ? ax : ax - w, y: dirY > 0 ? ay : ay - h, w, h };
  }

  /* ---- 渲染 ---- */
  const HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  function drawSel() {
    let box = stage.querySelector('.crop-sel');
    if (!state.sel || !img) { box?.remove(); return; }
    if (!box) {
      box = h('div', { class: 'crop-sel' },
        h('i', { class: 'grid' }),
        ...HANDLES.map((d) => h('i', { class: `ch h-${d}`, 'data-h': d })),
      );
      stage.append(box);
    }
    const s = state.sel;
    box.style.left = `${s.x}px`;
    box.style.top = `${s.y}px`;
    box.style.width = `${s.w}px`;
    box.style.height = `${s.h}px`;
    // 尺寸标签 (原图坐标, clamp 防取整溢出)
    const k = scaleNat();
    let tag = box.querySelector('.size-tag');
    if (!tag) { tag = h('span', { class: 'size-tag' }); box.append(tag); }
    tag.textContent = `${Math.min(Math.round(s.w * k), img.naturalWidth - Math.round(s.x * k))}×${Math.min(Math.round(s.h * k), img.naturalHeight - Math.round(s.y * k))} px`;
  }

  /* ---- 指针交互: 角手柄缩放 / 框内移动 / 空白新建 (Pointer Events, 兼容触屏) ---- */
  stage.addEventListener('pointerdown', (e) => {
    if (!img || e.button !== 0) return;
    const rect = stage.getBoundingClientRect();
    const pt = () => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const handle = e.target.dataset?.h;
    const selEl = e.target.closest?.('.crop-sel');

    let mode, anchor, grabOffset;
    if (handle) {
      // 以对角为锚点缩放
      const s = state.sel;
      anchor = { x: handle.includes('w') ? s.x + s.w : s.x, y: handle.includes('n') ? s.y + s.h : s.y };
      mode = 'resize';
    } else if (selEl) {
      const p0 = pt();
      grabOffset = { x: p0.x - state.sel.x, y: p0.y - state.sel.y };
      mode = 'move';
    } else if (e.target === img) {
      anchor = pt();
      mode = 'new';
    } else return;
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      if (mode === 'move') {
        const cw = img.clientWidth, ch = img.clientHeight, s = state.sel;
        state.sel = {
          x: Math.max(0, Math.min(p.x - grabOffset.x, cw - s.w)),
          y: Math.max(0, Math.min(p.y - grabOffset.y, ch - s.h)),
          w: s.w, h: s.h,
        };
      } else {
        state.sel = fitRect(anchor.x, anchor.y, p.x, p.y);
      }
      drawSel();
    };
    const onUp = () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
  });

  function syncPreview() {
    const f = state.files[0];
    const want = state.files.length === 1 ? f.url : '';
    if (stage.dataset.src === want) return;
    stage.dataset.src = want;
    if (!want) { stage.style.display = 'none'; stage.replaceChildren(); img = null; state.sel = null; return; }
    stage.style.display = '';
    stage.replaceChildren(h('img', { src: want, alt: '' }));
    img = stage.querySelector('img');
    img.decode?.().catch(() => {}).finally(() => { maxCenter(); drawSel(); });
  }

  state.runOne = async (file) => {
    let sel;
    if (state.files.length === 1 && state.sel && img) {
      const k = scaleNat();
      const s = state.sel;
      const bitmapW = img.naturalWidth, bitmapH = img.naturalHeight;
      // 显示坐标 → 原图坐标, 并 clamp 进原图边界 (取整可能溢出 1~2px)
      const x = Math.max(0, Math.min(Math.round(s.x * k), bitmapW - 16));
      const y = Math.max(0, Math.min(Math.round(s.y * k), bitmapH - 16));
      sel = {
        x, y,
        w: Math.min(Math.round(s.w * k), bitmapW - x),
        h: Math.min(Math.round(s.h * k), bitmapH - y),
      };
    }
    // 有显式选区走坐标裁剪 (用户框的就是所见); 无选区按比例中心裁 (free = 原图直出)
    return cropImage(file, sel ? null : (state.ratio === 'free' ? null : state.ratio), sel);
  };

  // 单文件预览同步 (骨架 500ms 轮询之外, 低频自检即可)
  const iv = setInterval(() => {
    if (!document.contains(stage)) { clearInterval(iv); return; }
    syncPreview();
  }, 400);

  return h('div', {},
    h('div', { class: 'g-label' }, '比例'),
    chips,
    h('div', { style: 'margin-top:8px' }, centerBtn),
    stage,
    h('div', { class: 'hint', style: 'margin-top:8px' }, '框内拖动移位置 · 拖四角调大小 (锁定比例时) · 空白处拖出新选区; 多张图按所选比例自动中心裁剪。'),
  );
}
