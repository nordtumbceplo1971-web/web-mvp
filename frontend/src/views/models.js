import { h, toast, fileToDataURI } from '../ui.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { getUserId } from '../userId.js';
import { openAddModelDialog } from './modelAddDialog.js';

export { getUserId };

/**
 * 模特库 (素材库 · 自定义模特)
 * - 系统模特: 11 位全局共享三视图模特
 * - 我的模特: 上传/管理自己的模特 (按 userId 隔离)
 */
export async function renderModels(root, { navigate, back }) {
  root.replaceChildren();
  const userId = getUserId();

  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => (back ?? (() => navigate('/')))(),
      'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#eff6ff;color:#2563eb' }, icon('user', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '模特库'),
      h('div', { class: 'ph-sub' }, '管理模特素材 · 系统 11 位共享 + 自定义模特 (按用户隔离)'),
    ),
  );

  // ---------- 系统模特 ----------
  const sysGrid = h('div', { class: 'models-grid' }, h('div', { class: 'home-loading' }, '加载中…'));
  const sysSection = h('div', { class: 'card panel' },
    h('div', { class: 'section-head', style: 'margin-top:0' },
      h('h2', { style: 'font-size:17px' }, '系统模特'),
      h('span', { class: 'pill pill-soft' }, '全局共享 · 三视图'),
    ),
    sysGrid,
  );

  // ---------- 我的模特 ----------
  const userGrid = h('div', { class: 'models-grid' });
  const userSection = h('div', { class: 'card panel' },
    h('div', { class: 'section-head', style: 'margin-top:0' },
      h('h2', { style: 'font-size:17px' }, '我的模特'),
      h('span', { class: 'pill pill-line' }, '仅自己可见'),
    ),
    h('div', { class: 'model-upload-bar' },
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => openUploadModal() }, icon('upload', { size: 15 }), '上传模特'),
      h('span', { class: 'desc', style: 'font-size:12px;color:var(--ink-3)' }, '支持正面/侧面/背面三视图上传, 正面图必填'),
    ),
    userGrid,
  );

  root.append(header, sysSection, userSection);

  // ---------- 加载数据 ----------
  let systemModels = [];
  let userModels = [];

  async function load() {
    try {
      const res = await fetch(`/api/models?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data?.error) throw new Error(data.error.message);
      systemModels = data.system ?? [];
      userModels = data.user ?? [];
      drawSys();
      drawUser();
    } catch (e) {
      sysGrid.replaceChildren();
      renderApiError(sysGrid, e, {
        resource: '模特库',
        onRetry: () => load(),
        backTo: { label: '去用户设置', href: '#/settings', onClick: () => navigate('/settings') },
      });
    }
  }

  function drawSys() {
    if (!systemModels.length) {
      sysGrid.replaceChildren(h('div', { class: 'empty-state' }, '暂无系统模特'));
      return;
    }
    sysGrid.replaceChildren(...systemModels.map((m) => modelCard(m, false)));
  }

  function drawUser() {
    const addCard = h('button', {
      class: 'model-card add-card', type: 'button',
      title: '上传模特图片, 或用想法让 AI 生成一个模特',
      onclick: () => openAddModelDialog({ onDone: () => load() }),
    },
      h('div', { class: 'model-cover add-cover' }, icon('plus', { size: 24 })),
      h('div', { class: 'model-body' },
        h('div', { class: 'model-name', style: 'text-align:center' }, '添加模特'),
        h('div', { class: 'model-desc', style: 'text-align:center' }, '上传图片 或 AI 生成'),
      ),
    );
    if (!userModels.length) {
      userGrid.replaceChildren(
        h('div', { class: 'empty-state', style: 'padding:30px' },
          h('div', { class: 'ico' }, icon('user', { size: 36 })),
          h('div', { style: 'margin-top:8px;color:var(--ink-2);font-weight:700' }, '还没有自定义模特'),
          h('div', { style: 'font-size:13px;margin-top:4px;color:var(--ink-3)' }, '上传或生成模特后可在 Shopify 套图等模板中使用'),
        ),
        addCard,
      );
      return;
    }
    userGrid.replaceChildren(...userModels.map((m) => modelCard(m, true)), addCard);
  }

  function modelCard(m, isUser) {
    return h('div', { class: 'card card-hover model-card' },
      h('div', { class: 'model-cover' },
        h('img', { src: m.cover, alt: m.name, loading: 'lazy' }),
        h('span', { class: 'pill pill-line model-badge' }, isUser ? '自定义' : '系统'),
      ),
      h('div', { class: 'model-body' },
        h('div', { class: 'model-name' }, m.name),
        m.desc ? h('div', { class: 'model-desc' }, m.desc) : null,
        h('div', { class: 'model-tags' }, ...(m.tags ?? []).slice(0, 4).map((t) => h('span', { class: 'pill pill-line' }, t))),
        h('div', { class: 'model-actions' },
          h('button', {
            class: 'btn btn-ghost btn-sm', title: '预览',
            onclick: () => previewModel(m),
          }, icon('image', { size: 14 }), '预览'),
          isUser
            ? h('button', {
              class: 'btn btn-danger-ghost btn-sm', title: '删除',
              onclick: async () => {
                if (!window.confirm(`确定删除「${m.name}」吗？`)) return;
                await fetch(`/api/models/${m.id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
                toast('已删除', 'ok');
                load();
              },
            }, icon('trash', { size: 14 }), '删除')
            : null,
        ),
      ),
    );
  }

  function previewModel(m) {
    const overlay = h('div', {
      class: 'tour-overlay', style: 'z-index:1000;cursor:pointer',
      onclick: () => overlay.remove(),
    },
      h('div', {
        style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);max-width:90vw;max-height:90vh;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)',
      },
        h('img', { src: m.cover, alt: m.name, style: 'max-width:100%;max-height:85vh;object-fit:contain' }),
        h('div', { style: 'padding:12px 16px;text-align:center;font-weight:700' }, m.name),
      ),
    );
    document.body.append(overlay);
  }

  // ---------- 上传模特弹窗 ----------
  function openUploadModal() {
    let frontFile = null; let sideFile = null; let backFile = null;
    const nameInput = h('input', { class: 'text-input', type: 'text', placeholder: '例: 我的模特 01', maxlength: 40 });
    const descInput = h('textarea', { class: 'text-input', rows: 2, placeholder: '模特描述 (选填), 例: 25岁欧美男性, 高挑苗条', maxlength: 200 });

    const thumb = (label, setter) => {
      const preview = h('div', { class: 'upload-thumb-empty' }, icon('plus', { size: 20 }));
      const input = h('input', {
        type: 'file', accept: 'image/*', style: 'display:none',
        onchange: async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const uri = await fileToDataURI(f);
          setter(f);
          preview.replaceChildren(h('img', { src: uri, alt: label }));
          preview.classList.add('has');
        },
      });
      const wrap = h('div', {
        class: 'upload-thumb-wrap', onclick: () => input.click(),
      }, preview, h('div', { class: 'upload-thumb-label' }, label), input);
      return wrap;
    };

    const form = h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'form-grid' },
        h('label', { class: 'field' }, h('span', { class: 'g-label' }, '模特名称'), nameInput),
      ),
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '模特描述 (选填)'), descInput),
      h('div', { class: 'g-label', style: 'margin-top:4px' }, '模特三视图'),
      h('div', { style: 'display:flex;gap:12px;justify-content:center' },
        thumb('正面 *', (f) => { frontFile = f; }),
        thumb('侧面', (f) => { sideFile = f; }),
        thumb('背面', (f) => { backFile = f; }),
      ),
    );

    const overlay = h('div', {
      class: 'tour-overlay', style: 'z-index:1000',
      onclick: (e) => { if (e.target === overlay) overlay.remove(); },
    },
      h('div', {
        style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:480px;max-width:92vw;background:#fff;border-radius:12px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3);cursor:default',
        onclick: (e) => e.stopPropagation(),
      },
        h('h2', { style: 'margin:0 0 16px;font-size:18px' }, '上传模特'),
        form,
        h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:18px' },
          h('button', { class: 'btn btn-ghost', onclick: () => overlay.remove() }, '取消'),
          h('button', {
            class: 'btn btn-primary',
            onclick: async () => {
              if (!frontFile) { toast('请选择正面图', 'err'); return; }
              const fd = new FormData();
              fd.append('front', frontFile);
              if (sideFile) fd.append('side', sideFile);
              if (backFile) fd.append('back', backFile);
              fd.append('name', nameInput.value.trim() || '未命名模特');
              fd.append('desc', descInput.value.trim());
              fd.append('userId', userId);
              try {
                const res = await fetch('/api/models', { method: 'POST', body: fd });
                const data = await res.json();
                if (data?.error) throw new Error(data.error.message);
                toast('模特上传成功', 'ok');
                overlay.remove();
                load();
              } catch (e) {
                toast(`上传失败: ${e.message}`, 'err');
              }
            },
          }, '上传'),
        ),
      ),
    );
    document.body.append(overlay);
  }

  await load();
}

/** 用户 ID 见 ../userId.js (模特库与套图页共用) */
