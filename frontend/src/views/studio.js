import { h, toast, fileToDataURI, isMockUrl, pollTask, IMAGE_STAGES, VIDEO_STAGES } from '../ui.js';
import { api } from '../api.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { tplCover } from '../tplMeta.js';
import { icon } from '../icons.js';

/**
 * 自由工作台 (需求 8/9): 生图 + 改图
 * - 左侧工具箱: 参考图上传 / 需求模板快捷选择 / 提示词 + 「优化提示词」/ 画幅张数
 * - 右侧画布: 结果展示
 * - 「优化提示词」接入 glm-5.3-flash (视觉理解): 看图 + 改写提示词
 */
export async function renderStudio(root, { navigate, query, back }) {
  root.replaceChildren();
  const goBack = back ?? (() => navigate('/'));

  const { items: allTemplates } = await api.listTemplates();
  const quickTemplates = allTemplates.filter((t) => t.type === 'image' || t.type === 'video');

  const state = {
    images: [],            // {dataUri, url}
    templateId: query.get('tpl') || 'retouch-bg',
    prompt: '',
    originalPrompt: '',
    optimized: false,
    aspect: '1:1',
    count: 1,
    resolution: '2K',
  };

  // ---------- 顶部 ----------
  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => goBack(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:var(--brand-soft);color:var(--brand)' }, icon('wand', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '自由工作台 · 生图 / 改图'),
      h('div', { class: 'ph-sub' }, '选个需求模板, 或直接用大白话描述 —— 写不好? 点「优化提示词」, AI 帮你看图改写'),
    ),
  );

  // ---------- 左侧工具箱 ----------
  const thumbsWrap = h('div', { class: 'upload-thumbs' });
  const uploader = h('div', {
    class: 'uploader', style: 'padding:22px 16px', 'data-tour': 'studio-upload',
    onclick: () => fileInput.click(),
    ondragover: (e) => { e.preventDefault(); uploader.classList.add('dragover'); },
    ondragleave: () => uploader.classList.remove('dragover'),
    ondrop: (e) => { e.preventDefault(); uploader.classList.remove('dragover'); addFiles(e.dataTransfer.files); },
  },
    h('div', { class: 'up-ico' }, icon('upload', { size: 20 })),
    h('div', { class: 't' }, '上传参考图（产品图/原图，最多 2 张)'),
    h('div', { class: 'd' }, '改图类模板需要; 纯文生图可不上传'),
  );
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', onchange: (e) => { addFiles(e.target.files); fileInput.value = ''; } });

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, 2 - state.images.length);
    for (const file of files) {
      const dataUri = await fileToDataURI(file);
      const item = { dataUri, url: null };
      state.images.push(item);
      drawThumbs();
      try {
        const res = await api.upload(file);
        item.url = res.url;
        drawThumbs();
      } catch (e) {
        toast(`上传失败: ${e.message}`, 'err');
        state.images = state.images.filter((x) => x !== item);
        drawThumbs();
      }
    }
    refreshGen();
  }

  function drawThumbs() {
    const items = state.images.map((img, i) => h('div', { class: 'thumb' },
      h('img', { src: img.dataUri, alt: `参考图 ${i + 1}` }),
      h('button', { class: 'rm', title: '移除', onclick: () => { state.images.splice(i, 1); drawThumbs(); refreshGen(); } }, '✕'),
    ));
    if (state.images.length < 2) items.push(h('div', { class: 'thumb add-more', onclick: () => fileInput.click() }, '+'));
    thumbsWrap.replaceChildren(...items);
    uploader.style.display = state.images.length >= 2 ? 'none' : '';
  }

  // 需求模板快捷选择 (需求 8)
  const quickGrid = h('div', { class: 'tpl-quick' });
  function drawQuick() {
    quickGrid.replaceChildren(...quickTemplates.map((t) => {
      const { iconName, color } = tplCover(t);
      return h('button', {
        class: `q ${state.templateId === t.id ? 'active' : ''}`,
        title: t.subtitle,
        onclick: () => {
          state.templateId = t.id;
          drawQuick();
          applyTemplateDefaults(t);
        },
      }, h('span', { class: 'ico', style: `color:${color}` }, icon(iconName, { size: 18 })), h('span', { class: 't' }, t.title));
    }));
  }
  function applyTemplateDefaults(t) {
    if (t.type === 'image') {
      state.aspect = t.defaults.aspect_ratio === '9:21' ? '9:16' : t.defaults.aspect_ratio;
      state.resolution = t.defaults.resolution === '1K' ? '2K' : t.defaults.resolution;
    } else {
      state.aspect = t.defaults.aspect_ratio;
      state.resolution = '720p';
    }
    drawSpec();
    refreshGen();
  }

  // 提示词 + 优化按钮 (需求 9)
  const promptArea = h('textarea', {
    class: 'text-input', rows: 5,
    placeholder: '用大白话描述你想要的图, 例:\n把这双鞋放在大理石台面上, 旁边放一杯咖啡, 亮一点',
    oninput: () => { state.prompt = promptArea.value; refreshGen(); },
  });
  const optimizeBtn = h('button', {
    class: 'btn btn-blue btn-sm', 'data-tour': 'optimize-btn', onclick: optimize,
  }, '优化提示词', icon('sparkles', { size: 15 }));
  const optimizeNote = h('span', { class: 'optimize-note' }, 'AI 看图改写 · glm-5.3-flash 视觉理解');
  const optimizePreview = h('div', {});
  let lastOptimized = '';

  async function optimize() {
    const raw = state.prompt.trim();
    if (!raw && !state.images.length) {
      toast('先写点想法, 或上传一张图', 'err');
      return;
    }
    optimizeBtn.disabled = true;
    optimizeNote.textContent = 'AI 正在理解图片 / 改写中…';
    optimizePreview.replaceChildren();
    try {
      const imageUrl = state.images.map((im) => im.url).find((u) => u && !isMockUrl(u)) ?? null;
      const res = await api.optimizePrompt(raw, imageUrl);
      lastOptimized = res.optimizedPrompt;
      state.originalPrompt = raw;
      state.prompt = lastOptimized;
      promptArea.value = lastOptimized;
      state.optimized = true;
      optimizePreview.replaceChildren(
        h('div', { class: 'optimize-preview' },
          h('b', {}, '已优化'), ' ', res.visionUsed ? '(结合了你上传的图片内容)' : '(按电商出图公式补全)',
          h('div', { style: 'margin-top:6px;color:var(--ink-2);line-height:1.6' }, lastOptimized),
          h('button', {
            class: 'revert-link', style: 'margin-top:8px',
            onclick: () => {
              state.prompt = state.originalPrompt;
              promptArea.value = state.originalPrompt;
              state.optimized = false;
              optimizePreview.replaceChildren();
              refreshGen();
            },
          }, '还原我的原话'),
        ),
      );
      toast('提示词已优化', 'ok');
    } catch (e) {
      toast(`优化失败: ${e.message}`, 'err');
    } finally {
      optimizeBtn.disabled = false;
      optimizeNote.textContent = 'AI 看图改写 · glm-5.3-flash 视觉理解';
      refreshGen();
    }
  }

  // 规格 chips
  const specRow = h('div', { class: 'row' });
  function drawSpec() {
    const aspects = ['1:1', '3:4', '9:16', '16:9'];
    specRow.replaceChildren(
      ...aspects.map((a) => h('button', {
        class: `spec-chip ${state.aspect === a ? 'active' : ''}`,
        onclick: () => { state.aspect = a; drawSpec(); },
      }, a)),
      h('span', { style: 'width:6px' }),
      ...[1, 2, 4].map((c) => h('button', {
        class: `spec-chip ${state.count === c ? 'active' : ''}`,
        onclick: () => { state.count = c; drawSpec(); },
      }, `${c} 张`)),
      h('span', { style: 'width:6px' }),
      ...['2K', '4K'].map((r) => h('button', {
        class: `spec-chip ${state.resolution === r ? 'active' : ''}`,
        onclick: () => { state.resolution = r; drawSpec(); },
      }, r)),
    );
  }

  const summary = h('div', { class: 'gen-summary' });
  const genBtn = h('button', { class: 'btn btn-primary btn-lg', style: 'width:100%', 'data-tour': 'studio-generate', onclick: generate }, '生成图片');

  function refreshGen() {
    const credits = getCredits();
    const cost = 2 * state.count;
    summary.replaceChildren(
      h('div', {}, h('b', {}, '本次消耗: '), `${cost} 额度 · 余额 ${credits}`),
      h('div', { style: 'margin-top:4px' }, h('b', {}, '模型: '), 'gpt-image-2.5 图片'),
    );
    genBtn.disabled = credits < cost;
    genBtn.textContent = credits < cost ? '额度不足' : '生成图片';
  }

  const toolsPanel = h('div', { class: 'studio-tools' },
    h('div', { class: 'card panel' },
      h('h3', {}, h('span', { class: 'step-no' }, '1'), '参考图'),
      h('div', { class: 'hint' }, '改背景 / 换场景类需求需要; 不传就是纯文生图'),
      uploader, fileInput, thumbsWrap,
    ),
    h('div', { class: 'card panel' },
      h('h3', {}, h('span', { class: 'step-no' }, '2'), '需求模板'),
      h('div', { class: 'hint' }, '选中的模板会用它的专业提示词框架, 你写的想法会融进去'),
      quickGrid,
    ),
    h('div', { class: 'card panel prompt-box' },
      h('h3', {}, h('span', { class: 'step-no' }, '3'), '你的想法'),
      promptArea,
      h('div', { class: 'optimize-row' }, optimizeBtn, optimizeNote),
      optimizePreview,
      h('div', { style: 'margin-top:14px' }, specRow),
      h('div', { style: 'margin-top:16px' }, summary, genBtn),
    ),
  );

  // ---------- 右侧画布 ----------
  const canvas = h('div', { class: 'card panel studio-canvas' },
    h('div', { class: 'canvas-empty' },
      h('div', {},
        h('div', { class: 'ico' }, icon('image', { size: 40 })),
        h('div', { style: 'font-weight:900;font-size:16px;color:var(--ink-2)' }, '生成结果会出现在这里'),
        h('div', { style: 'font-size:13.5px;margin-top:6px' }, '左侧选模板 → 写想法 → 点「优化提示词」或直接生成'),
      ),
    ),
  );

  async function generate() {
    if (genBtn.disabled) return;
    const cost = 2 * state.count;
    spendCredits(cost);
    genBtn.disabled = true;

    const template = quickTemplates.find((t) => t.id === state.templateId) ?? quickTemplates[0];
    const isVideo = template.type === 'video';
    const genPanel = h('div', { class: 'card panel generating' },
      h('div', { class: 'spinner' }),
      h('div', { class: 'gen-stage' }, '正在按你的想法拍摄…'),
      h('div', { class: 'progress-bar' }, h('i', { style: 'width:4%' })),
    );
    canvas.replaceChildren(genPanel);

    // 组合: 模板框架 + 用户想法 (用户想法优先, 填进模板的 product/主体槽)
    const slotValues = { product: state.prompt || undefined };
    const payload = {
      templateId: template.id,
      slotValues,
      extraIdea: state.optimized ? '' : state.prompt,
      imageUrls: state.images.map((im) => im.url).filter((u) => u && !isMockUrl(u)),
      title: state.prompt.slice(0, 16) || template.title,
      aspect_ratio: state.aspect,
      count: isVideo ? undefined : state.count,
      resolution: isVideo ? '720p' : state.resolution,
      ...(isVideo ? { duration: 6 } : {}),
    };
    try {
      const res = isVideo ? await api.generateVideo(payload) : await api.generateImage(payload);
      const poll = pollTask(res.taskId, (st) => {
        genPanel.querySelector('.progress-bar i').style.width = `${Math.max(6, st.progress)}%`;
        if (st.isFinal && st.status === 'completed') {
          refreshGen();
          drawResults(st.urls, isVideo);
        } else if (st.isFinal) {
          refundCredits(cost); refreshGen();
          canvas.replaceChildren(h('div', { class: 'canvas-empty' }, '生成失败: ', st.error || '未知原因', h('br'), '额度已退回'));
        }
      });
      void poll;
    } catch (e) {
      refundCredits(cost); refreshGen();
      toast(e.message, 'err');
      canvas.replaceChildren(h('div', { class: 'canvas-empty' }, '生成失败, 请重试'));
    }
  }

  function drawResults(urls, isVideo) {
    canvas.replaceChildren(
      h('div', { class: 'section-head', style: 'margin-top:0' }, h('h2', { style: 'font-size:18px' }, '生成完成'), h('span', { class: 'pill pill-soft' }, '已存入我的作品')),
      h('div', { class: 'result-grid' },
        urls.map((url) => h('div', { class: `result-item ${isVideo ? 'video' : ''}` },
          isVideo ? h('video', { src: url, controls: true, playsinline: true }) : h('img', { src: url, alt: '结果' }),
          h('div', { class: 'pick' }, h('a', { class: 'icon-btn', href: url, target: '_blank', rel: 'noopener', title: '下载/查看' }, icon('download', { size: 15 }))),
        )),
      ),
    );
    toast('生成完成', 'ok');
  }

  // 初始: 从 query 带入的模板预填提示词
  const initialTpl = quickTemplates.find((t) => t.id === state.templateId);
  if (initialTpl) {
    try {
      const r = await api.previewPrompt(initialTpl.id, {});
      state.prompt = r.prompt;
      promptArea.value = r.prompt;
    } catch { /* noop */ }
  }

  drawQuick();
  drawSpec();
  drawThumbs();
  refreshGen();
  root.append(
    header,
    h('div', { class: 'studio-layout', style: 'margin-top:18px' }, toolsPanel, canvas),
  );
}
