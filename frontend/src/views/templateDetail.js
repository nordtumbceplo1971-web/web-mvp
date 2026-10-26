import { h, toast } from '../ui.js';
import { api } from '../api.js';
import { renderApiError } from '../errors.js';
import { icon } from '../icons.js';
import { tplCover, KIND_LABEL } from '../tplMeta.js';

/**
 * 模板详情页 (独立路由 /templates/:id)
 * 顶部提供统一「返回上一页」, 可回到来源页 (模板库 / 首页 / 我的作品)
 */
export async function renderTemplateDetail(root, { navigate, params, back }) {
  root.replaceChildren();

  const tplId = params?.id;
  let tpl;
  try {
    tpl = await api.getTemplate(tplId);
  } catch (e) {
    root.append(
      h('div', { class: 'page-head' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => back() }, icon('arrow-left', { size: 15 }), '返回上一页'),
      ),
    );
    renderApiError(root, e, {
      resource: '模板',
      onRetry: () => navigate(`/templates/${tplId}`),
      backTo: { label: '回模板库', href: '#/templates', onClick: () => navigate('/templates') },
    });
    return;
  }

  const { iconName, tint, color } = tplCover(tpl);

  // ---- 顶部: 统一返回 + 标题 ----
  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => back(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: `background:${tint};color:${color}` }, icon(iconName, { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, tpl.title),
      h('div', { class: 'ph-sub' }, tpl.subtitle),
    ),
    h('span', { class: 'pill pill-line' }, KIND_LABEL[tpl.type]),
  );

  // ---- 准备信息 ----
  const facts = h('div', { class: 'card panel fact-card' },
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '你需要准备'), h('span', { class: 'v' }, tpl.needLabel)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '预计耗时'), h('span', { class: 'v' }, tpl.timeLabel)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '消耗额度'), h('span', { class: 'v' }, `${tpl.credits} 点`)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '所属类目'), h('span', { class: 'v' }, tpl.category)),
  );

  // ---- 提示词预览 ----
  const promptBox = h('div', { class: 'prompt-preview' }, '提示词加载中…');
  api.previewPrompt(tpl.id, {}).then((r) => {
    promptBox.textContent = r.prompt;
  }).catch(() => { promptBox.textContent = '(预览失败)'; });

  const promptPanel = h('div', { class: 'card panel' },
    h('h3', {}, '这张图会怎么拍（系统内部提示词，无需你编写）'),
    promptBox,
  );

  // ---- 微调项 ----
  const slotPanel = (tpl.slots ?? []).length
    ? h('div', { class: 'card panel' },
      h('h3', {}, '你可以点选的微调项'),
      h('div', { class: 'slot-list' },
        ...tpl.slots.map((s) => h('div', { class: 'slot-row' },
          h('span', { class: 'g-label' }, s.label),
          h('span', { class: 'slot-opts' },
            ...(s.options ?? []).map((o) => h('span', { class: 'opt-tag' },
              h('i', { class: 'sw', style: `background:${o.color}` }), o.label)),
            s.type === 'text' ? h('span', { class: 'opt-tag' }, s.placeholder || '可自由填写') : null,
          ),
        )),
      ),
    )
    : null;

  // ---- 使用建议 ----
  const tipsPanel = h('div', { class: 'card panel tip-panel' },
    h('h3', {}, '使用建议'),
    h('div', { class: 'guide-hint' }, tpl.tips),
  );

  // ---- CTA ----
  const isLookbook = tpl.id === 'shopify-lookbook';
  const cta = h('div', { class: 'card panel detail-cta' },
    h('div', {},
      h('div', { style: 'font-weight:700' }, '准备好产品图就可以开始了'),
      h('div', { class: 'desc' }, isLookbook
        ? '7 步出全套 Shopify 商品图 · 选择线路 a (AI 建模) 或线路 b (模特库)'
        : `消耗 ${tpl.credits} 额度 · 约 ${tpl.timeLabel} · 生成后自动存入「我的作品」`),
    ),
    h('button', {
      class: 'btn btn-primary btn-lg',
      onclick: () => navigate(isLookbook ? '/lookbook' : `/create?tpl=${tpl.id}`),
    }, isLookbook ? '开始出套图' : '做同款', icon('arrow-right', { size: 16 })),
  );

  root.append(
    header,
    h('div', { class: 'detail-layout' },
      h('div', {}, facts, promptPanel, slotPanel, tipsPanel),
      h('div', { class: 'detail-side' }, cta, relatedPanel(tpl, navigate)),
    ),
  );
}

/** 同类目其它模板 */
function relatedPanel(tpl, navigate) {
  const wrap = h('div', { class: 'card panel' }, h('h3', {}, '同类模板'));
  api.listTemplates().then(({ items }) => {
    const others = items.filter((t) => t.category === tpl.category && t.id !== tpl.id).slice(0, 4);
    if (!others.length) { wrap.replaceChildren(h('h3', {}, '同类模板'), h('div', { class: 'desc' }, '暂无其它同类模板')); return; }
    wrap.replaceChildren(
      h('h3', {}, '同类模板'),
      h('div', { class: 'related-list' },
        ...others.map((t) => {
          const c = tplCover(t);
          return h('button', {
            class: 'related-item', type: 'button',
            onclick: () => navigate(`/templates/${t.id}`),
          },
            h('span', { class: 'ri-ico', style: `background:${c.tint};color:${c.color}` }, icon(c.iconName, { size: 15 })),
            h('span', { class: 'ri-t' }, t.title),
            h('span', { class: 'pill pill-line' }, `${t.credits} 额度`),
          );
        }),
      ),
    );
  }).catch(() => { /* ignore */ });
  return wrap;
}
