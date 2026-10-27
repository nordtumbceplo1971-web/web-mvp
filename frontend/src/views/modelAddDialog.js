import { h, toast, fileToDataURI } from '../ui.js';
import { icon } from '../icons.js';
import { getUserId } from '../userId.js';

/**
 * 添加模特弹窗 (上传图片 / AI 生成 二选一)
 * 两种方式最终都会把模特存进「我的模特」(按 userId 隔离), 并回传新建的模特对象。
 *
 * @param {{ onDone: (model) => void }} opts
 */
export function openAddModelDialog({ onDone } = {}) {
  const userId = getUserId();
  let tab = 'upload'; // upload | generate

  const nameInput = h('input', { class: 'text-input', type: 'text', placeholder: '例: 我的模特 01', maxlength: 40 });
  const descInput = h('textarea', { class: 'text-input', rows: 2, placeholder: '模特描述 (选填), 例: 25岁欧美男性, 高挑健硕', maxlength: 200 });
  const ideaInput = h('textarea', {
    class: 'text-input', rows: 3,
    placeholder: '描述你想要的模特形象, 例: 20岁左右的欧美白皮年轻男性, 身材苗条高挑, 金发碧眼, 潮牌街头气质',
  });

  let frontFile = null;
  let previewUrl = null;

  const uploadBox = h('div', { class: 'upload-thumb-empty', style: 'width:100%;height:150px' },
    h('div', { style: 'text-align:center' },
      h('div', { style: 'margin-bottom:6px' }, icon('upload', { size: 22 })),
      h('div', { style: 'font-size:13px;font-weight:600' }, '点击选择模特正面图'),
      h('div', { style: 'font-size:11px;color:var(--ink-3);margin-top:2px' }, 'JPG / PNG / WebP'),
    ));
  const fileInput = h('input', {
    type: 'file', accept: 'image/*', style: 'display:none',
    onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      frontFile = f;
      previewUrl = await fileToDataURI(f);
      uploadBox.replaceChildren(h('img', { src: previewUrl, alt: '模特预览', style: 'width:100%;height:100%;object-fit:cover' }));
    },
  });
  uploadBox.addEventListener('click', () => fileInput.click());

  const genStatus = h('div', { class: 'conn-tip' });
  const genPreview = h('div', { style: 'margin-top:8px' });

  const tabBtn = (id, label, iconName) => h('button', {
    class: `chip ${tab === id ? 'active' : ''}`, type: 'button',
    onclick: () => {
      tab = id;
      [...overlay.querySelectorAll('.chip')].forEach((c) => c.classList.toggle('active', c.textContent.trim() === label));
      renderBody();
    },
  }, icon(iconName, { size: 14 }), label);

  const body = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });

  const submitBtn = h('button', {
    class: 'btn btn-primary',
    onclick: () => (tab === 'upload' ? uploadModel() : generateModel()),
  }, '上传');

  function renderBody() {
    submitBtn.textContent = tab === 'upload' ? '上传' : '生成模特';
    body.replaceChildren(
      h('div', { class: 'form-grid' },
        h('label', { class: 'field' }, h('span', { class: 'g-label' }, '模特名称'), nameInput),
      ),
      tab === 'upload'
        ? h('div', {},
          h('div', { class: 'g-label', style: 'margin-bottom:6px' }, '模特正面图 *'),
          uploadBox, fileInput,
          h('label', { class: 'field', style: 'margin-top:12px' }, h('span', { class: 'g-label' }, '模特描述 (选填)'), descInput),
        )
        : h('div', {},
          h('div', { class: 'g-label', style: 'margin-bottom:6px' }, '你想要什么样的模特 *'),
          ideaInput,
          h('div', { class: 'desc', style: 'font-size:11.5px;margin-top:4px' }, 'AI 会按你的描述生成一张模特形象参考图 (正面全身 · 浅灰背景 · 纯色基础款)'),
          genStatus, genPreview,
        ),
    );
  }
  renderBody();

  // ---------- AI 生成 ----------
  async function generateModel() {
    const idea = ideaInput.value.trim();
    if (!idea) { toast('请描述你想要的模特形象', 'err'); return; }
    genStatus.className = 'conn-tip';
    genStatus.replaceChildren('正在生成模特形象… (约 30-60 秒)');
    genPreview.replaceChildren();
    try {
      const res = await fetch('/api/models/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, userId, name: nameInput.value.trim() || 'AI 生成模特' }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error.message);

      // 轮询任务
      const url = await new Promise((resolve, reject) => {
        let tries = 0;
        const timer = setInterval(async () => {
          tries += 1;
          if (tries > 60) { clearInterval(timer); reject(new Error('生成超时')); return; }
          try {
            const t = await (await fetch(`/api/tasks/${encodeURIComponent(data.taskId)}`)).json();
            if (t?.is_final) {
              clearInterval(timer);
              if (t.status === 'completed' && t.data?.length) resolve(t.data[0].url);
              else reject(new Error(t?.error?.message || '生成失败'));
            }
          } catch (e) { clearInterval(timer); reject(e); }
        }, 5000);
      });

      // 存进我的模特库 (公网 URL 直存)
      const saveRes = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: nameInput.value.trim() || `AI 模特 ${new Date().toLocaleDateString('zh-CN')}`,
          desc: idea,
          frontUrl: url,
        }),
      });
      const model = await saveRes.json();
      if (model?.error) throw new Error(model.error.message);
      genStatus.className = 'conn-tip ok';
      genStatus.replaceChildren('✓ 已生成并存入「我的模特」');
      genPreview.replaceChildren(h('img', { src: url, alt: '生成的模特', style: 'max-width:180px;border-radius:8px;border:1px solid var(--line)' }));
      toast('模特生成成功', 'ok');
      overlay.remove();
      onDone?.(model);
    } catch (e) {
      genStatus.className = 'conn-tip bad';
      genStatus.replaceChildren(`✗ ${e.message}`);
    }
  }

  // ---------- 上传 ----------
  async function uploadModel() {
    if (!frontFile) { toast('请选择模特正面图', 'err'); return; }
    const fd = new FormData();
    fd.append('front', frontFile);
    fd.append('name', nameInput.value.trim() || '未命名模特');
    fd.append('desc', descInput.value.trim());
    fd.append('userId', userId);
    try {
      const res = await fetch('/api/models', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.error) throw new Error(data.error.message);
      toast('模特已加入「我的模特」', 'ok');
      overlay.remove();
      onDone?.(data);
    } catch (e) {
      toast(`上传失败: ${e.message}`, 'err');
    }
  }

  const overlay = h('div', {
    class: 'tour-overlay', style: 'z-index:1000',
    onclick: (e) => { if (e.target === overlay) overlay.remove(); },
  },
    h('div', {
      style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:520px;max-width:94vw;max-height:88vh;overflow:auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3);cursor:default',
      onclick: (e) => e.stopPropagation(),
    },
      h('h2', { style: 'margin:0 0 14px;font-size:18px' }, '添加模特'),
      h('div', { class: 'chip-row', style: 'margin-bottom:14px' },
        tabBtn('upload', '上传图片', 'upload'),
        tabBtn('generate', 'AI 生成', 'sparkles'),
      ),
      body,
      h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:18px' },
        h('button', { class: 'btn btn-ghost', onclick: () => overlay.remove() }, '取消'),
        submitBtn,
      ),
    ),
  );

  document.body.append(overlay);
  return { close: () => overlay.remove() };
}
