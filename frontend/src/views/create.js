import { h, toast, fileToDataURI, isMockUrl, pollTask, IMAGE_STAGES, VIDEO_STAGES } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { getCredits, spendCredits, refundCredits } from '../store.js';
import { IMAGE_ASPECTS, VIDEO_ASPECTS, resolveAspect } from '../aspect.js';
import { tplCover } from '../tplMeta.js';
import { icon } from '../icons.js';

/**
 * 三步创作流 (PRD 模块 2): 1 上传 → 2 微调 → 3 生成
 * 用户全程只做「上传 + 点选 + 确认」
 */
export async function renderCreate(root, { navigate, query, back }) {
  root.replaceChildren();
  const goBack = back ?? (() => navigate('/templates'));
  const tplId = query.get('tpl');
  let tpl;
  try {
    tpl = await api.getTemplate(tplId);
  } catch (e) {
    // 区分「模板不存在」与「后端没部署 / 网络不通」等真实原因
    root.append(h('div', { class: 'page-head' },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => goBack(), 'aria-label': '返回上一页' },
        icon('arrow-left', { size: 15 }), '返回上一页'),
    ));
    renderApiError(root, e, {
      resource: '模板',
      onRetry: () => navigate(`/create?tpl=${tplId}`),
      backTo: { label: '回模板库', href: '#/templates', onClick: () => navigate('/templates') },
    });
    return;
  }
  // 多步骤模板 (Shopify 套图) 有专属流程页, 不能走通用单图生成 —— 任何入口都统一分流过去,
  // 否则模板库卡片 / 首页 / 我的作品会落到通用页, 少了模特选择与 7 步流程
  if (tpl.isLookbook) {
    navigate('/lookbook');
    return;
  }

  const isVideo = tpl.type === 'video';
  const needImages = tpl.needImages ?? 1;
  const { iconName, tint, color: colorTint } = tplCover(tpl);

  // ---------- 状态 ----------
  const state = {
    images: [],            // {dataUri, url, name}
    slotValues: {},        // 槽位 → 选项 value
    texts: {},             // 文本槽位
    extraIdea: '',
    spec: { ...(isVideo
      ? { aspect_ratio: tpl.defaults.aspect_ratio, resolution: tpl.defaults.resolution, duration: tpl.defaults.duration }
      : { aspect_ratio: resolveAspect(tpl), resolution: tpl.defaults.resolution, count: tpl.defaults.count, quality: tpl.defaults.quality }) },
    retryFree: true,       // 「换一批」首次免费 (PRD 核心原则 4)
  };
  for (const s of tpl.slots) {
    if (s.type === 'text') state.texts[s.key] = '';
    else state.slotValues[s.key] = s.options?.[0]?.value ?? '';
  }

  // ---------- 顶部 ----------
  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => goBack(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: `background:${tint};color:${colorTint}` }, icon(iconName, { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, tpl.title),
      h('div', { class: 'ph-sub' }, tpl.subtitle),
    ),
    h('span', { class: 'pill pill-line' }, isVideo ? '视频模板' : '图片模板'),
  );

  // ---------- 步骤条 ----------
  const steps = [
    ['1', '上传素材'], [isVideo ? '2' : '2', '点选微调'], ['3', '生成'],
  ];
  const stepEls = steps.map(([n, label]) => h('div', { class: 'step' }, h('span', { class: 'dot' }, n), label));
  const stepper = h('div', { class: 'stepper' },
    stepEls.flatMap((el, i) => i === 0 ? [el] : [h('span', { class: 'step-arrow' }, '→'), el]),
  );

  function refreshStepper() {
    const uploaded = state.images.length >= needImages;
    const tuned = uploaded; // 微调有默认值, 上传完即视为可生成
    const doneMap = [uploaded, tuned, false];
    stepEls.forEach((el, i) => {
      el.classList.toggle('done', doneMap[i]);
      el.classList.toggle('now', !doneMap[i] && (i === 0 || doneMap[i - 1]));
      el.querySelector('.dot').textContent = doneMap[i] ? '✓' : String(i + 1);
    });
  }

  // ---------- Step1 上传 ----------
  const thumbsWrap = h('div', { class: 'upload-thumbs' });
  const uploader = h('div', {
    class: 'uploader', 'data-tour': 'upload-zone',
    onclick: () => fileInput.click(),
    ondragover: (e) => { e.preventDefault(); uploader.classList.add('dragover'); },
    ondragleave: () => uploader.classList.remove('dragover'),
    ondrop: (e) => { e.preventDefault(); uploader.classList.remove('dragover'); addFiles(e.dataTransfer.files); },
  },
    h('div', { class: 'up-ico' }, icon('upload', { size: 20 })),
    h('div', { class: 't' }, `把${needImages > 1 ? `${needImages} 张图（第 1 张产品图, 第 2 张场景图）` : '产品图'}拖到这里`),
    h('div', { class: 'd' }, '或点击选择文件 · 支持 JPG / PNG / WebP, ≤25MB'),
  );
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: needImages > 1, style: 'display:none', onchange: (e) => { addFiles(e.target.files); fileInput.value = ''; } });
  const uploadPanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '1'), '上传素材'),
    h('div', { class: 'hint' }, `${tpl.needLabel} · 拍清楚一点, 生成效果更好`),
    uploader, fileInput, thumbsWrap,
  );

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, needImages - state.images.length);
    if (!files.length) return;
    for (const file of files) {
      const dataUri = await fileToDataURI(file);
      const item = { dataUri, url: null, name: file.name };
      state.images.push(item);
      drawThumbs();
      try {
        const res = await api.upload(file);
        item.url = res.url;
      } catch (e) {
        toast(`「${file.name}」上传失败: ${e.message}`, 'err');
        state.images = state.images.filter((x) => x !== item);
        drawThumbs();
      }
    }
    refreshStepper();
    refreshGen();
  }

  function drawThumbs() {
    const items = state.images.map((img, i) => h('div', { class: 'thumb' },
      h('img', { src: img.dataUri, alt: img.name }),
      h('button', { class: 'rm', title: '移除', onclick: () => { state.images.splice(i, 1); drawThumbs(); refreshStepper(); refreshGen(); } }, '✕'),
    ));
    if (state.images.length < needImages) {
      items.push(h('div', { class: 'thumb add-more', onclick: () => fileInput.click() }, '+'));
    }
    thumbsWrap.replaceChildren(...items);
    uploader.style.display = state.images.length >= needImages ? 'none' : '';
  }

  // ---------- Step2 微调 ----------
  const tunePanel = h('div', { class: 'card panel' },
    h('h3', {}, h('span', { class: 'step-no' }, '2'), '点选微调效果'),
    h('div', { class: 'hint' }, '全部有默认值, 不想动就直接生成'),
    ...tpl.slots.map((slot) => slotGroup(slot)),
    extraIdeaBlock(),
  );

  function slotGroup(slot) {
    if (slot.type === 'text') {
      const input = h('input', {
        class: 'text-input', placeholder: slot.placeholder || '填一下', value: state.texts[slot.key] ?? '',
        oninput: () => { state.texts[slot.key] = input.value; refreshGen(); },
      });
      return h('div', { class: 'slot-group', 'data-tour': slot.key === 'product' ? 'slot-product' : null },
        h('div', { class: 'g-label' }, slot.label), input,
      );
    }
    const dots = slot.options.map((opt) => {
      const btn = h('button', {
        class: `opt-dot ${state.slotValues[slot.key] === opt.value ? 'active' : ''}`,
        onclick: () => {
          state.slotValues[slot.key] = opt.value;
          [...btn.parentElement.children].forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
          refreshGen();
        },
      }, h('span', { class: 'sw', style: `background:${opt.color}` }), opt.label);
      return btn;
    });
    return h('div', { class: 'slot-group' },
      h('div', { class: 'g-label' }, slot.label),
      h('div', { class: 'opt-row' }, dots),
    );
  }

  function extraIdeaBlock() {
    const body = h('div', { style: 'display:none;margin-top:10px' },
      h('textarea', {
        class: 'text-input', rows: 3, placeholder: '例: 想要更亮一点 / 突出水珠 / 带点高级感…（可留空）',
        oninput: (e) => { state.extraIdea = e.target.value; refreshGen(); },
      }),
    );
    const btn = h('button', {
      class: 'more-toggle',
      onclick: () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        btn.textContent = open ? '💡 描述你的想法 (可选) +' : '💡 收起';
      },
    }, '💡 描述你的想法 (可选) +');
    return h('div', { class: 'slot-group' }, btn, body);
  }

  // ---------- Step3 生成侧栏 ----------
  const aspectChips = isVideo ? VIDEO_ASPECTS : IMAGE_ASPECTS;
  const specRow1 = h('div', { class: 'row' },
    aspectChips.map((a) => specChip('aspect_ratio', a, a)),
  );
  const specRow2 = isVideo
    ? h('div', { class: 'row' },
        (tpl.durationOptions ?? [4, 6, 8]).map((d) => specChip('duration', `${d} 秒`, d)),
        h('span', { style: 'width:6px' }),
        ['720p', '1080p'].map((r) => specChip('resolution', r, r)),
      )
    : h('div', { class: 'row' },
        [1, 2, 4].map((c) => specChip('count', `${c} 张`, c)),
        h('span', { style: 'width:6px' }),
        ['2K', '4K'].map((r) => specChip('resolution', r, r)),
      );

  function specChip(key, label, value) {
    const btn = h('button', {
      class: `spec-chip ${String(state.spec[key]) === String(value) ? 'active' : ''}`,
      onclick: () => {
        state.spec[key] = value;
        [...btn.parentElement.children].forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        refreshGen();
      },
    }, label);
    return btn;
  }

  const summary = h('div', { class: 'gen-summary' });
  const genBtn = h('button', { class: 'btn btn-primary btn-lg', style: 'width:100%', 'data-tour': 'generate-btn', onclick: generate }, '生成');
  const sidePanel = h('div', { class: 'card panel gen-side' },
    h('h3', {}, h('span', { class: 'step-no' }, '3'), '确认并生成'),
    h('div', { class: 'hint' }, '生成后自动存入「我的作品」'),
    specRow1, specRow2,
    summary, genBtn,
  );

  function refreshGen() {
    const enoughImgs = state.images.length >= needImages;
    const enoughCredits = getCredits() >= tpl.credits;
    summary.replaceChildren(
      h('div', {}, h('b', {}, '本次消耗: '), `${tpl.credits} 额度 · 余额 ${getCredits()}`),
      h('div', { style: 'margin-top:4px' }, h('b', {}, '模型: '), isVideo ? 'veo-4-omni 视频' : 'gpt-image-2.5 图片'),
    );
    genBtn.disabled = !enoughImgs || !enoughCredits;
    genBtn.textContent = !enoughCredits
      ? '额度不足'
      : enoughImgs ? (isVideo ? '生成视频' : '生成图片') : `请先上传 ${needImages} 张图`;
  }

  // ---------- 生成与结果 ----------
  const resultZone = h('div', {});

  /** 组装生成请求体 (首次生成与「换一批」必须完全一致, 否则两次结果不可比) */
  function buildPayload() {
    const imageUrls = state.images.map((im) => im.url).filter((u) => u && !isMockUrl(u));
    return {
      templateId: tpl.id,
      slotValues: {
        ...state.slotValues,
        ...Object.fromEntries(Object.entries(state.texts).map(([k, v]) => [k, v || undefined])),
      },
      extraIdea: state.extraIdea,
      imageUrls,
      title: tpl.title,
      ...state.spec,
    };
  }

  async function generate() {
    if (genBtn.disabled) return;
    spendCredits(tpl.credits);
    genBtn.disabled = true;
    const gen = renderGenerating();
    resultZone.replaceChildren(gen.el);
    gen.el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const res = isVideo ? await api.generateVideo(buildPayload()) : await api.generateImage(buildPayload());
      pollTask(res.taskId, (st) => {
        gen.update(st);
        if (st.isFinal && st.status === 'completed') {
          refreshGen();
          renderResults(st.urls);
        } else if (st.isFinal && st.status === 'failed') {
          refundCredits(tpl.credits);
          refreshGen();
          renderFailure(st.error);
        }
      });
    } catch (e) {
      refundCredits(tpl.credits);
      refreshGen();
      toast(e.message, 'err');
      resultZone.replaceChildren();
    }
  }

  function renderGenerating() {
    const stages = isVideo ? VIDEO_STAGES : IMAGE_STAGES;
    const stageEls = stages.map((s) => h('div', { class: 'gen-stage-item' }, h('span', { class: 'st-ico' }, '○'), s));
    const bar = h('div', { class: 'progress-bar' }, h('i', { style: 'width:0%' }));
    const el = h('div', { style: 'margin-top:20px' },
      h('div', { class: 'card panel generating' },
        h('div', { class: 'spinner' }),
        h('div', { class: 'gen-stage' }, '交给系统, 正在替你拍摄…'),
        h('div', { class: 'gen-stage-list' }, stageEls),
        bar,
        h('div', { style: 'margin-top:16px;color:var(--ink-3);font-size:13px' }, isVideo ? '视频大约需要 3~8 分钟, 你可以先去忙别的' : '图片大约需要 1 分钟'),
      ),
    );
    return {
      el,
      update({ progress, stageIndex }) {
        bar.querySelector('i').style.width = `${Math.max(6, progress)}%`;
        stageEls.forEach((item, i) => {
          item.classList.toggle('done', i < stageIndex);
          item.classList.toggle('doing', i === stageIndex);
          item.querySelector('.st-ico').textContent = i < stageIndex ? '✓' : i === stageIndex ? '◉' : '○';
        });
      },
    };
  }

  function renderResults(urls) {
    const grid = h('div', { class: 'result-grid' },
      urls.map((url, i) => h('div', { class: `result-item ${isVideo ? 'video' : ''}` },
        isVideo ? h('video', { src: url, controls: true, playsinline: true }) : h('img', { src: url, alt: `结果 ${i + 1}` }),
        h('div', { class: 'pick' },
          h('a', { class: 'icon-btn', href: url, target: '_blank', rel: 'noopener', title: '下载/查看' }, icon('download', { size: 15 })),
        ),
      )),
    );
    // 首次「换一批」免费 —— 只有真的扣了额度, 失败时才需要退回
    const againFree = state.retryFree;
    const againBtn = h('button', {
      class: 'btn btn-ghost-green', 'data-tour': 'again-btn',
      onclick: async () => {
        const charged = !againFree;
        if (charged) spendCredits(tpl.credits);
        state.retryFree = false;
        againBtn.disabled = true;
        const gen = renderGenerating();
        resultZone.replaceChildren(gen.el);
        try {
          const res = isVideo ? await api.generateVideo(buildPayload()) : await api.generateImage(buildPayload());
          pollTask(res.taskId, (st) => {
            gen.update(st);
            if (st.isFinal && st.status === 'completed') { againBtn.disabled = false; renderResults(st.urls); }
            else if (st.isFinal) { if (charged) refundCredits(tpl.credits); againBtn.disabled = false; renderFailure(st.error); }
          });
        } catch (e) {
          if (charged) refundCredits(tpl.credits);
          againBtn.disabled = false;
          toast(e.message, 'err');
        }
      },
    }, `换一批${againFree ? '（首次免费）' : ` · 消耗 ${tpl.credits} 额度`}`);
    const zone = h('div', { style: 'margin-top:20px' },
      h('div', { class: 'section-head' },
        h('h2', {}, '生成完成'),
        h('span', { class: 'pill pill-soft' }, `已自动存入「我的作品」 · 消耗 ${tpl.credits} 额度`),
      ),
      grid,
      h('div', { style: 'display:flex;gap:12px;margin-top:16px' },
        againBtn,
        h('button', { class: 'btn btn-ghost', onclick: () => navigate('/works') }, '去「我的作品」看看 →'),
      ),
    );
    resultZone.replaceChildren(zone);
    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(isVideo ? '视频生成完成' : '图片生成完成', 'ok');
  }

  function renderFailure(errMsg) {
    resultZone.replaceChildren(h('div', { class: 'card panel', style: 'margin-top:20px;text-align:center' },
      h('div', { style: 'color:var(--ink-3)' }, icon('info', { size: 36 })),
      h('h3', { style: 'margin:8px 0' }, '这次拍摄失败了'),
      h('p', { style: 'color:var(--ink-2)' }, errMsg || '上游出了点小状况'),
      h('p', { class: 'guide-hint', style: 'justify-content:center' }, '额度已自动退回'),
      h('button', { class: 'btn btn-primary', onclick: generate }, '重试一次'),
    ));
  }

  // ---------- 组装 ----------
  refreshStepper();
  refreshGen();
  drawThumbs();
  const layout = h('div', { class: 'create-layout' },
    h('div', {}, uploadPanel, tunePanel),
    h('div', {}, sidePanel),
  );
  root.append(header, stepper, layout, resultZone);
}
