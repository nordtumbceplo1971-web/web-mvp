import { h, toast, fileToDataURI, isMockUrl, pollTask, IMAGE_STAGES, VIDEO_STAGES } from './ui.js';
import { api } from './api.js';
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

  let busy = false;
  function close() {
    if (current?.modal !== modal) return;
    if (busy) toast('生成仍在继续, 稍后可在「我的作品」查看', 'ok');
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = prevOverflow;
    modal.remove();
    current = null;
  }
  current = { modal, close };

  // ---------- 表单阶段 ----------
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: needImages > 1, style: 'display:none' });
  fileInput.onchange = (e) => { addFiles(e.target.files); fileInput.value = ''; };

  const slotsWrap = h('div', { class: 'rf-slots' });
  function drawSlots() {
    const cells = [];
    for (let i = 0; i < needImages; i++) {
      const img = state.images[i];
      cells.push(img
        ? h('div', { class: 'rf-slot filled' },
            h('img', { src: img.dataUri, alt: img.name }),
            h('button', { class: 'rm', type: 'button', title: '移除', onclick: () => { state.images.splice(i, 1); drawSlots(); refreshCta(); } }, '✕'),
          )
        : h('button', { class: 'rf-slot', type: 'button', onclick: () => fileInput.click() },
            icon('upload', { size: 18 }), h('span', {}, needImages > 1 ? `图 ${i + 1}` : '产品图'),
          ));
    }
    slotsWrap.replaceChildren(...cells, fileInput);
    slotCount.textContent = `${state.images.length}/${needImages}`;
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, needImages - state.images.length);
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

  const slotCount = h('span', { class: 'rf-count' }, `0/${needImages}`);
  const formSections = [
    h('div', { class: 'rf-sec' },
      h('div', { class: 'rf-label' }, `${isVideo ? '首帧产品图' : '产品原图'} `, h('em', {}, '*'), slotCount),
      slotsWrap,
      tpl.needLabel ? h('div', { class: 'rf-hint' }, tpl.needLabel) : null,
    ),
    ...tpl.slots.map((slot) => slotGroup(slot)),
    h('div', { class: 'rf-sec' },
      h('div', { class: 'rf-label' }, '输出设置'),
      h('div', { class: 'rf-chips' }, (isVideo ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((a) => specChip('aspect_ratio', a, a))),
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
    const enoughImgs = state.images.length >= needImages;
    const enoughCredits = getCredits() >= tpl.credits;
    ctaHint.textContent = `本次消耗 ${tpl.credits} 额度 · 余额 ${getCredits()} · ${tpl.timeLabel} · 自动存入「我的作品」`;
    ctaBtn.disabled = !enoughImgs || !enoughCredits;
    ctaBtn.textContent = !enoughCredits ? '额度不足' : enoughImgs ? (isVideo ? '开始复刻 · 生成视频' : '开始复刻 · 生成图片') : `请先上传 ${needImages} 张图`;
  }

  function drawForm() {
    body.replaceChildren(
      h('div', { class: 'repl-preview' },
        preview?.video
          ? h('video', { src: preview.video, poster: preview.poster, controls: true, playsinline: true, preload: 'metadata' })
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
    spendCredits(tpl.credits);
    drawBusy({
      onDone: (urls) => drawDone(urls),
      onFail: (err) => { refundCredits(tpl.credits); drawForm(); toast(err || '这次复刻失败了, 额度已退回', 'err'); },
    });
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
    res.then((r) => pollTask(r.taskId, (st) => {
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
    const againBtn = h('button', { class: 'btn btn-ghost-green rf-cta', type: 'button', onclick: () => {
      const charged = !againFree;
      if (charged) spendCredits(tpl.credits);
      state.retryFree = false;
      againBtn.disabled = true;
      drawBusy({
        onDone: (u) => { againBtn.disabled = false; drawDone(u); },
        onFail: (err) => { if (charged) refundCredits(tpl.credits); againBtn.disabled = false; toast(err || '失败了, 额度已退回', 'err'); },
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
