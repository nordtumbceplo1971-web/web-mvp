import { h, toast, fileToDataURI, isMockUrl, pollTask } from '../ui.js';
import { renderApiError } from '../errors.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { icon } from '../icons.js';
import { getUserId } from '../userId.js';
import { openAddModelDialog } from './modelAddDialog.js';

/**
 * Shopify 套图创作流 (7 步)
 *
 * 每步自动匹配素材 (按流程图):
 *   产品图 → 01/02/04/05
 *   主模特 → 01/02/03/07
 *   第二模特 → 06/07
 *   04/05 纯产品特写, 不需要模特
 *
 * 模特规则:
 *   选 2 个模特 → 全程用库里的模特 (形象一致)
 *   选 1 个模特 → 06 步 AI 自动生成第二模特
 *   不选模特   → 全程 AI 自动建模
 */
export async function renderLookbook(root, { navigate, back }) {
  root.replaceChildren();
  const goBack = back ?? (() => navigate('/templates'));
  const userId = getUserId();

  const state = {
    productImages: [],
    model1: null,          // {id, name, desc, cover}
    model2: null,          // {id, name, desc, cover} 或 null (AI生成)
    inspiration: '',
    results: {},
    generating: false,
  };

  // ---------- 顶部 ----------
  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => goBack(),
      'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#eff6ff;color:#2563eb' }, icon('layers', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, 'Shopify 套图'),
      h('div', { class: 'ph-sub' }, '7 步出全套商品图 · 每步自动匹配素材 · 支持双模特'),
    ),
    h('span', { class: 'pill pill-line' }, '多步骤'),
  );

  // ---------- 步骤条 ----------
  const steps = [['1', '上传素材'], ['2', '选择模特'], ['3', '生成套图']];
  const stepEls = steps.map(([n, label]) => h('div', { class: 'step' }, h('span', { class: 'dot' }, n), label));
  const stepper = h('div', { class: 'stepper' },
    stepEls.flatMap((el, i) => i === 0 ? [el] : [h('span', { class: 'step-arrow' }, '→'), el]),
  );

  function refreshStepper() {
    const hasProduct = state.productImages.length > 0;
    stepEls.forEach((el, i) => {
      const done = i === 0 ? hasProduct : false;
      el.classList.toggle('done', done);
      el.classList.toggle('now', !done && (i === 0 || (i === 1 && hasProduct)));
      el.querySelector('.dot').textContent = done ? '✓' : String(i + 1);
    });
  }

  // ================================================================
  // Step1: 上传产品图
  // ================================================================
  const thumbsWrap = h('div', { class: 'upload-thumbs' });
  const fileInput = h('input', {
    type: 'file', accept: 'image/*', multiple: true, style: 'display:none',
    onchange: (e) => { addFiles(e.target.files); fileInput.value = ''; },
  });
  const uploader = h('div', {
    class: 'uploader',
    onclick: () => fileInput.click(),
    ondragover: (e) => { e.preventDefault(); uploader.classList.add('dragover'); },
    ondragleave: () => uploader.classList.remove('dragover'),
    ondrop: (e) => { e.preventDefault(); uploader.classList.remove('dragover'); addFiles(e.dataTransfer.files); },
  },
    h('div', { class: 'up-ico' }, icon('upload', { size: 20 })),
    h('div', { class: 't' }, '把产品图拖到这里'),
    h('div', { class: 'd' }, '上传产品正面图和/或背面图 · 最多 2 张'),
  );

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, 2 - state.productImages.length);
    for (const file of files) {
      const dataUri = await fileToDataURI(file);
      const item = { dataUri, url: null, name: file.name, label: state.productImages.length === 0 ? '正面' : '背面' };
      state.productImages.push(item);
      drawThumbs();
      try {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/uploads', { method: 'POST', body: fd });
        const data = await res.json();
        if (data?.error) throw new Error(data.error.message);
        item.url = data.url;
      } catch (e) {
        toast(`上传失败: ${e.message}`, 'err');
        state.productImages = state.productImages.filter((x) => x !== item);
        drawThumbs();
      }
    }
    refreshStepper();
    refreshGenerate();
  }

  function drawThumbs() {
    const items = state.productImages.map((img, i) => h('div', { class: 'thumb' },
      h('img', { src: img.dataUri, alt: img.name }),
      h('span', { class: 'thumb-label' }, img.label),
      h('button', {
        class: 'rm', title: '移除',
        onclick: () => { state.productImages.splice(i, 1); drawThumbs(); refreshStepper(); refreshGenerate(); },
      }, '✕'),
    ));
    if (state.productImages.length < 2) {
      items.push(h('div', { class: 'thumb add-more', onclick: () => fileInput.click() }, '+'));
    }
    thumbsWrap.replaceChildren(...items);
    uploader.style.display = state.productImages.length >= 2 ? 'none' : '';
  }

  // ================================================================
  // Step2: 选择模特 (双模特模式)
  // ================================================================
  const modelSlot1 = h('div', { class: 'model-slot' });
  const modelSlot2 = h('div', { class: 'model-slot' });
  const modelPickerRow = h('div', { class: 'model-picker-row' }, h('div', { class: 'home-loading', style: 'padding:12px' }, '加载模特库…'));

  const modelSection = h('div', { class: 'model-section' },
    h('div', { class: 'model-section-head' },
      h('h4', {}, icon('user', { size: 15 }), '模特库'),
      h('span', { class: 'desc', style: 'font-size:12px' }, '选 2 个模特全程用库 · 选 1 个则 06 步 AI 自动补第二模特'),
    ),
    h('div', { class: 'model-slots' }, modelSlot1, modelSlot2),
    modelPickerRow,
  );

  let pickerTarget = 'model1'; // 当前点选目标槽位

  function drawSlots() {
    const slotEl = (slot, label, model) => h('div', { class: `model-slot ${model ? 'filled' : 'empty'} ${pickerTarget === slot ? 'picking' : ''}` },
      h('div', { class: 'ms-label' }, label),
      model
        ? h('div', { class: 'ms-preview' },
          h('img', { src: model.cover, alt: model.name }),
          h('div', { class: 'ms-info' },
            h('div', { class: 'ms-name' }, model.name),
            h('button', {
              class: 'btn btn-ghost btn-sm', style: 'font-size:11px;padding:2px 6px',
              onclick: () => {
                if (slot === 'model1') state.model1 = null; else state.model2 = null;
                drawSlots(); refreshGenerate();
              },
            }, '移除'),
          ),
        )
        : h('div', {
          class: 'ms-empty', onclick: () => { pickerTarget = slot; drawSlots(); },
        }, icon('plus', { size: 18 }), slot === 'model1' ? '选择主模特' : '选择第二模特 (可选)'),
    );
    modelSlot1.replaceChildren(...[slotEl('model1', '主模特 (01/02/03/07)', state.model1)]);
    modelSlot2.replaceChildren(...[slotEl('model2', '第二模特 (06/07)', state.model2)]);
  }

  // 加载模特库 (新增模特后可重新加载)
  async function loadModelLibrary() {
    try {
      const data = await (await fetch(`/api/models?userId=${encodeURIComponent(userId)}`)).json();
      const all = [...(data.system ?? []), ...(data.user ?? [])];
      if (!all.length) {
        modelPickerRow.replaceChildren(h('div', { class: 'empty-state', style: 'padding:16px;font-size:13px' }, '暂无可用模特'));
        return;
      }
      modelPickerRow.replaceChildren(
        ...all.map((m) => h('button', {
          class: 'model-pick-item', type: 'button',
          onclick: () => {
            const model = { id: m.id, name: m.name, desc: m.desc, cover: m.cover };
            if (pickerTarget === 'model1') {
              state.model1 = model;
              pickerTarget = 'model2';
            } else {
              state.model2 = model;
              pickerTarget = 'model1';
            }
            drawSlots(); refreshGenerate();
          },
        },
          h('div', { class: 'mpi-cover' }, h('img', { src: m.cover, alt: m.name, loading: 'lazy' })),
          h('span', { class: 'mpi-name' }, m.name),
        )),
        // 末尾 "+" 卡片: 自己上传 或 用想法让 AI 生成模特
        h('button', {
          class: 'model-pick-item add-card', type: 'button',
          title: '上传模特图片, 或用想法让 AI 生成一个模特',
          onclick: () => openAddModelDialog({
            onDone: (model) => {
              const m = { id: model.id, name: model.name, desc: model.desc, cover: model.cover };
              if (pickerTarget === 'model1') {
                state.model1 = m;
                pickerTarget = 'model2';
              } else {
                state.model2 = m;
                pickerTarget = 'model1';
              }
              drawSlots(); refreshGenerate();
              loadModelLibrary();
            },
          }),
        },
          h('div', { class: 'mpi-cover add-cover' }, icon('plus', { size: 22 })),
          h('span', { class: 'mpi-name' }, '添加模特'),
        ),
      );
    } catch {
      modelPickerRow.replaceChildren(h('div', { class: 'empty-state', style: 'padding:16px;font-size:13px' }, '模特库加载失败'));
    }
  }
  loadModelLibrary();

  // 灵感 prompt (仅无模特或需要 AI 补模特时)
  const inspirationWrap = h('div', { class: 'inspiration-wrap', style: 'margin-top:12px;display:none' });
  function drawInspiration() {
    const needInspiration = !state.model1 || !state.model2;
    inspirationWrap.style.display = needInspiration ? '' : 'none';
    if (needInspiration && !inspirationWrap.children.length) {
      const input = h('textarea', {
        class: 'text-input', rows: 2,
        placeholder: '描述 AI 自动生成的模特形象 (选填), 例: 25岁欧美男性, 高挑健硕, 短发',
        oninput: () => { state.inspiration = input.value; },
      });
      input.value = state.inspiration;
      inspirationWrap.replaceChildren(
        h('div', { class: 'g-label', style: 'margin-bottom:4px;font-size:12px' }, 'AI 模特灵感描述 (选填)'),
        input,
      );
    }
  }

  // 素材分配预览 (展示每步用什么素材)
  const assetMap = h('div', { class: 'asset-map' });
  function drawAssetMap() {
    const p1 = state.productImages[0] ? '✓' : '—';
    const p2 = state.productImages[1] ? '✓' : '—';
    const m1 = state.model1 ? '✓' : '—';
    const m2 = state.model2 ? '✓' : (state.model1 ? 'AI' : '—');
    assetMap.replaceChildren(
      h('div', { class: 'am-title' }, '素材分配预览 (含节点依赖)'),
      h('div', { class: 'am-grid' },
        ...[['01', '列表主图', `产品正面${p1} + 主模特${m1} · 独立`],
        ['02', '背面展示', `产品背面${p2} + 节点01图 · 依赖01`],
        ['03', '完整穿搭', `产品正面${p1} + 节点01图 · 依赖01`],
        ['04', '印花细节', `产品正面${p1} · 独立`],
        ['05', '面料做工', `产品正面${p1} · 独立`],
        ['06', '另一位模特', `产品正面${p1} + ${state.model2 ? '模特2✓' : 'AI生成模特'} · 独立`],
        ['07', '品牌生活方式', `产品${p1} + 节点01/03图 + 节点06图`],
        ].map(([id, name, assets]) => h('div', { class: 'am-item' },
          h('span', { class: 'am-id' }, id),
          h('span', { class: 'am-name' }, name),
          h('span', { class: 'am-assets' }, assets),
        )),
      ),
    );
  }

  const productPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '1'), '上传素材 & 选择模特'),
    h('div', { class: 'hint' }, '上传产品图, 选择 1-2 位模特, 系统自动为每步匹配素材'),
    uploader, fileInput, thumbsWrap,
    modelSection,
    inspirationWrap,
    assetMap,
  );

  // ================================================================
  // Step3: 生成 (侧栏 = 流程进度)
  // ================================================================
  const genControls = h('div', { class: 'gen-controls' });
  const resultsZone = h('div', { class: 'lookbook-results' });
  const genPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '2'), '生成套图'),
    genControls,
    resultsZone,
  );

  // 流程进度侧栏
  const progressList = h('div', { class: 'progress-steps' });
  const STEPS = [
    { id: '01', name: '列表主图', desc: '单人正面模特图' },
    { id: '02', name: '背面展示', desc: '同一模特背面图' },
    { id: '03', name: '完整穿搭', desc: '全身/四分之三侧身' },
    { id: '04', name: '印花细节', desc: '核心图案近景' },
    { id: '05', name: '面料与做工', desc: '布料/领口/肩线特写' },
    { id: '06', name: '另一位模特', desc: '换性别/身形穿搭' },
    { id: '07', name: '品牌生活方式', desc: '场景故事图' },
  ];

  function drawProgress() {
    progressList.replaceChildren(...STEPS.map((s, i) => {
      const r = state.results[s.id];
      const status = r?.status ?? 'pending';
      return h('div', { class: `progress-step ${status}` },
        h('div', { class: 'ps-track' },
          h('div', { class: 'ps-dot' }, status === 'completed' ? '✓' : status === 'generating' ? '' : status === 'failed' ? '✕' : s.id),
          i < STEPS.length - 1 ? h('div', { class: 'ps-line' }) : null,
        ),
        h('div', { class: 'ps-body' },
          h('div', { class: 'ps-name' }, s.name),
          h('div', { class: 'ps-status' }, status === 'completed' ? '已完成' : status === 'generating' ? '生成中…' : status === 'failed' ? (r?.error?.substring(0, 20) || '失败') : '待生成'),
        ),
        r?.url ? h('div', { class: 'ps-thumb' }, h('img', { src: r.url })) : null,
      );
    }));
  }

  const progressPanel = h('div', { class: 'card panel progress-panel' },
    h('h3', {}, icon('layers', { size: 16 }), ' 流程进度'),
    h('div', { class: 'hint', id: 'progress-summary' }, '点击「一键生成」开始'),
    progressList,
  );

  function updateProgressSummary() {
    const done = Object.values(state.results).filter((r) => r.status === 'completed').length;
    const failed = Object.values(state.results).filter((r) => r.status === 'failed').length;
    const running = Object.values(state.results).some((r) => r.status === 'generating');
    const el = progressPanel.querySelector('#progress-summary');
    if (!el) return;
    if (running) el.textContent = `生成中… 已完成 ${done}/7`;
    else if (done === 7) el.textContent = '全部完成 ✅';
    else if (failed > 0) el.textContent = `完成 ${done}/7 · 失败 ${failed} (可单独重试)`;
    else if (done > 0) el.textContent = `完成 ${done}/7`;
    else el.textContent = '点击「一键生成」开始';
  }

  // 打包下载 ZIP (已完成的结果)
  async function downloadZip() {
    const items = STEPS
      .filter((s) => state.results[s.id]?.url)
      .map((s) => ({ name: `${s.id}-${s.name}`, url: state.results[s.id].url }));
    if (!items.length) { toast('暂无已完成的图', 'err'); return; }
    toast(`正在打包 ${items.length} 张…`);
    try {
      const res = await fetch('/api/works/export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Shopify套图-${new Date().toISOString().slice(0, 10)}`,
          items,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = `Shopify套图-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      toast(`已下载 ${items.length} 张的 ZIP`, 'ok');
    } catch (e) {
      toast(`打包失败: ${e.message}`, 'err');
    }
  }

  function refreshGenerate() {
    const canGen = state.productImages.length > 0 && !state.generating;
    const doneCount = STEPS.filter((s) => state.results[s.id]?.url).length;
    genControls.replaceChildren(
      h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
        h('button', {
          class: 'btn btn-primary btn-lg', disabled: !canGen,
          onclick: generateAll,
        }, icon('sparkles', { size: 16 }), state.generating ? '生成中…' : '一键生成 7 步'),
        h('button', {
          class: 'btn btn-ghost-green btn-lg', disabled: !doneCount || state.generating,
          onclick: downloadZip,
          title: '把已完成的套图打包成 ZIP 下载',
        }, icon('download', { size: 16 }), `打包下载 ZIP${doneCount ? ` (${doneCount})` : ''}`),
        h('span', { style: 'color:var(--ink-3);font-size:13px' }, `每步 2 额度 · 余额 ${getCredits()} · live 模式每步约 30-60 秒`),
      ),
    );
    drawAssetMap();
    drawInspiration();
  }

  function drawResults() {
    drawProgress();
    updateProgressSummary();
    resultsZone.replaceChildren(
      h('div', { class: 'lookbook-grid' },
        ...STEPS.map((s) => {
          const r = state.results[s.id];
          return h('div', { class: `lookbook-step ${r?.status === 'completed' ? 'done' : r?.status === 'generating' ? 'running' : ''}` },
            h('div', { class: 'lb-step-head' },
              h('span', { class: 'lb-step-no' }, s.id),
              h('div', {},
                h('div', { class: 'lb-step-name' }, s.name),
                h('div', { class: 'lb-step-desc' }, s.desc),
              ),
            ),
            r?.url
              ? h('div', { class: 'lb-result' }, h('img', { src: r.url, alt: s.name }))
              : r?.status === 'generating'
                ? h('div', { class: 'lb-placeholder generating' }, h('div', { class: 'spinner' }), '生成中…')
                : r?.status === 'failed'
                  ? h('div', { class: 'lb-placeholder failed' }, icon('info', { size: 20 }), h('span', { style: 'font-size:11px;padding:0 8px;text-align:center' }, r.error?.substring(0, 40) || '失败'), h('button', { class: 'btn btn-ghost btn-sm', onclick: () => retryStep(s.id) }, '重试'))
                  : h('div', { class: 'lb-placeholder' }, h('span', { class: 'lb-wait' }, '待生成')),
          );
        }),
      ),
    );
  }

  // ---------- 素材分配 (按流程依赖图) ----------
  // 01: 产品正面 + 主模特(选了才有)          → 无依赖
  // 02: 产品背面 + 节点01结果(同景同光仅转身) → 依赖 01
  // 03: 产品正面 + 节点01结果                → 依赖 01
  // 04: 仅产品图 (独立)
  // 05: 仅产品图 (独立)
  // 06: 产品图 + 模特2(没有则AI生成)          → 独立
  // 07: 产品图 + 节点01/03结果 + 节点06结果   → 依赖 (01|03) + 06
  //
  // 模特图是本地路径 (/models/system/xxx.jpg), 上游要求稳定 http(s) URL
  // → 生成前自动上传获取公网 URL, 并缓存
  const uploadedModelUrls = new Map();

  async function ensurePublicUrl(localUrl) {
    if (!localUrl) return null;
    // 已是完整 http(s) URL 或 mock://  直接用
    if (/^https?:\/\//.test(localUrl) || localUrl.startsWith('mock://')) return localUrl;
    // 已上传过, 用缓存
    if (uploadedModelUrls.has(localUrl)) return uploadedModelUrls.get(localUrl);
    // 本地路径 → fetch 为 blob → 上传获取公网 URL
    try {
      const resp = await fetch(localUrl);
      const blob = await resp.blob();
      const fd = new FormData();
      fd.append('file', blob, localUrl.split('/').pop() || 'model.jpg');
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.error) throw new Error(data.error.message);
      const publicUrl = data.url;
      if (publicUrl && !publicUrl.startsWith('mock://')) {
        uploadedModelUrls.set(localUrl, publicUrl);
        return publicUrl;
      }
      return null; // mock 模式返回 mock://, 不能用于上游
    } catch (e) {
      console.warn('模特图上传失败:', e);
      return null;
    }
  }

  /** 各步骤依赖 (前置节点) */
  const STEP_DEPS = {
    '01': [],
    '02': ['01'],
    '03': ['01'],
    '04': [],
    '05': [],
    '06': [],
    '07': ['01', '06'], // 01 或 03 的结果作为主模特身份; 这里以 01 为必要依赖, 03 完成后升级为更优输入
  };

  function getAssetsForStep(stepId) {
    const productUrls = state.productImages.map((im) => im.url).filter((u) => u && !isMockUrl(u));
    const front = productUrls[0];
    const back = productUrls[1] || productUrls[0];
    const r = state.results;
    // 主模特身份优先用 03 (全身) , 回退到 01; 没有就用主模特封面 (仅 01 自己用)
    const model1Result = r['03']?.url || r['01']?.url || state.model1?.cover;

    switch (stepId) {
      case '01': return { images: [front, state.model1?.cover].filter(Boolean) };
      case '02': return { images: [back, r['01']?.url].filter(Boolean) };
      case '03': return { images: [front, r['01']?.url].filter(Boolean) };
      case '04': return { images: front ? [front] : [] };
      case '05': return { images: front ? [front] : [] };
      case '06': return { images: [front, state.model2?.cover].filter(Boolean) };
      case '07': return { images: [front, model1Result, r['06']?.url].filter(Boolean) };
      default: return { images: productUrls };
    }
  }

  // 将本地素材路径转为公网 URL
  async function resolvePublicUrls(images) {
    const resolved = [];
    for (const url of images) {
      const publicUrl = await ensurePublicUrl(url);
      if (publicUrl) resolved.push(publicUrl);
    }
    return resolved;
  }

  /** 检查依赖是否就绪; 返回 null=可跑, 否则返回失败原因 */
  function checkDeps(stepId) {
    const unmet = [];
    for (const dep of STEP_DEPS[stepId] || []) {
      const st = state.results[dep]?.status;
      if (st === 'completed') continue;
      unmet.push(dep);
    }
    // 07 特例: 依赖写的是 01, 但 03 完成也可满足主模特身份
    if (stepId === '07' && unmet.includes('01') && state.results['03']?.status === 'completed') {
      unmet.splice(unmet.indexOf('01'), 1);
    }
    return unmet.length ? `依赖节点 ${unmet.join('/')} 未完成` : null;
  }

  // ---------- 生成 (分波并行, 按依赖图) ----------
  // 波次: [01,04,05,06] (独立并行) → [02,03] (依赖01) → [07] (依赖01|03 + 06)
  const EXEC_WAVES = [['01', '04', '05', '06'], ['02', '03'], ['07']];

  async function generateAll() {
    if (state.generating) return;
    if (getCredits() < 14) { toast('额度不足 (需 14 额度)', 'err'); return; }
    state.generating = true;
    refreshGenerate();

    const mode = state.model1 ? 'b' : 'a';

    for (const wave of EXEC_WAVES) {
      // 依赖未就绪的节点先标记失败原因 (如 01 失败则 02/03 无法跑)
      const runnable = [];
      for (const id of wave) {
        const s = STEPS.find((x) => x.id === id);
        if (state.results[id]?.status === 'completed') continue;
        const blocked = checkDeps(id);
        if (blocked) {
          if (!state.results[id]?.status || state.results[id]?.status === 'pending') {
            state.results[id] = { status: 'failed', error: blocked + ', 请先重试前置节点' };
            drawResults();
          }
          continue;
        }
        runnable.push(s);
      }
      await Promise.all(runnable.map((s) => generateStep(s, mode)));
    }

    state.generating = false;
    refreshGenerate();
    const completed = Object.values(state.results).filter((r) => r.status === 'completed').length;
    toast(`生成结束, 成功 ${completed}/7`, completed === 7 ? 'ok' : 'err');
  }

  async function generateStep(s, mode) {
    if (state.results[s.id]?.status === 'completed') return;
    const blocked = checkDeps(s.id);
    if (blocked) {
      state.results[s.id] = { status: 'failed', error: blocked };
      drawResults();
      return;
    }
    spendCredits(2, { label: `Shopify 套图 · ${s.name}`, model: 'gpt-image-2.5' });
    state.results[s.id] = { status: 'generating' };
    drawResults();

    try {
      // 获取提示词
      const promptRes = await fetch('/api/shopify/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, step: s.id,
          productDesc: 'T恤',
          inspiration: state.inspiration,
          modelDesc: state.model1?.desc,
          secondModelDesc: state.model2?.desc,
          productBackAvailable: state.productImages.length > 1,
        }),
      });
      const promptData = await promptRes.json();
      if (promptData?.error) throw new Error(promptData.error.message);

      // 匹配素材并转为公网 URL
      const { images } = getAssetsForStep(s.id);
      const publicUrls = await resolvePublicUrls(images);

      // 创建生成任务
      const genRes = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'shopify-lookbook',
          prompt: promptData.prompt,
          aspect_ratio: '4:5', resolution: '2K', quality: 'high', count: 1,
          imageUrls: publicUrls,
          title: `Shopify ${s.id} ${s.name}`,
        }),
      });
      const gen = await genRes.json();
      if (gen?.error) throw new Error(gen.error.message);

      // 轮询 (live 模式约 30-60 秒)
      await new Promise((resolve) => {
        pollTask(gen.taskId, (st) => {
          if (st.isFinal) {
            if (st.status === 'completed' && st.urls?.length) {
              state.results[s.id] = { status: 'completed', url: st.urls[0] };
            } else {
              refundCredits(2, { label: `退回 · Shopify 套图 ${s.name}` });
              state.results[s.id] = { status: 'failed', error: st.error || '生成失败' };
            }
            drawResults();
            resolve();
          }
        }, { intervalMs: 5000, maxErrors: 12 });
      });
    } catch (e) {
      refundCredits(2, { label: `退回 · Shopify 套图 ${s.name}` });
      state.results[s.id] = { status: 'failed', error: e.message };
      drawResults();
    }
  }

  async function retryStep(stepId) {
    const s = STEPS.find((x) => x.id === stepId);
    if (!s) return;
    const mode = state.model1 ? 'b' : 'a';
    await generateStep(s, mode);
  }

  // ---------- 组装 ----------
  refreshStepper();
  refreshGenerate();
  drawResults();
  drawThumbs();
  drawSlots();

  const sidebar = h('div', { class: 'lookbook-sidebar' }, progressPanel);
  const layout = h('div', { class: 'lookbook-layout' },
    h('div', { class: 'lookbook-main' }, productPanel, genPanel),
    sidebar,
  );
  root.append(header, stepper, layout);
}
