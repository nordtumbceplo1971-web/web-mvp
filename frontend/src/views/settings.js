import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { getCredits, getProfile, setProfile, resetLocalData } from '../store.js';
import { api, getApiBase, setApiBase } from '../api.js';
import { describeApiError } from '../errors.js';
import { APP_VERSION } from '../version.js';

/** 用户设置页: 账户资料 / 创作偏好 / 本地数据 (MVP 演示: 偏好存本地) */
export function renderSettings(root, { navigate, back }) {
  root.replaceChildren();

  const profile = getProfile();

  const header = h('div', { class: 'page-head' },
    h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => back(), 'aria-label': '返回上一页', title: '返回上一页',
    }, icon('arrow-left', { size: 15 }), '返回上一页'),
    h('div', { class: 'ph-icon', style: 'background:#f5f3ff;color:#7c3aed' }, icon('settings', { size: 22 })),
    h('div', { class: 'ph-title' },
      h('h1', {}, '用户设置'),
      h('div', { class: 'ph-sub' }, '账户资料与创作偏好, 立即生效并保存在本地'),
    ),
  );

  // ---------- 账户资料 ----------
  const nickname = h('input', { class: 'text-input', type: 'text', value: profile.nickname, placeholder: '给自己起个名字' });
  const brand = h('input', { class: 'text-input', type: 'text', value: profile.brand, placeholder: '例: 极简生活馆' });

  // ---------- 创作偏好 ----------
  const aspect = select(['1:1', '3:4', '9:16', '16:9'], profile.aspectRatio);
  const resolution = select(['2K', '4K'], profile.resolution);
  const duration = select([4, 6, 8], profile.videoDuration, (v) => `${v} 秒`);
  const autoSave = h('input', { type: 'checkbox', checked: profile.autoSave });

  function select(options, value, fmt = (v) => v) {
    const sel = h('select', { class: 'text-input' },
      ...options.map((o) => h('option', { value: String(o), selected: String(o) === String(value) }, fmt(o))));
    return sel;
  }

  const form = h('div', { class: 'card panel' },
    h('h3', {}, '账户资料'),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '昵称'), nickname),
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '品牌 / 店铺名'), brand),
    ),
    h('h3', { style: 'margin-top:18px' }, '创作偏好'),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '默认输出比例'), aspect),
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '默认清晰度'), resolution),
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '视频默认时长'), duration),
      h('label', { class: 'field switch' }, h('span', { class: 'g-label' }, '生成后自动存入「我的作品」'), autoSave),
    ),
    h('div', { class: 'form-actions' },
      h('button', {
        class: 'btn btn-primary',
        onclick: () => {
          setProfile({
            nickname: nickname.value.trim() || '电商创作者',
            brand: brand.value.trim(),
            aspectRatio: aspect.value,
            resolution: resolution.value,
            videoDuration: Number(duration.value),
            autoSave: autoSave.checked,
          });
          toast('设置已保存', 'ok');
        },
      }, '保存设置'),
      h('button', { class: 'btn btn-ghost', onclick: () => { navigate('/recharge'); } }, '去充值额度 →'),
    ),
  );

  // ---------- 后端连接 ----------
  const apiBase = h('input', {
    class: 'text-input', type: 'text', value: getApiBase(),
    placeholder: '留空 = 与前端同域的 /api',
  });
  const connTip = h('div', { class: 'conn-tip' });
  const testBtn = h('button', {
    class: 'btn btn-blue btn-sm',
    onclick: async () => {
      connTip.className = 'conn-tip';
      connTip.replaceChildren('正在检测…');
      testBtn.disabled = true;
      try {
        // 只探测, 不落盘 —— 填错地址时不应把坏配置写进去
        const j = await api.health(apiBase.value.trim());
        connTip.className = 'conn-tip ok';
        connTip.replaceChildren(
          `✓ 已连接 · 模式 ${j.mode === 'live' ? '正式' : '演示(MOCK)'} · 运行时 ${j.runtime ?? '未知'} · 存储 ${j.storage ?? '未知'}`,
        );
        toast('后端连接正常', 'ok');
      } catch (e) {
        connTip.className = 'conn-tip bad';
        connTip.replaceChildren(`✗ ${describeApiError(e).title} · ${e.message}`);
        toast('后端连接失败', 'err');
      } finally {
        testBtn.disabled = false;
      }
    },
  }, '测试连接');

  const connPanel = h('div', { class: 'card panel' },
    h('h3', {}, '后端连接'),
    h('div', { class: 'desc', style: 'margin-bottom:10px' },
      '前端与后端分开部署时, 在此填写后端地址 (无需重新构建); 同一域名一体化部署则留空即可。'),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field' }, h('span', { class: 'g-label' }, '后端地址'), apiBase),
    ),
    h('div', { class: 'form-actions' },
      testBtn,
      h('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          setApiBase(apiBase.value);
          toast('已保存, 正在刷新…', 'ok');
          setTimeout(() => window.location.reload(), 600);
        },
      }, '保存并刷新'),
      h('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          apiBase.value = '';
          setApiBase('');
          connTip.replaceChildren();
          toast('已恢复同域, 正在刷新…', 'ok');
          setTimeout(() => window.location.reload(), 600);
        },
      }, '恢复同域'),
    ),
    connTip,
  );

  // ---------- 账户信息 ----------
  const account = h('div', { class: 'card panel' },
    h('h3', {}, '账户信息'),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '剩余额度'), h('span', { class: 'v' }, `${getCredits()} 点`)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '当前版本'), h('span', { class: 'v' }, APP_VERSION)),
    h('div', { class: 'fact' }, h('span', { class: 'k' }, '更新日志'), h('span', { class: 'v' }, '见项目根目录 CHANGELOG.md')),
  );

  // ---------- 本地数据 ----------
  const danger = h('div', { class: 'card panel danger-panel' },
    h('h3', {}, '本地数据'),
    h('p', { class: 'desc' }, '演示环境的额度与偏好保存在浏览器本地, 可一键重置为初始状态 (已生成的作品不受影响)。'),
    h('button', {
      class: 'btn btn-danger-ghost',
      onclick: () => {
        if (!window.confirm('确定要重置本地演示数据吗? 额度与偏好将恢复初始值。')) return;
        resetLocalData();
        toast('已重置本地数据', 'ok');
        navigate('/settings', { replace: true });
      },
    }, icon('rotate-ccw', { size: 14 }), '重置本地数据'),
  );

  root.append(
    header,
    h('div', { class: 'settings-layout' },
      h('div', {}, form, connPanel, danger),
      h('div', { class: 'settings-side' }, account),
    ),
  );
}
