import { h, toast, fileToDataURI, isMockUrl, pollTask } from '../ui.js';
import { renderApiError } from '../errors.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { icon } from '../icons.js';
import { getUserId } from './models.js';

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

  // 加载模特库
  fetch(`/api/models?userId=${encodeURIComponent(userId)}`)
    .then((r) => r.json())
    .then((data) => {
      const all = [...(data.system ?? []), ...(data.user ?? [])];
      if (!all.length) {
        modelPickerRow.replaceChildren(h('div', { class: 'empty-state', style: 'padding:16px;font-size:13px' }, '暂无可用模特'));
        return;
      }
      modelPickerRow.replaceChildren(...all.map((m) => h('button', {
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
      )));
    })
    .catch(() => {
      modelPickerRow.replaceChildren(h('div', { class: 'empty-state', style: 'padding:16px;font-size:13px' }, '模特库加载失败'));
    });

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
      h('div', { class: 'am-title' }, '素材分配预览'),
      h('div', { class: 'am-grid' },
        ...[['01', '列表主图', `产品${p1} 主模特${m1}`], ['02', '背面展示', `产品${p2} 主模特${m1}`],
        ['03', '完整穿搭', `主模特${m1}`], ['04', '印花细节', `产品${p1}`],
        ['05', '面料做工', `产品${p1}`], ['06', '另一位模特', `产品${p1} ${state.model2 ? '第二模特✓' : 'AI生成'}`],
        ['07', '品牌生活方式', `主模特${m1} ${state.model2 ? '第二模特✓' : 'AI生成'}`],
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

  function refreshGenerate() {
    const canGen = state.productImages.length > 0 && !state.generating;
    genControls.replaceChildren(
      h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
        h('button', {
          class: 'btn btn-primary btn-lg', disabled: !canGen,
          onclick: generateAll,
        }, icon('sparkles', { size: 16 }), state.generating ? '生成中…' : '一键生成 7 步'),
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

  // ---------- 素材分配 (按流程图) ----------
  function getAssetsForStep(stepId) {
    const productUrls = state.productImages.map((im) => im.url).filter((u) => u && !isMockUrl(u));
    const model1Url = state.model1?.cover;
    const model2Url = state.model2?.cover;

    switch (stepId) {
      case '01': return { images: [...productUrls.slice(0, 1), model1Url].filter(Boolean), hasModel: !!state.model1 };
      case '02': return { images: [...productUrls.slice(1, 2).length ? productUrls.slice(1, 2) : productUrls.slice(0, 1), model1Url].filter(Boolean), hasModel: !!state.model1 };
      case '03': return { images: [model1Url].filter(Boolean), hasModel: !!state.model1 };
      case '04': return { images: productUrls.slice(0, 1), hasModel: false };
      case '05': return { images: productUrls.slice(0, 1), hasModel: false };
      case '06': return { images: [productUrls[0], model2Url].filter(Boolean), hasModel: !!state.model2 };
      case '07': return { images: [productUrls[0], model1Url, model2Url].filter(Boolean), hasModel: !!state.model1 };
      default: return { images: productUrls, hasModel: false };
    }
  }

  // ---------- 生成 ----------
  async function generateAll() {
    if (state.generating) return;
    if (getCredits() < 14) { toast('额度不足 (需 14 额度)', 'err'); return; }
    state.generating = true;
    refreshGenerate();

    const mode = state.model1 ? (state.model2 ? 'b' : 'b') : 'a';
    // mode: a = 全 AI, b = 有模特库参考

    for (const s of STEPS) {
      await generateStep(s, mode);
    }

    state.generating = false;
    refreshGenerate();
    const completed = Object.values(state.results).filter((r) => r.status === 'completed').length;
    toast(`生成结束, 成功 ${completed}/7`, completed === 7 ? 'ok' : 'err');
  }

  async function generateStep(s, mode) {
    if (state.results[s.id]?.status === 'completed') return;
    spendCredits(2);
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

      // 匹配素材
      const { images } = getAssetsForStep(s.id);

      // 创建生成任务
      const genRes = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'shopify-lookbook',
          prompt: promptData.prompt,
          aspect_ratio: '4:5', resolution: '2K', quality: 'high', count: 1,
          imageUrls: images,
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
              refundCredits(2);
              state.results[s.id] = { status: 'failed', error: st.error || '生成失败' };
            }
            drawResults();
            resolve();
          }
        }, { intervalMs: 5000, maxErrors: 12 });
      });
    } catch (e) {
      refundCredits(2);
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
