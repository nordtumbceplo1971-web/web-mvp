import { h, toast, fileToDataURI, isMockUrl, pollTask, IMAGE_STAGES } from '../ui.js';
import { renderApiError } from '../errors.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { icon } from '../icons.js';
import { getUserId } from './models.js';

/**
 * Shopify 套图创作流
 * 流程: 上传产品 → 选择线路 (A/B) → 依次生成 01–07
 *
 * 线路 a (Skill A): AI 自动建模, 用户输入灵感 prompt
 * 线路 b (Skill B): 从模特库选择模特三视图作为形象参考
 */
export async function renderLookbook(root, { navigate, back }) {
  root.replaceChildren();
  const goBack = back ?? (() => navigate('/templates'));
  const userId = getUserId();

  // ---------- 状态 ----------
  const state = {
    productImages: [],     // {dataUri, url, name, label}
    mode: null,            // 'a' | 'b'
    inspiration: '',       // 线路 a 的灵感 prompt
    modelId: null,         // 线路 b 选择的模特 ID
    modelName: '',
    modelDesc: '',
    results: {},           // stepId → {url, taskId, status}
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
      h('div', { class: 'ph-sub' }, '7 步出全套商品图: 列表主图 → 背面 → 穿搭 → 印花 → 面料 → 另一模特 → 生活方式'),
    ),
    h('span', { class: 'pill pill-line' }, '多步骤'),
  );

  // ---------- 步骤条 ----------
  const steps = [['1', '上传产品'], ['2', '选择线路'], ['3', '生成套图']];
  const stepEls = steps.map(([n, label]) => h('div', { class: 'step' }, h('span', { class: 'dot' }, n), label));
  const stepper = h('div', { class: 'stepper' },
    stepEls.flatMap((el, i) => i === 0 ? [el] : [h('span', { class: 'step-arrow' }, '→'), el]),
  );

  function refreshStepper() {
    const hasProduct = state.productImages.length > 0;
    const hasMode = !!state.mode;
    const doneMap = [hasProduct, hasMode, false];
    stepEls.forEach((el, i) => {
      el.classList.toggle('done', doneMap[i]);
      el.classList.toggle('now', !doneMap[i] && (i === 0 || doneMap[i - 1]));
      el.querySelector('.dot').textContent = doneMap[i] ? '✓' : String(i + 1);
    });
  }

  // ---------- Step1: 上传产品 ----------
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
    h('div', { class: 'd' }, '上传产品正面图和/或背面图 · 支持 JPG / PNG / WebP · 最多 2 张'),
  );

  const productPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '1'), '上传产品图'),
    h('div', { class: 'hint' }, '上传产品正面图和背面图 (背面图可选, 用于步骤 02), 拍清楚一点效果更好'),
    uploader, fileInput, thumbsWrap,
  );

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, 2 - state.productImages.length);
    if (!files.length) return;
    for (const file of files) {
      const dataUri = await fileToDataURI(file);
      const item = { dataUri, url: null, name: file.name, label: state.productImages.length === 0 ? '正面' : '背面' };
      state.productImages.push(item);
      drawThumbs();
      try {
        const res = await fetch('/api/uploads', {
          method: 'POST',
          body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
        });
        const data = await res.json();
        if (data?.error) throw new Error(data.error.message);
        item.url = data.url;
      } catch (e) {
        toast(`「${file.name}」上传失败: ${e.message}`, 'err');
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

  // ---------- Step2: 选择线路 ----------
  const modeDetail = h('div', { style: 'margin-top:14px' });
  const modePanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '2'), '选择线路'),
    h('div', { class: 'hint' }, '线路 a: AI 自动建模 (需输入灵感) · 线路 b: 从模特库选模特'),
    h('div', { class: 'mode-select' },
      modeCard('a', 'AI 自动建模', '模型自动生成模特形象, 你只需输入灵感描述', 'sparkles', '#2563eb', '#eff6ff'),
      modeCard('b', '模特库选模特', '从模特库选择模特三视图, 形象更稳定可控', 'user', '#7c3aed', '#f5f3ff'),
    ),
    modeDetail,
  );

  function modeCard(id, title, desc, iconName, color, tint) {
    return h('button', {
      class: `mode-card ${state.mode === id ? 'active' : ''}`, type: 'button',
      'data-mode': id,
      onclick: () => {
        state.mode = id;
        modePanel.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('active', c.dataset.mode === id));
        drawModeDetail();
        refreshStepper();
        refreshGenerate();
      },
    },
      h('span', { class: 'mc-ico', style: `background:${tint};color:${color}` }, icon(iconName, { size: 20 })),
      h('span', { class: 'mc-title' }, title),
      h('span', { class: 'mc-desc' }, desc),
    );
  }

  function drawModeDetail() {
    if (state.mode === 'a') {
      const input = h('textarea', {
        class: 'text-input', rows: 3,
        placeholder: '描述你想要的模特形象, 例: 20岁左右欧美白皮年轻男性, 身材苗条高挑, 金发碧眼, 潮牌街头气质',
        oninput: () => { state.inspiration = input.value; },
      });
      input.value = state.inspiration;
      modeDetail.replaceChildren(
        h('div', { class: 'g-label', style: 'margin-bottom:6px' }, '灵感描述 (选填)'),
        input,
        h('div', { class: 'desc', style: 'margin-top:6px;font-size:12px' }, '不填则使用默认模特设定: 欧美年轻男性, 苗条高挑, 潮牌气质'),
      );
    } else if (state.mode === 'b') {
      const pickerGrid = h('div', { class: 'model-picker-grid', style: 'max-height:280px;overflow-y:auto' }, h('div', { class: 'home-loading' }, '加载模特库…'));
      modeDetail.replaceChildren(
        h('div', { class: 'g-label', style: 'margin-bottom:8px' }, '选择模特'),
        pickerGrid,
      );
      // 加载模特库
      fetch(`/api/models?userId=${encodeURIComponent(userId)}`)
        .then((r) => r.json())
        .then((data) => {
          const all = [...(data.system ?? []), ...(data.user ?? [])];
          if (!all.length) {
            pickerGrid.replaceChildren(h('div', { class: 'empty-state' }, '暂无可用模特, 请先到模特库添加'));
            return;
          }
          pickerGrid.replaceChildren(...all.map((m) => h('button', {
            class: `model-pick ${state.modelId === m.id ? 'active' : ''}`, type: 'button',
            onclick: () => {
              state.modelId = m.id;
              state.modelName = m.name;
              state.modelDesc = m.desc;
              pickerGrid.querySelectorAll('.model-pick').forEach((c) => c.classList.toggle('active', c.dataset.id === m.id));
              refreshGenerate();
            },
            'data-id': m.id,
          },
            h('img', { src: m.cover, alt: m.name, loading: 'lazy' }),
            h('span', { class: 'mp-name' }, m.name),
          )));
        })
        .catch(() => {
          pickerGrid.replaceChildren(h('div', { class: 'empty-state' }, '模特库加载失败'));
        });
    } else {
      modeDetail.replaceChildren();
    }
  }

  // ---------- Step3: 生成 ----------
  const genControls = h('div', { class: 'gen-controls' });
  const resultsZone = h('div', { class: 'lookbook-results' });
  const genPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '3'), '生成套图'),
    h('div', { class: 'hint' }, '按 01→07 顺序生成, 每步自动引用前序效果图保持一致性'),
    genControls,
    resultsZone,
  );

  function refreshGenerate() {
    const canGen = state.productImages.length > 0 && !!state.mode && !state.generating;
    const cost = 2;
    genControls.replaceChildren(
      h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
        h('button', {
          class: 'btn btn-primary btn-lg', disabled: !canGen,
          onclick: generateAll,
        }, icon('sparkles', { size: 16 }), state.generating ? '生成中…' : '一键生成 7 步'),
        h('span', { style: 'color:var(--ink-3);font-size:13px' }, `每步 ${cost} 额度 · 共 7 步 · 当前余额 ${getCredits()}`),
      ),
    );
  }

  // 7 步卡片
  const STEPS = [
    { id: '01', name: '列表主图', desc: '单人正面模特图' },
    { id: '02', name: '背面展示', desc: '同一模特背面图' },
    { id: '03', name: '完整穿搭', desc: '全身/四分之三侧身' },
    { id: '04', name: '印花细节', desc: '核心图案近景' },
    { id: '05', name: '面料与做工', desc: '布料/领口/肩线特写' },
    { id: '06', name: '另一位模特', desc: '换性别/身形穿搭' },
    { id: '07', name: '品牌生活方式', desc: '场景故事图' },
  ];

  function drawResults() {
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
              ? h('div', { class: 'lb-result' },
                h('img', { src: r.url, alt: s.name }),
              )
              : r?.status === 'generating'
                ? h('div', { class: 'lb-placeholder generating' }, h('div', { class: 'spinner' }), '生成中…')
                : h('div', { class: 'lb-placeholder' }, h('span', { class: 'lb-wait' }, '待生成')),
          );
        }),
      ),
    );
  }

  async function generateAll() {
    if (state.generating) return;
    const cost = 2;
    if (getCredits() < cost * 7) {
      toast('额度不足, 请先充值', 'err');
      return;
    }
    state.generating = true;
    refreshGenerate();

    const stepPrompts = {};
    try {
      // 先获取每步提示词
      for (const s of STEPS) {
        const res = await fetch('/api/shopify/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: state.mode,
            step: s.id,
            productDesc: 'T恤',
            inspiration: state.inspiration,
            modelDesc: state.modelDesc,
            productBackAvailable: state.productImages.length > 1,
          }),
        });
        const data = await res.json();
        if (data?.error) throw new Error(data.error.message);
        stepPrompts[s.id] = data.prompt;
      }

      // 逐步生成
      for (const s of STEPS) {
        if (!state.productImages.length) break;
        spendCredits(cost);
        state.results[s.id] = { status: 'generating' };
        drawResults();

        const imageUrls = state.productImages.map((im) => im.url).filter((u) => u && !isMockUrl(u));

        try {
          const res = await fetch('/api/generate/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId: 'shopify-lookbook',
              prompt: stepPrompts[s.id],
              aspect_ratio: '4:5',
              resolution: '2K',
              quality: 'high',
              count: 1,
              imageUrls,
              title: `Shopify ${s.id} ${s.name}`,
            }),
          });
          const gen = await res.json();
          if (gen?.error) throw new Error(gen.error.message);

          // 轮询等待
          await new Promise((resolve) => {
            pollTask(gen.taskId, (st) => {
              if (st.isFinal) {
                if (st.status === 'completed' && st.urls?.length) {
                  state.results[s.id] = { status: 'completed', url: st.urls[0] };
                } else {
                  refundCredits(cost);
                  state.results[s.id] = { status: 'failed', error: st.error };
                }
                drawResults();
                resolve();
              }
            }, { intervalMs: 2000 });
          });
        } catch (e) {
          refundCredits(cost);
          state.results[s.id] = { status: 'failed', error: e.message };
          drawResults();
          toast(`步骤 ${s.id} 生成失败: ${e.message}`, 'err');
        }
      }
    } catch (e) {
      toast(`提示词生成失败: ${e.message}`, 'err');
    }

    state.generating = false;
    refreshGenerate();
    const completed = Object.values(state.results).filter((r) => r.status === 'completed').length;
    if (completed > 0) toast(`生成完成, 共 ${completed} 张`, 'ok');
  }

  // ---------- 组装 ----------
  refreshStepper();
  refreshGenerate();
  drawResults();
  drawThumbs();

  root.append(header, stepper, productPanel, modePanel, genPanel);
}
