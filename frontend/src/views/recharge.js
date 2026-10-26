import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { getCredits, addCredits } from '../store.js';

/** 充值页: 购买额度 (MVP 演示: 本地钱包即时到账, 不接入真实支付) */
const PACKAGES = [
  { id: 'p100', name: '体验包', credits: 100, price: 19, desc: '够做 50 张主图', tag: null },
  { id: 'p300', name: '标准包', credits: 300, price: 49, desc: '够做一整套上新', tag: '最受欢迎' },
  { id: 'p1000', name: '专业包', credits: 1000, price: 149, desc: '批量上新 / 含视频', tag: '省 20%' },
];

export function renderRecharge(root, { navigate, back }) {
  root.replaceChildren();

  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => back(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#eff4ff;color:var(--brand)' }, icon('credit-card', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '充值额度'),
      h('div', { class: 'ph-sub' }, '额度用于生图、改图与视频生成 —— 每次生成前都会显示消耗, 不会用超'),
    ),
  );

  const balance = h('span', { class: 'v' }, String(getCredits()), h('small', {}, '点'));
  const balanceCard = h('div', { class: 'card panel balance-card' },
    h('div', {},
      h('span', { class: 'k' }, '当前余额'),
      balance,
    ),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/settings') }, icon('settings', { size: 14 }), '用户设置'),
  );

  const grid = h('div', { class: 'pkg-grid' },
    ...PACKAGES.map((p) => h('button', {
      class: `pkg-card${p.tag ? ' hot' : ''}`, type: 'button',
      onclick: () => {
        const next = addCredits(p.credits);
        balance.replaceChildren(String(next), h('small', {}, '点'));
        toast(`充值成功, 到账 ${p.credits} 额度`, 'ok');
      },
    },
      p.tag ? h('span', { class: 'pkg-tag' }, p.tag) : null,
      h('span', { class: 'pkg-name' }, p.name),
      h('span', { class: 'pkg-credits' }, String(p.credits), h('small', {}, ' 额度')),
      h('span', { class: 'pkg-desc' }, p.desc),
      h('span', { class: 'pkg-price' }, h('b', {}, `¥${p.price}`), ' 购买'),
    )),
  );

  const note = h('div', { class: 'card panel' },
    h('h3', {}, '说明'),
    h('ul', { class: 'note-list' },
      h('li', {}, 'MVP 演示环境: 充值即时写入本地钱包, 不产生真实交易, 刷新页面仍保留。'),
      h('li', {}, '图片类模板每次 2 额度起, 视频类模板额度更高, 生成按钮上会再次确认。'),
      h('li', {}, '生成失败会自动退回额度, 「换一批」首次免费。'),
      h('li', {}, '正式接入支付后, 本页将改为真实下单流程。'),
    ),
  );

  root.append(
    header,
    h('div', { class: 'recharge-layout' },
      h('div', {}, balanceCard, h('div', { class: 'section-head' }, h('h2', {}, '选择额度包'), h('span', { class: 'desc' }, '演示环境即时到账')),
      grid,
      note),
      h('div', { class: 'recharge-side' },
        h('div', { class: 'card panel' },
          h('h3', {}, '额度怎么花'),
          h('div', { class: 'usage-list' },
            h('div', {}, h('b', {}, '图片模板'), h('span', {}, '2 额度 / 次')),
            h('div', {}, h('b', {}, '视频模板'), h('span', {}, '8 额度 / 次')),
            h('div', {}, h('b', {}, '自由工作台'), h('span', {}, '2 额度 / 张')),
          ),
        ),
      ),
    ),
  );
}
