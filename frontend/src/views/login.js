import { h } from '../ui.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { setToken } from '../auth.js';

/**
 * 登录页 (单一访问码 · 独立屏, 不套应用外壳)
 * 未登录访问任何页面都会先到这里; 登录成功写 token 后整页刷新进入工作台。
 */
export function renderLoginScreen(root) {
  root.replaceChildren();

  const input = h('input', {
    class: 'input', type: 'password', placeholder: '输入访问码',
    'aria-label': '访问码', autocomplete: 'current-password',
    onkeydown: (e) => { if (e.key === 'Enter') submit(); },
  });

  const errTip = h('div', { class: 'hint', style: 'color:#dc2626;min-height:18px;margin-top:8px;text-align:center' });

  const btn = h('button', {
    class: 'btn btn-primary', type: 'button', style: 'width:100%;margin-top:14px',
    onclick: () => submit(),
  }, icon('lock', { size: 16 }), '进入工作台');

  async function submit() {
    const code = input.value.trim();
    if (!code) { errTip.textContent = '请输入访问码'; return; }
    btn.disabled = true;
    errTip.textContent = '';
    try {
      const r = await api.login(code);
      if (r?.token) {
        setToken(r.token);
        location.reload(); // 重建应用外壳 (进入工作台)
        return;
      }
      errTip.textContent = '登录响应异常, 请重试';
    } catch (e) {
      errTip.textContent = e.message || '访问码不正确';
    }
    btn.disabled = false;
  }

  root.append(
    h('div', { class: 'login-wrap' },
      h('div', { class: 'card panel login-card' },
        h('div', { class: 'ph-icon', style: 'background:var(--brand-soft);color:var(--brand);margin:0 auto 14px' },
          icon('lock', { size: 26 })),
        h('h2', { style: 'text-align:center;margin:0 0 6px' }, '996 Studio'),
        h('div', { class: 'hint', style: 'text-align:center;margin-bottom:18px' }, '本站为内部创作工作台, 请输入访问码继续'),
        input,
        errTip,
        btn,
      ),
    ),
  );
  setTimeout(() => input.focus(), 50);
}
