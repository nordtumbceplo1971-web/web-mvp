import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { getCredits, addCredits, getLedger, clearLedger, getMembership, setMembership } from '../store.js';

/**
 * 价格与充值页 (路线图 1.1.1 / 1.1.2 / 1.1.3 / 1.1.4)
 *
 * 对标要求 (AI绘画/美图):
 *   - 档位明确标注 单张成本 / 额度有效期 / 是否自动续费 / 超额计费
 *   - 「不会自动扣款」必须写死在页面上 —— 信任是第一转化要素
 *   - 会员分层差异放在: 高清导出 / 无水印 / 商用授权 / 批量折扣 / 专属模板
 *
 * 演示环境: 充值与订阅均为本地钱包即时到账, 不接真实支付。
 */

const CREDITS_PER_IMAGE = 2; // 单张图基准消耗, 用于换算「元/张」

const PACKAGES = [
  { id: 'p100', name: '体验包', credits: 100, price: 19, tag: null, desc: '够做 50 张主图' },
  { id: 'p300', name: '标准包', credits: 300, price: 49, tag: '最受欢迎', desc: '够做一整套上新' },
  { id: 'p1000', name: '专业包', credits: 1000, price: 149, tag: '省 20%', desc: '批量上新 / 含视频' },
  { id: 'p5000', name: '商家包', credits: 5000, price: 599, tag: '省 40%', desc: '店铺级月用量' },
];

const TIERS = [
  { id: 'free', name: '免费版', price: null, features: { '高清导出 (4K)': '2K', '无水印': false, '商用授权': false, '批量折扣': false, '专属模板': false, '生成队列': '普通' } },
  { id: 'standard', name: '标准会员', price: 99, features: { '高清导出 (4K)': true, '无水印': true, '商用授权': false, '批量折扣': '9 折', '专属模板': false, '生成队列': '普通' } },
  { id: 'pro', name: '专业会员', price: 299, features: { '高清导出 (4K)': true, '无水印': true, '商用授权': true, '批量折扣': '8 折', '专属模板': true, '生成队列': '优先' } },
];

const FEATURE_KEYS = ['高清导出 (4K)', '无水印', '商用授权', '批量折扣', '专属模板', '生成队列'];

