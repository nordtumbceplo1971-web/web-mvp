import { h, toast, fileToDataURI, isMockUrl, IMAGE_STAGES, VIDEO_STAGES, aspectShape } from './ui.js';
import { api } from './api.js';
import { sharedPoller } from './poller.js';
import { getCredits, spendCredits, refundCredits } from './store.js';
import { IMAGE_ASPECTS, VIDEO_ASPECTS, resolveAspect } from './aspect.js';
import { tplPreview, KIND_LABEL } from './tplMeta.js';
import { icon } from './icons.js';

/**
 * 一键复刻弹窗 (对标 designkit.cn 复刻面板)
 *
 * 交互原则:
 *   - 不跳页 —— 在卡片/详情页原地弹窗, 用户始终停留在浏览上下文
 *   - 左预览右表单 —— 一眼看到「同款效果」, 右侧只做必要输入
 *   - 生成/结果也在弹窗内闭环 —— 完成即出图, 「换一批」不离开面板
 *   - 自定义设置保留: 图片比例 / 分辨率 / 张数 (原 create 页能力)
 *
 * 入口统一走 startReplicate(tplOrId, { navigate }):
 *   lookbook 多步骤模板仍跳专属流程页, 其余模板打开本弹窗。
 */

let current = null; // 同时只允许一个复刻弹窗

export async function startReplicate(tplOrId, { navigate }) {
  let tpl = tplOrId;
  if (typeof tplOrId === 'string') {
    try { tpl = await api.getTemplate(tplOrId); }
    catch (e) { toast(`模板加载失败: ${e.message}`, 'err'); return; }
  }
  if (tpl.isLookbook) { navigate('/lookbook'); return; }
  openReplicateModal(tpl, { navigate });
}

