import { h, toast, fileToDataURI, isMockUrl, pollTask } from '../ui.js';
import { renderApiError } from '../errors.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { icon } from '../icons.js';
import { getUserId } from './models.js';

/**
 * Shopify 套图创作流
 * 流程: 上传产品 → 选模特(可选) → 生成 01–07
 *
 * 不选模特 = 线路 a (Skill A): AI 自动建模
 * 选了模特 = 线路 b (Skill B): 从模特库选模特三视图作为形象参考
 */
export async function renderLookbook(root, { navigate, back }) {
  root.replaceChildren();
  const goBack = back ?? (() => navigate('/templates'));
  const userId = getUserId();

  // ---------- 状态 ----------
  const state = {
    productImages: [],
    modelId: null,
    modelName: '',
    modelDesc: '',
    modelCover: '',
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
      h('div', { class: 'ph-sub' }, '7 步出全套商品图: 列表主图 → 背面 → 穿搭 → 印花 → 面料 → 另一模特 → 生活方式'),
    ),
    h('span', { class: 'pill pill-line' }, '多步骤'),
  );

  // ---------- 步骤条 ----------
  const steps = [['1', '上传产品'], ['2', '选择模特'], ['3', '生成套图']];
  const stepEls = steps.map(([n, label]) => h('div', { class: 'step' }, h('span', { class: 'dot' }, n), label));
  const stepper = h('div', { class: 'stepper' },
    stepEls.flatMap((el, i) => i === 0 ? [el] : [h('span', { class: 'step-arrow' }, '→'), el]),
  );

  function refreshStepper() {
    const hasProduct = state.productImages.length > 0;
    const doneMap = [hasProduct, false, false]; // step2 永远是"可选"状态
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

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, 2 - state.productImages.length);
    if (!files.length) return;
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

  // ================================================================
  // 模特库选择 + 预览 (整合进上传面板)
  // ================================================================
  const modelPickerRow = h('div', { class: 'model-picker-row', style: 'margin-top:16px' }, h('div', { class: 'home-loading', style: 'padding:12px' }, '加载模特库…'));

  const modelPreview = h('div', { class: 'model-preview grey' },
    h('div', { class: 'mp-placeholder' },
      icon('user', { size: 32 }),
      h('div', { class: 'mp-hint' }, '未选择模特'),
      h('div', { class: 'mp-sub' }, '将使用 AI 自动建模 (线路 a)'),
    ),
  );

  const modelSection = h('div', { class: 'model-section' },
    h('div', { class: 'model-section-head' },
      h('h4', {}, icon('user', { size: 15 }), '模特库'),
      h('span', { class: 'desc', style: 'font-size:12px' }, '选择模特走线路 b · 不选走线路 a (AI 自动建模)'),
    ),
    modelPickerRow,
    modelPreview,
  );

  // 加载模特库
  fetch(`/api/models?userId=${encodeURIComponent(userId)}`)
    .then((r) => r.json())
    .then((data) => {
      const all = [...(data.system ?? []), ...(data.user ?? [])];
      if (!all.length) {
        modelPickerRow.replaceChildren(h('div', { class: 'empty-state', style: 'padding:16px;font-size:13px' }, '暂无可用模特, 请先到模特库添加'));
        return;
      }
      // "AI 自动建模" 选项 (清除选择)
      const aiCard = h('button', {
        class: `model-pick-item ${!state.modelId ? 'active' : ''}`, type: 'button',
        'data-id': '',
        onclick: () => selectModel(null),
      },
        h('div', { class: 'mpi-cover ai-cover' }, icon('sparkles', { size: 22 })),
        h('span', { class: 'mpi-name' }, 'AI 自动建模'),
      );

      const cards = all.map((m) => h('button', {
        class: `model-pick-item ${state.modelId === m.id ? 'active' : ''}`, type: 'button',
        'data-id': m.id,
        onclick: () => selectModel(m),
      },
        h('div', { class: 'mpi-cover' }, h('img', { src: m.cover, alt: m.name, loading: 'lazy' })),
        h('span', { class: 'mpi-name' }, m.name),
      ));

      modelPickerRow.replaceChildren(aiCard, ...cards);
    })
    .catch(() => {
      modelPickerRow.replaceChildren(h('div', { class: 'empty-state', style: 'padding:16px;font-size:13px' }, '模特库加载失败'));
    });

  function selectModel(m) {
    if (m) {
      state.modelId = m.id;
      state.modelName = m.name;
      state.modelDesc = m.desc;
      state.modelCover = m.cover;
    } else {
      state.modelId = null;
      state.modelName = '';
      state.modelDesc = '';
      state.modelCover = '';
    }
    // 更新选中状态
    modelPickerRow.querySelectorAll('.model-pick-item').forEach((c) => {
      c.classList.toggle('active', c.dataset.id === (state.modelId ?? ''));
    });
    // 更新预览
    drawModelPreview();
    drawInspiration();
    refreshGenerate();
  }

  function drawModelPreview() {
    if (state.modelId && state.modelCover) {
      modelPreview.className = 'model-preview active';
      modelPreview.replaceChildren(
        h('div', { class: 'mp-img-wrap' },
          h('img', { src: state.modelCover, alt: state.modelName }),
        ),
        h('div', { class: 'mp-info' },
          h('div', { class: 'mp-model-name' }, state.modelName),
          h('div', { class: 'mp-model-desc' }, state.modelDesc || '模特三视图参考'),
          h('button', {
            class: 'btn btn-ghost btn-sm', style: 'margin-top:6px',
            onclick: () => selectModel(null),
          }, '取消选择'),
        ),
      );
    } else {
      modelPreview.className = 'model-preview grey';
      modelPreview.replaceChildren(
        h('div', { class: 'mp-placeholder' },
          icon('user', { size: 32 }),
          h('div', { class: 'mp-hint' }, '未选择模特'),
          h('div', { class: 'mp-sub' }, '将使用 AI 自动建模 (线路 a)'),
        ),
      );
    }
  }

  // 灵感 prompt (仅 AI 自动建模时显示)
  const inspirationWrap = h('div', { class: 'inspiration-wrap', style: 'margin-top:12px;display:none' });
  function drawInspiration() {
    if (state.modelId) {
      inspirationWrap.style.display = 'none';
      return;
    }
    inspirationWrap.style.display = '';
    if (!inspirationWrap.children.length) {
      const input = h('textarea', {
        class: 'text-input', rows: 2,
        placeholder: '描述你想要的模特形象 (选填), 例: 20岁欧美白皮男性, 苗条高挑, 金发碧眼',
        oninput: () => { state.inspiration = input.value; },
      });
      input.value = state.inspiration;
      inspirationWrap.replaceChildren(
        h('div', { class: 'g-label', style: 'margin-bottom:4px;font-size:12px' }, '灵感描述 (选填, 仅 AI 建模时生效)'),
        input,
      );
    }
  }

  // ---------- 上传面板 (含模特库) ----------
  const productPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '1'), '上传产品图'),
    h('div', { class: 'hint' }, '上传产品正面图和背面图 (背面图可选), 拍清楚一点效果更好'),
    uploader, fileInput, thumbsWrap,
    modelSection,
    inspirationWrap,
  );

  // ---------- Step3: 生成 ----------
  const genControls = h('div', { class: 'gen-controls' });
  const resultsZone = h('div', { class: 'lookbook-results' });
  const genPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '2'), '生成套图'),
    h('div', { class: 'hint' }, '按 01→07 顺序生成, 每步自动引用前序效果图保持一致性'),
    genControls,
    resultsZone,
  );

  // ---------- 流程进度面板 (侧栏) ----------
  const progressList = h('div', { class: 'progress-steps' });

  function drawProgress() {
    progressList.replaceChildren(...STEPS.map((s, i) => {
      const r = state.results[s.id];
      const status = r?.status ?? 'pending'; // pending | generating | completed | failed
      const isLast = i === STEPS.length - 1;
      return h('div', { class: `progress-step ${status}` },
        h('div', { class: 'ps-track' },
          h('div', { class: 'ps-dot' }, status === 'completed' ? '✓' : status === 'generating' ? '' : status === 'failed' ? '✕' : s.id),
          !isLast ? h('div', { class: 'ps-line' }) : null,
        ),
        h('div', { class: 'ps-body' },
          h('div', { class: 'ps-name' }, s.name),
          h('div', { class: 'ps-status' }, status === 'completed' ? '已完成' : status === 'generating' ? '生成中…' : status === 'failed' ? '失败' : '待生成'),
        ),
        r?.url ? h('div', { class: 'ps-thumb' }, h('img', { src: r.url, alt: s.name })) : null,
      );
    }));
  }

  const progressPanel = h('div', { class: 'card panel progress-panel' },
    h('h3', {}, icon('layers', { size: 16 }), ' 流程进度'),
    h('div', { class: 'hint', id: 'progress-summary' }, '点击「一键生成 7 步」开始'),
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
    else if (failed > 0) el.textContent = `完成 ${done}/7 · 失败 ${failed}`;
    else if (done > 0) el.textContent = `完成 ${done}/7`;
    else el.textContent = '点击「一键生成 7 步」开始';
  }

  function refreshGenerate() {
    const canGen = state.productImages.length > 0 && !state.generating;
    const cost = 2;
    const modeLabel = state.modelId ? `线路 b · ${state.modelName}` : '线路 a · AI 自动建模';
    genControls.replaceChildren(
      h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
        h('button', {
          class: 'btn btn-primary btn-lg', disabled: !canGen,
          onclick: generateAll,
        }, icon('sparkles', { size: 16 }), state.generating ? '生成中…' : '一键生成 7 步'),
        h('span', { style: 'color:var(--ink-3);font-size:13px' }, `${modeLabel} · 每步 ${cost} 额度 · 余额 ${getCredits()}`),
      ),
    );
  }

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

    const mode = state.modelId ? 'b' : 'a';
    const stepPrompts = {};
    try {
      for (const s of STEPS) {
        const res = await fetch('/api/shopify/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode, step: s.id,
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

      for (const s of STEPS) {
        if (!state.productImages.length) break;
        spendCredits(cost);
        state.results[s.id] = { status: 'generating' };
        drawResults();

        const imageUrls = state.productImages.map((im) => im.url).filter((u) => u && !isMockUrl(u));
        // 线路 b 时把模特参考图也传入
        if (state.modelId && state.modelCover) {
          imageUrls.push(state.modelCover);
        }

        try {
          const res = await fetch('/api/generate/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId: 'shopify-lookbook',
              prompt: stepPrompts[s.id],
              aspect_ratio: '4:5', resolution: '2K', quality: 'high', count: 1,
              imageUrls,
              title: `Shopify ${s.id} ${s.name}`,
            }),
          });
          const gen = await res.json();
          if (gen?.error) throw new Error(gen.error.message);

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
    drawInspiration();
    const completed = Object.values(state.results).filter((r) => r.status === 'completed').length;
    if (completed > 0) toast(`生成完成, 共 ${completed} 张`, 'ok');
  }

  // ---------- 组装 ----------
  refreshStepper();
  refreshGenerate();
  drawResults();
  drawThumbs();
  drawModelPreview();
  drawInspiration();

  const sidebar = h('div', { class: 'lookbook-sidebar' }, progressPanel);
  const layout = h('div', { class: 'lookbook-layout' },
    h('div', { class: 'lookbook-main' }, productPanel, genPanel),
    sidebar,
  );

  root.append(header, stepper, layout);
}