function fmtLedgerTime(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function renderRecharge(root, { navigate, back }) {
  root.replaceChildren();

  const member = getMembership();
  const memberName = TIERS.find((t) => t.id === member)?.name || '免费版';

  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => back(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#eff4ff;color:var(--brand)' }, icon('credit-card', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '价格与额度'),
      h('div', { class: 'ph-sub' }, '按量付费 · 额度 365 天有效 · 不会自动扣款 —— 生成前都会先显示消耗'),
    ),
    h('span', { class: `pill ${member === 'free' ? 'pill-line' : 'pill-ok'}` }, `当前: ${memberName}`),
  );

  // ---------- 余额卡 ----------
  const balance = h('span', { class: 'v' }, String(getCredits()), h('small', {}, '点'));
  const balanceCard = h('div', { class: 'card panel balance-card' },
    h('div', {},
      h('span', { class: 'k' }, '当前余额'),
      balance,
    ),
    h('div', { class: 'bc-right' },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/settings') }, icon('settings', { size: 14 }), '用户设置'),
    ),
  );

  // ---------- 会员权益分层 (1.1.4) ----------
  const tierCards = h('div', { class: 'tier-grid' },
    ...TIERS.map((t) => h('div', { class: `tier-card${t.id === 'pro' ? ' hot' : ''}${t.id === member ? ' cur' : ''}` },
      h('div', { class: 'tc-top' },
        h('b', {}, t.name),
        t.id === member ? h('span', { class: 'mb-now on' }, '当前') : null,
      ),
      h('div', { class: 'tc-price' }, t.price ? h('span', {}, h('b', {}, `¥${t.price}`), ' /月') : h('span', {}, h('b', {}, '¥0'), ' 起')),
      h('ul', { class: 'tc-feats' },
        ...FEATURE_KEYS.map((k) => {
          const v = t.features[k];
          return h('li', { class: v ? 'yes' : 'no' },
            v === true ? '✓' : v === false ? '—' : String(v), ' ', k);
        }),
      ),
      t.price ? h('button', {
        class: `btn ${t.id === 'pro' ? 'btn-primary' : 'btn-ghost'} btn-sm`,
        onclick: () => {
          setMembership(t.id);
          toast(`已切换为${t.name} (演示环境, 权益暂不接入生成链路)`, 'ok');
          renderRecharge(root, { navigate, back });
        },
      }, getMembership() === t.id ? '当前档位' : `开通 ${t.name}`)
        : h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: () => { setMembership('free'); renderRecharge(root, { navigate, back }); },
        }, '回到免费版'),
    )),
  );

  // ---------- 额度包 (1.1.1) ----------
  const grid = h('div', { class: 'pkg-grid pkg-grid-4' },
    ...PACKAGES.map((p) => {
      const perImage = (p.price / (p.credits / CREDITS_PER_IMAGE)).toFixed(2);
      return h('button', {
        class: `pkg-card${p.tag ? ' hot' : ''}`, type: 'button',
        onclick: () => {
          const next = addCredits(p.credits, { label: `充值 · ${p.name}` });
          balance.replaceChildren(String(next), h('small', {}, '点'));
          drawLedger();
          toast(`充值成功, 到账 ${p.credits} 额度 (365 天内有效)`, 'ok');
        },
      },
        p.tag ? h('span', { class: 'pkg-tag' }, p.tag) : null,
        h('span', { class: 'pkg-name' }, p.name),
        h('span', { class: 'pkg-credits' }, String(p.credits), h('small', {}, ' 额度')),
        h('span', { class: 'pkg-unit' }, `≈ ¥${perImage}/张`),
        h('span', { class: 'pkg-desc' }, p.desc),
        h('span', { class: 'pkg-valid' }, '有效期 365 天'),
        h('span', { class: 'pkg-price' }, h('b', {}, `¥${p.price}`), ' 购买'),
      );
    }),
  );

  // ---------- 计费规则 ----------
  const note = h('div', { class: 'card panel' },
    h('h3', {}, '计费规则 (无隐藏条款)'),
    h('ul', { class: 'note-list' },
      h('li', {}, h('b', {}, '单张成本: '), `图片模板 2 额度/张, 视频模板 8 额度/次; 按上表档位换算约 ¥0.24~0.38/张, 买得越多越便宜。`),
      h('li', {}, h('b', {}, '有效期: '), '额度自到账日起 365 天内有效, 过期不回收已生成的作品。'),
      h('li', {}, h('b', {}, '不会自动扣款: '), '无订阅、无自动续费; 余额用完即停, 需要时再手动充值。'),
      h('li', {}, h('b', {}, '超额计费: '), '不存在超额概念 —— 余额不足时生成按钮直接提示充值, 不会先跑后扣。'),
      h('li', {}, h('b', {}, '失败退回: '), '生成失败自动全额退回额度; 「换一批」首次免费。'),
      h('li', {}, h('b', {}, '演示环境: '), '当前为本地钱包即时到账, 不产生真实交易; 正式接入后改为微信/支付宝下单。'),
    ),
  );

  // ---------- 额度消耗明细 (1.1.3) ----------
  const ledgerBody = h('tbody', {});
  const ledgerWrap = h('div', { class: 'ledger-wrap' });
  function drawLedger() {
    const rows = getLedger();
    if (!rows.length) {
      ledgerWrap.replaceChildren(h('div', { class: 'empty-state' }, h('p', {}, '还没有额度变动记录 —— 生成或充值后会出现在这里。')));
      return;
    }
    ledgerWrap.replaceChildren(
      h('table', { class: 'ledger-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '时间'), h('th', {}, '事项'), h('th', {}, '模型'), h('th', { class: 'r' }, '变动'), h('th', { class: 'r' }, '余额'))),
        ledgerBody,
      ),
    );
    ledgerBody.replaceChildren(...rows.map((r) => h('tr', {},
      h('td', {}, fmtLedgerTime(r.t)),
      h('td', {}, r.label),
      h('td', { class: 'dim' }, r.model || '—'),
      h('td', { class: `r ${r.n < 0 ? 'minus' : 'plus'}` }, r.n > 0 ? `+${r.n}` : String(r.n)),
      h('td', { class: 'r dim' }, String(r.balance)),
    )));
  }
  const ledgerCard = h('div', { class: 'card panel' },
    h('div', { class: 'lc-head' }, h('h3', {}, '额度消耗明细'),
      h('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => { clearLedger(); drawLedger(); toast('明细已清空', 'ok'); },
      }, '清空')),
    ledgerWrap,
    h('div', { class: 'hint', style: 'margin-top:8px' }, '明细保存在本机浏览器 (最近 200 条); 批量套图的消耗在批量项目页内查看。'),
  );
  drawLedger();

  root.append(
    header,
    h('div', { class: 'recharge-layout' },
      h('div', {},
        balanceCard,
        h('div', { class: 'section-head' }, h('h2', {}, '会员权益'), h('span', { class: 'desc' }, '按需选择, 随时可回免费版')),
        tierCards,
        h('div', { class: 'section-head' }, h('h2', {}, '选择额度包'), h('span', { class: 'desc' }, '一次购买 365 天有效 · 不自动扣款')),
        grid,
        note,
        ledgerCard,
      ),
      h('div', { class: 'recharge-side' },
        h('div', { class: 'card panel' },
          h('h3', {}, '额度怎么花'),
          h('div', { class: 'usage-list' },
            h('div', {}, h('b', {}, '图片模板'), h('span', {}, '2 额度 / 次')),
            h('div', {}, h('b', {}, '视频模板'), h('span', {}, '8 额度 / 次')),
            h('div', {}, h('b', {}, '自由工作台'), h('span', {}, '2 额度 / 张')),
            h('div', {}, h('b', {}, '批量套图'), h('span', {}, '2 额度 / 格')),
          ),
        ),
        h('div', { class: 'card panel' },
          h('h3', {}, '支付方式'),
          h('div', { class: 'pay-list' },
            h('span', { class: 'pay-chip' }, '微信支付'),
            h('span', { class: 'pay-chip' }, '支付宝'),
            h('span', { class: 'pay-chip' }, '对公转账 (企业)'),
          ),
          h('div', { class: 'hint', style: 'margin-top:8px' }, '演示环境为本地即时到账; 上线后接入前两种在线支付, 对公开票走客服。'),
        ),
      ),
    ),
  );
}