export function openReplicateModal(tpl, { navigate }) {
  current?.close();

  const isVideo = tpl.type === 'video';
  const needImages = tpl.needImages ?? 1;
  const preview = tplPreview(tpl);
  // 批量模式: 模板声明 batch.enabled → 允许一次上传多张, 每张各生成一条请求
  const batch = tpl.batch?.enabled ? { max: tpl.batch.max ?? 10 } : null;
  const maxImages = batch ? batch.max : needImages;

  const state = {
    images: [],
    slotValues: {},
    texts: {},
    extraIdea: '',
    spec: { ...(isVideo
      ? { aspect_ratio: tpl.defaults.aspect_ratio, resolution: tpl.defaults.resolution, duration: 10, mode: tpl.defaults.mode ?? 'first-frame' }
      : { aspect_ratio: resolveAspect(tpl), resolution: tpl.defaults.resolution, count: tpl.defaults.count, quality: tpl.defaults.quality }) },
    retryFree: true,
  };
  for (const s of tpl.slots) {
    if (s.type === 'text') state.texts[s.key] = '';
    else state.slotValues[s.key] = s.options?.[0]?.value ?? '';
  }

  // ---------- 弹窗骨架 ----------
  const mask = h('div', { class: 'repl-mask', role: 'dialog', 'aria-modal': 'true', 'aria-label': `一键复刻 ${tpl.title}` });
  const body = h('div', { class: 'repl-body' });
  const modal = h('div', { class: 'repl-modal' },
    h('button', { class: 'repl-x', type: 'button', 'aria-label': '关闭', onclick: () => close() }, '✕'),
    body,
  );
  mask.append(modal);
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) close(); });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.append(mask);

  /**
   * 预览栏宽度自适应素材比例:
   * 素材加载后按真实宽高比定左栏宽 (横版宽栏 / 竖版窄栏), 弹窗整体随之自适应,
   * 素材完整显示不裁切。竖版素材上限 336px (避免右表单被挤太窄)。
   */
  function fitPreviewWidth(src, isVideoEl) {
    const probe = isVideoEl ? document.createElement('video') : new Image();
    probe.preload = 'metadata';
    const apply = (ar) => {
      if (!Number.isFinite(ar) || ar <= 0) return;
      const availH = Math.min(window.innerHeight - 56, 860) - 28; // 预览可视高 - padding
      const w = Math.round(Math.min(availH * ar, 560));           // 宽上限 560
      modal.style.setProperty('--repl-pw', `${Math.max(280, w)}px`);
    };
    if (isVideoEl) {
      probe.onloadedmetadata = () => apply(probe.videoWidth / probe.videoHeight);
    } else {
      probe.onload = () => apply(probe.naturalWidth / probe.naturalHeight);
      probe.onerror = () => {};
    }
    probe.src = src;
  }

  let busy = false;
  function close() {
    if (current?.modal !== modal) return;
    if (busy) toast('生成仍在继续, 稍后可在「我的作品」查看', 'ok');
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = prevOverflow;
    mask.remove(); // 必须移除整个遮罩 (modal 只是其子节点), 否则 blur 蒙层残留
    current = null;
  }
  current = { modal, close };

  // ---------- 表单阶段 ----------
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: maxImages > 1, style: 'display:none' });
  fileInput.onchange = (e) => { addFiles(e.target.files); fileInput.value = ''; };

  const slotsWrap = h('div', { class: 'rf-slots' });
  function drawSlots() {
    const cells = [];
    // 已上传的图 (批量模式可多于 needImages)
    for (let i = 0; i < state.images.length; i++) {
      const img = state.images[i];
      cells.push(h('div', { class: 'rf-slot filled' },
        h('img', { src: img.dataUri, alt: img.name }),
        h('button', { class: 'rm', type: 'button', title: '移除', onclick: () => { state.images.splice(i, 1); drawSlots(); refreshCta(); } }, '✕'),
      ));
    }
    // 添加槽: 批量模式按 maxImages, 单图模式按 needImages
    const canAdd = batch ? state.images.length < batch.max : state.images.length < needImages;
    if (canAdd) {
      cells.push(h('button', { class: 'rf-slot', type: 'button', onclick: () => fileInput.click() },
        icon('upload', { size: 18 }),
        h('span', {}, batch ? `再加一张 (${state.images.length}/${batch.max})` : (needImages > 1 ? `图 ${state.images.length + 1}` : '产品图')),
      ));
    }
    slotsWrap.replaceChildren(...cells, fileInput);
    slotCount.textContent = batch
      ? `${state.images.length}/${batch.max} 张`
      : `${state.images.length}/${needImages}`;
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, maxImages - state.images.length);
    for (const file of files) {
      const dataUri = await fileToDataURI(file);
      const item = { dataUri, url: null, name: file.name };
      state.images.push(item);
      drawSlots();
      refreshCta();
      try {
        item.url = (await api.upload(file)).url;
      } catch (e) {
        toast(`「${file.name}」上传失败: ${e.message}`, 'err');
        state.images = state.images.filter((x) => x !== item);
        drawSlots();
        refreshCta();
      }
    }
  }

  const slotCount = h('span', { class: 'rf-count' }, batch ? `0/${batch.max} 张` : `0/${needImages}`);
  const formSections = [
    h('div', { class: 'rf-sec' },
      h('div', { class: 'rf-label' }, `${isVideo ? '首帧产品图' : (batch ? '产品原图 (可多张)' : '产品原图')} `, batch ? null : h('em', {}, '*'), slotCount),
      slotsWrap,
      tpl.needLabel ? h('div', { class: 'rf-hint' }, batch ? `${tpl.needLabel} · 多张上传时每张各生成一条请求` : tpl.needLabel) : null,
    ),
    ...tpl.slots.map((slot) => slotGroup(slot)),
    h('div', { class: 'rf-sec' },
      h('div', { class: 'rf-label' }, '输出设置'),
      // 比例 chips 带形状图标: 横竖构图一眼看懂
      h('div', { class: 'rf-chips' }, (isVideo ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((a) => {
        const btn = h('button', {
          class: `spec-chip ${String(state.spec.aspect_ratio) === a ? 'active' : ''}`, type: 'button',
          onclick: () => {
            state.spec.aspect_ratio = a;
            [...btn.parentElement.children].forEach((c) => c.classList.remove('active'));
            btn.classList.add('active');
          },
        }, aspectShape(a), a);
        return btn;
      })),
      h('div', { class: 'rf-chips' }, isVideo
        ? [h('span', { class: 'spec-chip locked', title: 'veo-4-omni 固定 10 秒' }, '10 秒'), h('span', { style: 'width:6px' }), ...['720p', '1080p'].map((r) => specChip('resolution', r, r))]
        : [...[1, 2, 4].map((c) => specChip('count', `${c} 张`, c)), h('span', { style: 'width:6px' }), ...['2K', '4K'].map((r) => specChip('resolution', r, r))]),
    ),
    h('div', { class: 'rf-sec' },
      h('div', { class: 'rf-label' }, '描述你的想法 (可选)'),
      h('textarea', {
        class: 'text-input rf-idea', rows: 2, placeholder: '例: 想要更亮一点 / 突出水珠 / 带点高级感…',
        oninput: (e) => { state.extraIdea = e.target.value; },
      }),
    ),
  ];

  function slotGroup(slot) {
    if (slot.type === 'text') {
      const input = h('input', {
        class: 'text-input', placeholder: slot.placeholder || '填一下', value: state.texts[slot.key] ?? '',
        oninput: (e) => { state.texts[slot.key] = e.target.value; },
      });
      return h('div', { class: 'rf-sec' }, h('div', { class: 'rf-label' }, slot.label), input);
    }
    const dots = slot.options.map((opt) => {
      const btn = h('button', {
        class: `opt-dot ${state.slotValues[slot.key] === opt.value ? 'active' : ''}`, type: 'button',
        onclick: () => {
          state.slotValues[slot.key] = opt.value;
          [...btn.parentElement.children].forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
        },
      }, h('span', { class: 'sw', style: `background:${opt.color}` }), opt.label);
      return btn;
    });
    return h('div', { class: 'rf-sec' }, h('div', { class: 'rf-label' }, slot.label), h('div', { class: 'opt-row' }, dots));
  }

  function specChip(key, label, value) {
    const btn = h('button', {
      class: `spec-chip ${String(state.spec[key]) === String(value) ? 'active' : ''}`, type: 'button',
      onclick: () => {
        state.spec[key] = value;
        [...btn.parentElement.children].forEach((c) => { if (c.classList.contains('spec-chip')) c.classList.remove('active'); });
        btn.classList.add('active');
      },
    }, label);
    return btn;
  }

  const ctaHint = h('div', { class: 'rf-sum' });
  const ctaBtn = h('button', { class: 'btn btn-primary btn-lg rf-cta', type: 'button', onclick: () => generate() }, '开始复刻');

  function refreshCta() {
    // 批量模式: 张数 = 已上传图数, 每张一条请求 → 消耗按张数计
    const units = batch ? Math.max(state.images.length, 1) : 1;
    const totalCost = tpl.credits * units;
    const enoughImgs = batch ? state.images.length >= 1 : state.images.length >= needImages;
    const enoughCredits = getCredits() >= totalCost;
    ctaHint.textContent = batch
      ? `批量生成 ${state.images.length} 张 · 每张 1 条请求 · 消耗 ${totalCost} 额度 · 余额 ${getCredits()} · ${tpl.timeLabel} · 自动存入「我的作品」`
      : `本次消耗 ${tpl.credits} 额度 · 余额 ${getCredits()} · ${tpl.timeLabel} · 自动存入「我的作品」`;
    // 额度不足不置灰死: 点击直接去充值 (转化路径, 路线图 1.1.2)
    ctaBtn.disabled = !enoughImgs;
    ctaBtn.classList.toggle('rf-cta-recharge', !enoughCredits && enoughImgs);
    ctaBtn.textContent = !enoughImgs ? (batch ? '请先上传产品图' : `请先上传 ${needImages} 张图`)
      : !enoughCredits ? '额度不足 · 去充值'
      : batch ? `批量生成 ${state.images.length} 张`
      : isVideo ? '开始复刻 · 生成视频' : '开始复刻 · 生成图片';
  }

  function drawForm() {
    // 预览栏宽度跟随素材比例 (16:9 宽栏 / 2:3 窄栏), 素材完整显示
    const mediaSrc = preview?.video || preview?.src || null;
    if (mediaSrc) fitPreviewWidth(mediaSrc, !!preview?.video);
    body.replaceChildren(
      h('div', { class: 'repl-preview' },
        preview?.video
          ? h('video', { class: 'rp-video', src: preview.video, poster: preview.poster, controls: true, playsinline: true, preload: 'metadata' })
          : preview
            ? h('img', { src: preview.src, alt: preview.alt || tpl.title })
            : h('div', { class: 'rp-art' }, icon('image', { size: 40 })),
        h('span', { class: 'pill pill-line rp-kind' }, KIND_LABEL[tpl.type]),
      ),
      h('div', { class: 'repl-form' },
        h('div', { class: 'rf-head' },
          h('h2', {}, tpl.title),
          h('div', { class: 'rf-sub' }, tpl.subtitle),
        ),
        ...formSections,
        ctaBtn, ctaHint,
      ),
    );
    drawSlots();
    refreshCta();
  }

  // ---------- 生成阶段 ----------
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

  function generate() {
    if (ctaBtn.disabled) return;
    if (batch) { generateBatch(); return; }
    if (getCredits() < tpl.credits) { close(); navigate('/recharge'); return; }
    const meta = { label: `复刻 · ${tpl.title}`, model: isVideo ? 'veo-4-omni' : 'gpt-image-2.5' };
    spendCredits(tpl.credits, meta);
    drawBusy({
      onDone: (urls) => drawDone(urls),
      onFail: (err) => { refundCredits(tpl.credits, { ...meta, label: `退回 · ${tpl.title}` }); drawForm(); toast(err || '这次复刻失败了, 额度已退回', 'err'); },
    });
  }

  /**
   * 批量生成: 每张产品图一条独立请求
   * - 提交: POST /api/generate/image-batch (后端并发上限 3, 单张失败不影响其它)
   * - 轮询: 共享调度器 (5s/轮, 轮内错峰 150ms) —— N 个任务不会形成请求尖峰
   * - 计费: 按张数扣; 失败的那几张按张退回
   */
  async function generateBatch() {
    const imageUrls = state.images.map((im) => im.url).filter((u) => u && !isMockUrl(u));
    if (!imageUrls.length) { toast('请先上传产品图', 'err'); return; }
    const n = imageUrls.length;
    const totalCost = tpl.credits * n;
    if (getCredits() < totalCost) { close(); navigate('/recharge'); return; }
    const meta = { label: `批量复刻 · ${tpl.title}`, model: 'gpt-image-2.5' };
    spendCredits(totalCost, meta);

    busy = true;
    const bar = h('div', { class: 'progress-bar' }, h('i', { style: 'width:4%' }));
    const counter = h('div', { class: 'gen-stage' }, `已提交 0/${n} 张 · 完成 0 张`);
    body.replaceChildren(
      h('div', { class: 'repl-busy' },
        h('div', { class: 'spinner' }),
        counter,
        bar,
        h('div', { class: 'rb-note' }, `每张一条请求 · 并发 3 · 预计 ${tpl.timeLabel} / 张 · 可关闭弹窗, 完成后到「我的作品」查看`),
      ),
    );

    let res;
    try {
      res = await api.generateImageBatch({ ...buildPayload(), imageUrls });
    } catch (e) {
      busy = false;
      refundCredits(totalCost, { ...meta, label: `退回 · ${tpl.title}` });
      drawForm();
      toast(e.message || '批量提交失败, 额度已退回', 'err');
      return;
    }

    const tasks = (res.tasks ?? []).filter((t) => t.taskId);
    const submitted = tasks.length;
    const failedSubmit = n - submitted;
    counter.textContent = `已提交 ${submitted}/${n} 张 · 完成 0 张`;
    if (!tasks.length) {
      busy = false;
      refundCredits(totalCost, { ...meta, label: `退回 · ${tpl.title}` });
      drawForm();
      toast('批量提交全部失败, 额度已退回', 'err');
      return;
    }

    // 结果收集: taskId → { urls, error }
    const results = new Map(tasks.map((t) => [t.taskId, { index: t.index, urls: [], error: null }]));
    let doneCount = 0;
    let failedCount = 0;
    const allUrls = [];

    for (const t of tasks) {
      sharedPoller.add(t.taskId, (st) => {
        const rec = results.get(t.taskId);
        if (!rec) return;
        if (st.isFinal) {
          if (st.status === 'completed') {
            rec.urls = st.urls;
            allUrls.push(...st.urls);
            doneCount += 1;
          } else {
            rec.error = st.error || '生成失败';
            failedCount += 1;
          }
          const pct = Math.round(((doneCount + failedCount) / submitted) * 100);
          bar.querySelector('i').style.width = `${Math.max(4, pct)}%`;
          counter.textContent = `已提交 ${submitted}/${n} 张 · 完成 ${doneCount} 张${failedCount ? ` · 失败 ${failedCount} 张` : ''}`;
          if (doneCount + failedCount >= submitted) {
            busy = false;
            // 失败的张数按张退回
            if (failedCount + failedSubmit > 0) {
              refundCredits(tpl.credits * (failedCount + failedSubmit), { ...meta, label: `退回 · ${tpl.title}` });
            }
            if (doneCount > 0) drawBatchDone(allUrls, { submitted, done: doneCount, failed: failedCount + failedSubmit });
            else { drawForm(); toast('批量生成全部失败, 额度已退回', 'err'); }
          }
        }
      });
    }
  }

  /** 批量结果: 结果网格 + 逐张预览 (与单张 drawDone 区分) */
  function drawBatchDone(urls, stat) {
    const grid = h('div', { class: 'result-grid' },
      urls.map((url, i) => h('div', { class: 'result-item' },
        h('img', { src: url, alt: `批量结果 ${i + 1}` }),
        h('div', { class: 'pick' },
          h('a', { class: 'icon-btn', href: url, target: '_blank', rel: 'noopener', title: '下载/查看' }, icon('download', { size: 15 })),
        ),
      )),
    );
    body.replaceChildren(
      h('div', { class: 'repl-done' },
        h('div', { class: 'rd-head' },
          h('h2', {}, '批量生成完成'),
          h('span', { class: 'pill pill-soft' }, `成功 ${stat.done} 张${stat.failed ? ` · 失败 ${stat.failed} 张` : ''} · 已存入「我的作品」`),
        ),
        grid,
        h('div', { class: 'rd-actions' },
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { close(); navigate('/works'); } }, '去「我的作品」看看 →'),
          h('button', { class: 'btn btn-ghost-green rf-cta', type: 'button', onclick: () => { state.retryFree = false; drawForm(); } }, '再来一批'),
        ),
      ),
    );
  }

  function drawBusy({ onDone, onFail }) {
    busy = true;
    const stages = isVideo ? VIDEO_STAGES : IMAGE_STAGES;
    const stageEls = stages.map((s) => h('div', { class: 'gen-stage-item' }, h('span', { class: 'st-ico' }, '○'), s));
    const bar = h('div', { class: 'progress-bar' }, h('i', { style: 'width:0%' }));
    body.replaceChildren(
      h('div', { class: 'repl-busy' },
        h('div', { class: 'spinner' }),
        h('div', { class: 'gen-stage' }, `正在复刻「${tpl.title}」…`),
        h('div', { class: 'gen-stage-list' }, stageEls),
        bar,
        h('div', { class: 'rb-note' }, isVideo ? '视频大约需要 3~8 分钟, 你可以先去忙别的' : '图片大约需要 1 分钟'),
      ),
    );
    const res = isVideo ? api.generateVideo(buildPayload()) : api.generateImage(buildPayload());
    // 共享调度器: 与其它任务共用一个 5s 时钟, 避免多任务时请求尖峰
    res.then((r) => sharedPoller.add(r.taskId, (st) => {
      bar.querySelector('i').style.width = `${Math.max(6, st.progress)}%`;
      stageEls.forEach((item, i) => {
        item.classList.toggle('done', i < st.stageIndex);
        item.classList.toggle('doing', i === st.stageIndex);
        item.querySelector('.st-ico').textContent = i < st.stageIndex ? '✓' : i === st.stageIndex ? '◉' : '○';
      });
      if (st.isFinal && st.status === 'completed') { busy = false; onDone(st.urls); }
      else if (st.isFinal) { busy = false; onFail(st.error); }
    })).catch((e) => { busy = false; onFail(e.message); });
  }

  // ---------- 结果阶段 ----------
  function drawDone(urls) {
    const grid = h('div', { class: 'result-grid' },
      urls.map((url, i) => h('div', { class: `result-item ${isVideo ? 'video' : ''}` },
        isVideo ? h('video', { src: url, controls: true, playsinline: true }) : h('img', { src: url, alt: `复刻结果 ${i + 1}` }),
        h('div', { class: 'pick' },
          h('a', { class: 'icon-btn', href: url, target: '_blank', rel: 'noopener', title: '下载/查看' }, icon('download', { size: 15 })),
        ),
      )),
    );
    const againFree = state.retryFree;
    const againMeta = { label: `复刻换一批 · ${tpl.title}`, model: isVideo ? 'veo-4-omni' : 'gpt-image-2.5' };
    const againBtn = h('button', { class: 'btn btn-ghost-green rf-cta', type: 'button', onclick: () => {
      const charged = !againFree;
      if (charged) spendCredits(tpl.credits, againMeta);
      state.retryFree = false;
      againBtn.disabled = true;
      drawBusy({
        onDone: (u) => { againBtn.disabled = false; drawDone(u); },
        onFail: (err) => { if (charged) refundCredits(tpl.credits, { ...againMeta, label: `退回 · ${tpl.title}` }); againBtn.disabled = false; toast(err || '失败了, 额度已退回', 'err'); },
      });
    } }, `换一批${againFree ? ' (首次免费)' : ` · ${tpl.credits} 额度`}`);
    body.replaceChildren(
      h('div', { class: 'repl-done' },
        h('div', { class: 'rd-head' },
          h('h2', {}, '复刻完成'),
          h('span', { class: 'pill pill-soft' }, `已存入「我的作品」 · 消耗 ${tpl.credits} 额度`),
        ),
        grid,
        h('div', { class: 'rd-actions' },
          againBtn,
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { close(); navigate('/works'); } }, '去「我的作品」看看 →'),
        ),
      ),
    );
    toast(isVideo ? '视频复刻完成' : '图片复刻完成', 'ok');
  }

  drawForm();
}
