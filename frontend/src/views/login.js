import { h } from '../ui.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { setToken } from '../auth.js';

/**
 * 登录页 (独立屏, 不套应用外壳)
 * 双通道: 账号登录 (邮箱+密码, 含注册流程) · 访问码 (快速通道)
 * 注册: 企业域名邮箱 + 邮箱验证码 + 注册邀请码(=访问码) + 密码
 * 登录成功写 token 后整页刷新进入工作台。
 */

const field = (labelText, inputEl) => h('label', { class: 'login-field' },
  h('span', { class: 'lf-label' }, labelText), inputEl);

export function renderLoginScreen(root) {
  root.replaceChildren();

  // ---------- 通用 ----------
  const errTip = h('div', { class: 'hint', style: 'color:#dc2626;min-height:18px;margin-top:10px;text-align:center' });
  const showErr = (msg) => { errTip.textContent = msg ?? ''; };

  // ---------- Tab 1: 账号登录 ----------
  const liEmail = h('input', { class: 'input', type: 'email', placeholder: 'name@yourdomain.com', autocomplete: 'username' });
  const liPass = h('input', { class: 'input', type: 'password', placeholder: '密码', autocomplete: 'current-password',
    onkeydown: (e) => { if (e.key === 'Enter') doAccountLogin(); } });
  const loginBtn = h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%;margin-top:14px' },
    icon('user', { size: 16 }), '登录');

  async function doAccountLogin() {
    const email = liEmail.value.trim();
    if (!email || !liPass.value) { showErr('请填写邮箱与密码'); return; }
    loginBtn.disabled = true; showErr('');
    try {
      const r = await api.accountLogin(email, liPass.value);
      if (r?.token) { setToken(r.token); location.reload(); return; }
      showErr('登录响应异常, 请重试');
    } catch (e) { showErr(e.message); }
    loginBtn.disabled = false;
  }
  loginBtn.onclick = doAccountLogin;

  const goRegister = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'width:100%;margin-top:10px' },
    '没有账号? 用企业邮箱注册 →');

  const accountPane = h('div', { class: 'login-pane' },
    field('企业邮箱', liEmail),
    field('密码', liPass),
    loginBtn,
    goRegister,
  );

  // ---------- Tab 2: 注册 ----------
  const rEmail = h('input', { class: 'input', type: 'email', placeholder: 'name@yourdomain.com' });
  const rCode = h('input', { class: 'input', type: 'text', placeholder: '6 位邮箱验证码', maxlength: 6, style: 'flex:1' });
  const rSendBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'white-space:nowrap' }, '获取验证码');
  const rAccess = h('input', { class: 'input', type: 'password', placeholder: '注册邀请码 (找管理员获取)' });
  const rPass = h('input', { class: 'input', type: 'password', placeholder: '设置密码 (至少 8 位)', autocomplete: 'new-password' });
  const rBtn = h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%;margin-top:14px' },
    icon('wand', { size: 16 }), '注册并进入');

  async function sendCode() {
    const email = rEmail.value.trim();
    if (!email) { showErr('请先填写邮箱'); return; }
    rSendBtn.disabled = true; showErr('');
    try {
      const r = await api.registerRequest(email);
      if (r?.devCode) showErr(`(调试模式) 验证码: ${r.devCode}`);
      else if (r?.sent) showErr('');
      let wait = 60;
      const label = () => { rSendBtn.textContent = wait > 0 ? `${wait}s` : '获取验证码'; };
      label();
      const timer = setInterval(() => {
        wait -= 1; label();
        if (wait <= 0) { clearInterval(timer); rSendBtn.disabled = false; }
      }, 1000);
    } catch (e) {
      showErr(e.message);
      rSendBtn.disabled = false;
    }
  }
  rSendBtn.onclick = sendCode;

  async function doRegister() {
    const email = rEmail.value.trim();
    if (!email || !rCode.value || !rPass.value || !rAccess.value) { showErr('请填写全部字段'); return; }
    rBtn.disabled = true; showErr('');
    try {
      const r = await api.registerConfirm({
        email, code: rCode.value.trim(), password: rPass.value, accessCode: rAccess.value.trim(),
      });
      if (r?.token) { setToken(r.token); location.reload(); return; }
      showErr('注册响应异常, 请重试');
    } catch (e) { showErr(e.message); }
    rBtn.disabled = false;
  }
  rBtn.onclick = doRegister;

  const goLogin = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'width:100%;margin-top:10px' },
    '已有账号? 返回登录 →');

  const registerPane = h('div', { class: 'login-pane', style: 'display:none' },
    field('企业邮箱', rEmail),
    h('label', { class: 'login-field' },
      h('span', { class: 'lf-label' }, '邮箱验证码'),
      h('div', { style: 'display:flex;gap:8px' }, rCode, rSendBtn)),
    field('注册邀请码', rAccess),
    field('设置密码', rPass),
    rBtn,
    goLogin,
  );

  // ---------- Tab 切换 ----------
  const tabAccount = h('button', { class: 'login-tab active', type: 'button' }, '账号登录');
  const tabRegister = h('button', { class: 'login-tab', type: 'button' }, '注册账号');
  function switchTab(which) {
    const acc = which === 'account';
    tabAccount.classList.toggle('active', acc);
    tabRegister.classList.toggle('active', !acc);
    accountPane.style.display = acc ? '' : 'none';
    registerPane.style.display = acc ? 'none' : '';
    showErr('');
  }
  tabAccount.onclick = () => switchTab('account');
  tabRegister.onclick = () => switchTab('register');
  goRegister.onclick = () => switchTab('register');
  goLogin.onclick = () => switchTab('account');

  // ---------- 访问码 (快速通道) ----------
  const accInput = h('input', { class: 'input', type: 'password', placeholder: '输入访问码', autocomplete: 'current-password',
    onkeydown: (e) => { if (e.key === 'Enter') submitAccess(); } });
  const accBtn = h('button', { class: 'btn btn-ghost', type: 'button', style: 'width:100%;margin-top:10px' },
    icon('lock', { size: 15 }), '用访问码进入');

  async function submitAccess() {
    const code = accInput.value.trim();
    if (!code) { showErr('请输入访问码'); return; }
    accBtn.disabled = true; showErr('');
    try {
      const r = await api.login(code);
      if (r?.token) { setToken(r.token); location.reload(); return; }
      showErr('登录响应异常, 请重试');
    } catch (e) { showErr(e.message); }
    accBtn.disabled = false;
  }
  accBtn.onclick = submitAccess;

  const accessPane = h('div', { style: 'margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)' },
    accInput, accBtn);

  // ---------- 布局 ----------
  root.append(
    h('div', { class: 'login-wrap' },
      h('div', { class: 'card panel login-card' },
        h('div', { class: 'ph-icon', style: 'background:var(--brand-soft);color:var(--brand);margin:0 auto 14px' },
          icon('lock', { size: 26 })),
        h('h2', { style: 'text-align:center;margin:0 0 14px' }, '996 Studio'),
        h('div', { class: 'login-tabs' }, tabAccount, tabRegister),
        accountPane,
        registerPane,
        errTip,
        accessPane,
      ),
    ),
  );
  setTimeout(() => liEmail.focus(), 50);
}
