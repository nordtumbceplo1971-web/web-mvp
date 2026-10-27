import { h, toast, fileToDataURI, isMockUrl, pollTask, IMAGE_STAGES, VIDEO_STAGES } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { IMAGE_ASPECTS, VIDEO_ASPECTS, resolveAspect } from '../aspect.js';
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

  let allTemplates;
  try {
    ({ items: allTemplates } = await api.listTemplates());
  } catch (e) {
    // 模板库都拉不到, 工作台无法初始化 —— 说清真实原因, 给出重试与设置入口
    root.append(
      h('div', { class: 'page-head' },
        h('button', {
          class: 'btn btn-ghost btn-sm', onclick: () => goBack(), 'aria-label': '返回上一页', title: '返回上一页',
        }, icon('arrow-left', { size: 15 }), '返回上一页'),
      ),
    );
    renderApiError(root, e, {
      resource: '模板库',
      onRetry: () => navigate(`/studio${query.get('mode') === 'video' ? '?mode=video' : ''}`),
      backTo: { label: '去用户设置', href: '#/settings', onClick: () => navigate('/settings') },
    });
    return;
  }
  // 创作模式: 首页底部「图片生成 / 视频生成」分别直达
  const mode = query.get('mode') === 'video' ? 'video' : 'image';
  const quickTemplates = allTemplates.filter((t) => (mode === 'video' ? t.type === 'video' : t.type === 'image'));

  const state = {
    images: [],            // {dataUri, url}
    templateId: query.get('tpl')
      || (mode === 'image' && quickTemplates.some((t) => t.id === 'retouch-bg') ? 'retouch-bg' : (quickTemplates[0]?.id ?? '')),
    prompt: '',
    originalPrompt: '',
    optimized: false,
    aspect: resolveAspect(mode === 'video' ? '9:16' : '1:1'),
    count: 1,
    resolution: '2K',
    duration: 6,
    tasks: [],           // 图片任务队列: {id, title, templateTitle, status, progress, urls, error, isVideo}
  };

  // ---------- 顶部 ----------
  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => goBack(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:var(--brand-soft);color:var(--brand)' }, icon('wand', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, mode === 'video' ? '自由工作台 · 视频创作' : '自由工作台 · 图片创作'),
      h('div', { class: 'ph-sub' }, mode === 'video'
        ? '选个视频需求模板, 或直接用大白话描述想要的片子 —— 写不好? 点「优化提示词」AI 帮你改写'
        : '选个需求模板, 或直接用大白话描述 —— 写不好? 点「优化提示词」, AI 帮你看图改写'),
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
    h('div', { class: 't' }, mode === 'video' ? '上传参考图 / 首帧图（最多 2 张)' : '上传参考图（产品图/原图，最多 2 张)'),
    h('div', { class: 'd' }, mode === 'video' ? '图生视频用; 不传就是纯文字描述出片' : '改图类模板需要; 纯文生图可不上传'),
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
      state.aspect = resolveAspect(t) ?? '1:1';
      state.resolution = t.defaults.resolution === '1K' ? '2K' : t.defaults.resolution;
    } else {
      state.aspect = t.defaults.aspect_ratio;
      state.resolution = t.defaults.resolution ?? '720p';
      state.duration = t.defaults.duration ?? 6;
    }
    drawSpec();
    refreshGen();
  }

  // 提示词 + 优化按钮 (需求 9)
  const promptArea = h('textarea', {
    class: 'text-input', rows: 5,
    placeholder: mode === 'video'
      ? '用大白话描述你想要的视频, 例:\n模特穿着这件 T 恤在城市街头走动, 镜头慢慢拉近, 阳光感'
      : '用大白话描述你想要的图, 例:\n把这双鞋放在大理石台面上, 旁边放一杯咖啡, 亮一点',
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
    if (mode === 'video') {
      // 视频: 画幅 + 时长 (取当前模板支持的时长) + 分辨率
      const tpl = quickTemplates.find((t) => t.id === state.templateId);
      specRow.replaceChildren(
        ...VIDEO_ASPECTS.map((a) => h('button', {
          class: `spec-chip ${state.aspect === a ? 'active' : ''}`,
          onclick: () => { state.aspect = a; drawSpec(); },
        }, a)),
        h('span', { style: 'width:6px' }),
        ...(tpl?.durationOptions ?? [4, 6, 8]).map((d) => h('button', {
          class: `spec-chip ${state.duration === d ? 'active' : ''}`,
          onclick: () => { state.duration = d; drawSpec(); },
        }, `${d} 秒`)),
        h('span', { style: 'width:6px' }),
        h('button', { class: 'spec-chip active' }, tpl?.defaults?.resolution ?? '720p'),
      );
      return;
    }
    const aspects = IMAGE_ASPECTS;
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
  const genBtn = h('button', { class: 'btn btn-primary btn-lg', style: 'width:100%', 'data-tour': 'studio-generate', onclick: generate }, mode === 'video' ? '生成视频' : '生成图片');

  function refreshGen() {
    const credits = getCredits();
    const isVideo = mode === 'video';
    const cost = isVideo ? 2 : 2 * state.count;
    summary.replaceChildren(
      h('div', {}, h('b', {}, '本次消耗: '), `${cost} 额度 · 余额 ${credits}`),
      h('div', { style: 'margin-top:4px' }, h('b', {}, '模型: '), isVideo ? 'veo-4-omni 视频' : 'gpt-image-2.5 图片'),
    );
    genBtn.disabled = credits < cost;
    genBtn.textContent = credits < cost ? '额度不足' : (isVideo ? '生成视频' : '生成图片');
  }

  // ---------- 图片任务队列（预览窗口右侧，可展开/收起，竖状排列） ----------
  let taskSeq = 0;
  const queueList = h('div', { class: 'tq-list' });
  const queueCount = h('span', { class: 'pill pill-soft' }, '0 个任务');
  const queueToggle = h('button', {
    class: 'tq-toggle', type: 'button', title: '收起 / 展开任务队列',
    'aria-label': '收起 / 展开任务队列',
    onclick: () => setQueueOpen(!queueOpen),
  }, icon('chevron-right', { size: 16 }));

  const queuePanel = h('div', { class: 'card panel tq-panel' },
    h('div', { class: 'tq-head' },
      h('h3', {}, icon('layers', { size: 15 }), mode === 'video' ? ' 视频任务队列' : ' 图片任务队列'),
      queueCount,
      queueToggle,
    ),
    queueList,
  );

  let queueOpen = true;
  function setQueueOpen(open) {
    queueOpen = open;
    queuePanel.classList.toggle('collapsed', !open);
    queueList.style.display = open ? '' : 'none';
    queueToggle.innerHTML = '';
    queueToggle.append(icon(open ? 'chevron-down' : 'chevron-right', { size: 16 }));
  }

  const TASK_STATUS = {
    processing: { label: '生成中', cls: 'running' },
    completed: { label: '已完成', cls: 'done' },
    failed: { label: '失败', cls: 'failed' },
    queued: { label: '排队中', cls: 'queued' },
  };

  function drawQueue() {
    queueCount.textContent = `${state.tasks.length} 个任务`;
    if (!state.tasks.length) {
      queueList.replaceChildren(h('div', { class: 'tq-empty' }, `还没有任务，点「${mode === 'video' ? '生成视频' : '生成图片'}」开始`));
      return;
    }
    queueList.replaceChildren(...state.tasks.map((t) => {
      const meta = TASK_STATUS[t.status] ?? TASK_STATUS.processing;
      return h('button', {
        class: `tq-item ${meta.cls}`, type: 'button',
        onclick: () => showTask(t),
      },
        h('div', { class: 'tq-thumb' },
          t.urls?.[0]
            ? h('img', { src: t.urls[0], alt: t.title, loading: 'lazy' })
            : h('span', { class: 'tq-ico' }, icon(t.status === 'failed' ? 'x' : 'image', { size: 15 })),
          t.status === 'processing' ? h('i', { class: 'tq-bar', style: `width:${Math.max(6, t.progress || 0)}%` }) : null,
        ),
        h('div', { class: 'tq-meta' },
          h('div', { class: 'tq-title' }, t.title),
          h('div', { class: 'tq-sub' },
            h('span', { class: `tq-tag ${meta.cls}` }, meta.label),
            t.templateTitle ? h('span', { class: 'tq-tpl' }, t.templateTitle) : null,
          ),
        ),
      );
    }));
  }

  function addTask(partial) {
    const t = {
      id: ++taskSeq, status: 'queued', progress: 0, urls: [], error: null,
      templateTitle: '', title: '未命名任务',
      ...partial,
    };
    state.tasks.unshift(t);
    drawQueue();
    return t;
  }

  /** 把某个任务的结果/进度显示到中间预览窗口 */
  function showTask(t) {
    if (t.status === 'completed' && t.urls?.length) {
      drawResults(t.urls, t.isVideo);
      return;
    }
    if (t.status === 'failed') {
      canvas.replaceChildren(h('div', { class: 'canvas-empty' },
        '生成失败: ', t.error || '未知原因', h('br'), '额度已退回'));
      return;
    }
    canvas.replaceChildren(h('div', { class: 'card panel generating' },
      h('div', { class: 'spinner' }),
      h('div', { class: 'gen-stage' }, '正在按你的想法拍摄…'),
      h('div', { class: 'progress-bar' }, h('i', { style: `width:${Math.max(4, t.progress || 0)}%` })),
    ));
  }

  // ---------- 左列: 1 参考图 → 3 你的想法 ----------
  const leftPanel = h('div', { class: 'studio-left' },
    h('div', { class: 'card panel' },
      h('h3', {}, h('span', { class: 'step-no' }, '1'), '参考图'),
      h('div', { class: 'hint' }, '改背景 / 换场景类需求需要; 不传就是纯文生图'),
      uploader, fileInput, thumbsWrap,
    ),
    h('div', { class: 'card panel prompt-box' },
      h('h3', {}, h('span', { class: 'step-no' }, '3'), '你的想法'),
      h('div', { class: 'hint' }, '用大白话描述你想要的图; 不会写就点「优化提示词」'),
      promptArea,
      h('div', { class: 'optimize-row' }, optimizeBtn, optimizeNote),
      optimizePreview,
      h('div', { style: 'margin-top:14px' }, specRow),
      h('div', { style: 'margin-top:16px' }, summary, genBtn),
    ),
  );

  // ---------- 2 模板需求（预览窗口下方） ----------
  const templatePanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '2'), '需求模板'),
    h('div', { class: 'hint' }, '选中的模板会用它的专业提示词框架, 你写的想法会融进去'),
    quickGrid,
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
    const cost = mode === 'video' ? 2 : 2 * state.count;
    spendCredits(cost);
    genBtn.disabled = true;

    const template = quickTemplates.find((t) => t.id === state.templateId) ?? quickTemplates[0];
    const isVideo = template.type === 'video';

    // 每次生成都入队, 右侧「图片任务队列」竖状追踪
    const task = addTask({
      title: state.prompt.slice(0, 16) || template.title,
      templateTitle: template.title,
      isVideo,
      status: 'processing',
    });

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
      resolution: state.resolution,
      ...(isVideo ? { duration: state.duration } : {}),
    };
    try {
      const res = isVideo ? await api.generateVideo(payload) : await api.generateImage(payload);
      task.taskId = res.taskId;
      const poll = pollTask(res.taskId, (st) => {
        genPanel.querySelector('.progress-bar i').style.width = `${Math.max(6, st.progress)}%`;
        task.progress = st.progress;
        if (st.isFinal && st.status === 'completed') {
          task.status = 'completed';
          task.urls = st.urls;
          refreshGen();
          drawQueue();
          drawResults(st.urls, isVideo);
        } else if (st.isFinal) {
          task.status = 'failed';
          task.error = st.error || '未知原因';
          refundCredits(cost); refreshGen();
          drawQueue();
          canvas.replaceChildren(h('div', { class: 'canvas-empty' }, '生成失败: ', st.error || '未知原因', h('br'), '额度已退回'));
        } else {
          drawQueue();
        }
      });
      void poll;
    } catch (e) {
      task.status = 'failed';
      task.error = e.message;
      drawQueue();
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

  // 初始: 从 query 带入的模板预填提示词 + 套用模板默认规格
  const initialTpl = quickTemplates.find((t) => t.id === state.templateId);
  if (initialTpl) {
    applyTemplateDefaults(initialTpl);
    try {
      const r = await api.previewPrompt(initialTpl.id, {});
      state.prompt = r.prompt;
      promptArea.value = r.prompt;
    } catch { /* noop */ }
  }

  drawQuick();
  drawSpec();
  drawThumbs();
  drawQueue();
  setQueueOpen(true);
  refreshGen();
  root.append(
    header,
    // 三栏: 左=1参考图+3你的想法 / 中=预览窗口+2模板需求 / 右=图片任务队列
    h('div', { class: 'studio-layout', style: 'margin-top:18px' },
      leftPanel,
      h('div', { class: 'studio-main' }, canvas, templatePanel),
      queuePanel,
    ),
  );
}
