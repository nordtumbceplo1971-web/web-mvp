import { h } from './ui.js';
import './styles/main.css';
import { icon } from './icons.js';
import { api } from './api.js';
import { getCredits } from './store.js';
import { startTour } from './tour.js';
import { createAnnouncementBar } from './announcements.js';
import { APP_VERSION } from './version.js';
import { renderHome } from './views/home.js';
import { renderTemplates } from './views/templates.js';
import { renderTemplateDetail } from './views/templateDetail.js';
import { renderCreate } from './views/create.js';
import { renderStudio } from './views/studio.js';
import { renderWorks } from './views/works.js';
import { renderRecharge } from './views/recharge.js';
import { renderSettings } from './views/settings.js';

/**
 * 应用外壳 v3 (严肃商业 SaaS): 左侧功能导航 + 顶栏 + 内容区
 * 布局: 侧栏(品牌 / 功能导航 / 模板分组) · 顶栏(返回 / 页面标题 / 顶部导航 / 额度 / 引导)
 *
 * v0.1.0 变更:
 * - 侧栏「模板库」拆为「图片类目」「视频类目」两个独立板块, 各自分组展示自己的模板
 * - 顶栏新增「首页」「我的作品」入口
 * - 「剩余额度」悬停浮出「充值」「用户设置」
 * - 全局统一「返回上一页」(基于内部访问栈, 可正确回到来源页)
 */
const routes = [
  { path: '/', view: renderHome, nav: 'home', title: '首页' },
  { path: '/templates', view: renderTemplates, nav: 'templates', title: '模板库' },
  { path: '/templates/:id', view: renderTemplateDetail, nav: 'templates', title: '模板详情' },
  { path: '/create', view: renderCreate, nav: 'templates', title: '模板创作' },
  { path: '/studio', view: renderStudio, nav: 'studio', title: '生图改图' },
  { path: '/works', view: renderWorks, nav: 'works', title: '我的作品' },
  { path: '/recharge', view: renderRecharge, nav: 'recharge', title: '充值额度' },
  { path: '/settings', view: renderSettings, nav: 'settings', title: '用户设置' },
];

/** 侧栏 · 功能导航 (非模板类入口) */
const TOOL_LINKS = [
  { href: '/templates', label: '模板库', iconName: 'grid', tour: 'nav-templates' },
  { href: '/studio', label: '自由工作台', iconName: 'wand', tour: 'nav-studio' },
];

/** 顶栏 · 顶部导航 */
const TOP_LINKS = [
  { href: '/', label: '首页', iconName: 'home', nav: 'home' },
  { href: '/works', label: '我的作品', iconName: 'folder', nav: 'works', tour: 'nav-works' },
];

/** 路由匹配 (支持 /templates/:id 形式的参数段) */
function matchRoute(path) {
  const segs = path.split('?')[0].split('/').filter(Boolean);
  for (const r of routes) {
    const rSegs = r.path.split('/').filter(Boolean);
    if (rSegs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rSegs.length; i += 1) {
      if (rSegs[i].startsWith(':')) params[rSegs[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (rSegs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return { route: routes[0], params: {} };
}

function renderShell() {
  const app = document.getElementById('app');
  app.replaceChildren();

  const main = h('main', { class: 'container' });

  // ============================================================
  // 侧栏
  // ============================================================
  const navEl = h('nav', { class: 'side-nav', 'aria-label': '主导航' });
  const modeChip = h('div', { class: 'mode-chip' }, h('span', { class: 'dot' }), '检测服务中…');
  const sidebar = h('aside', { class: 'sidebar' },
    h('a', {
      class: 'brand', href: '#/', 'aria-label': '996.chat · 996 Studio 首页',
      onclick: (e) => { e.preventDefault(); navigate('/'); },
    },
      h('img', {
        class: 'brand-logo', src: '/brand/logo-square.png', alt: '996.chat',
        width: 52, height: 52, loading: 'eager', decoding: 'async',
      }),
      h('span', { class: 'brand-name' }, '996 Studio', h('small', {}, 'AI 电商内容工作台')),
    ),
    navEl,
    h('div', { class: 'sidebar-foot' },
      modeChip,
      h('div', { class: 'tip' }, '上传产品图，选模板，一键生成主图、上身图与营销视频。'),
      h('div', { class: 'ver' }, `版本 ${APP_VERSION}`),
    ),
  );

  // ============================================================
  // 顶栏
  // ============================================================
  const backBtn = h('button', {
    class: 'btn btn-ghost btn-sm btn-back', type: 'button',
    'aria-label': '返回上一页', title: '返回上一页',
    onclick: () => goBack(),
  }, icon('arrow-left', { size: 15 }), '返回');

  const pageTitle = h('span', { class: 'page-title' }, '首页');

  // 顶部导航: 首页 / 我的作品
  const topNav = h('nav', { class: 'top-nav', 'aria-label': '顶部导航' },
    ...TOP_LINKS.map((l) => h('a', {
      href: `#${l.href}`, class: 'top-nav-link', 'data-nav': l.nav, 'data-tour': l.tour || null,
      onclick: (e) => { e.preventDefault(); navigate(l.href); },
    }, icon(l.iconName, { size: 15 }), l.label)),
  );

  // 剩余额度 + 悬停浮层 (充值 / 用户设置)
  const creditsValue = h('b', {}, String(getCredits()));
  const creditsPill = h('button', {
    class: 'credits-pill', type: 'button', 'data-tour': 'credits',
    'aria-haspopup': 'menu', 'aria-expanded': 'false',
    onclick: () => {
      const open = creditsWrap.classList.toggle('open');
      creditsPill.setAttribute('aria-expanded', open ? 'true' : 'false');
    },
  }, '剩余额度 ', creditsValue, icon('chevron-down', { size: 13, className: 'caret' }));

  const creditsMenu = h('div', { class: 'credits-menu', role: 'menu' },
    h('button', {
      class: 'credits-item', type: 'button', role: 'menuitem',
      onclick: () => { closeCreditsMenu(); navigate('/recharge'); },
    }, icon('credit-card', { size: 16 }), h('span', { class: 'ci-t' }, '充值'), h('small', {}, '购买额度')),
    h('button', {
      class: 'credits-item', type: 'button', role: 'menuitem',
      onclick: () => { closeCreditsMenu(); navigate('/settings'); },
    }, icon('settings', { size: 16 }), h('span', { class: 'ci-t' }, '用户设置'), h('small', {}, '偏好与账户')),
  );
  const creditsWrap = h('div', { class: 'credits-wrap' }, creditsPill, creditsMenu);

  function closeCreditsMenu() {
    creditsWrap.classList.remove('open');
    creditsPill.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('click', (e) => {
    if (!creditsWrap.contains(e.target)) closeCreditsMenu();
  });

  const syncCredits = () => { creditsValue.textContent = String(getCredits()); };
  window.addEventListener('bs:credits', syncCredits);

  const mobileNav = h('nav', { class: 'mobile-nav', 'aria-label': '移动端导航' });
  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'topbar-inner' },
      backBtn,
      pageTitle,
      // 轮播公告 (顶栏 · 页面标题与右侧导航之间)
      createAnnouncementBar(),
      h('div', { class: 'topbar-right' },
        topNav,
        creditsWrap,
        h('button', { class: 'btn-guide', 'data-tour': 'guide-btn', onclick: () => startTour({ force: true }) }, '新手引导'),
      ),
    ),
    mobileNav,
  );

  // ============================================================
  // 侧栏绘制 (模板分组来自后端模板库)
  // ============================================================
  let catGroups = { image: [], video: [] };

  function drawNav(active) {
    const toolLinks = TOOL_LINKS.map((l) =>
      h('a', {
        href: `#${l.href}`,
        class: `side-link ${l.nav === active ? 'active' : ''}`,
        'data-tour': l.tour || null,
        onclick: (e) => { e.preventDefault(); navigate(l.href); },
      }, icon(l.iconName, { size: 18 }), l.label));

    const groupBlock = (groupKey, title, iconName) => {
      const items = catGroups[groupKey];
      if (!items.length) return null;
      return h('div', { class: 'side-group' },
        h('div', { class: 'side-group-title' }, icon(iconName, { size: 14 }), title),
        h('div', { class: 'side-sub' },
          ...items.map((c) => h('a', {
            href: `#/templates?cat=${c.id}`,
            class: `side-sublink ${active === 'templates' && currentCat === c.id ? 'active' : ''}`,
            'data-cat': c.id,
            onclick: (e) => { e.preventDefault(); navigate(`/templates?cat=${c.id}`); },
          }, h('span', {}, c.label), h('span', { class: 'cnt' }, String(c.count)))),
        ),
      );
    };

    navEl.replaceChildren(
      h('div', { class: 'side-label' }, '功能导航'),
      ...toolLinks,
      h('div', { class: 'side-label' }, '模板库'),
      groupBlock('image', '图片类目', 'image'),
      groupBlock('video', '视频类目', 'video'),
    );

    mobileNav.replaceChildren(
      ...TOP_LINKS.map((l) => h('a', {
        href: `#${l.href}`, class: l.nav === active ? 'active' : '',
        onclick: (e) => { e.preventDefault(); navigate(l.href); },
      }, l.label)),
      ...TOOL_LINKS.map((l) => h('a', {
        href: `#${l.href}`, class: l.nav === active ? 'active' : '',
        onclick: (e) => { e.preventDefault(); navigate(l.href); },
      }, l.label)),
    );
  }

  // 拉取模板库 → 按 图片 / 视频 拆分分组
  api.listTemplates().then(({ items, categories }) => {
    const byCat = new Map();
    for (const t of items) {
      if (!byCat.has(t.category)) byCat.set(t.category, []);
      byCat.get(t.category).push(t);
    }
    const image = [];
    const video = [];
    for (const c of categories || []) {
      if (c.id === 'all') continue;
      const list = byCat.get(c.id) || [];
      if (!list.length) continue;
      const bucket = list[0].type === 'video' ? video : image;
      bucket.push({ id: c.id, label: c.label, count: list.length });
    }
    catGroups = { image, video };
    drawNav(currentNav);
  }).catch(() => { /* 模板未就绪时仅显示功能导航 */ });

  // ============================================================
  // 路由 + 历史栈 (统一返回上一页)
  // ============================================================
  const historyStack = [];
  let currentPath = '';
  let currentNav = 'home';
  let currentCat = '';
  let suppressHash = false;

  function syncHash(path) {
    const target = `#${path}`;
    if (location.hash === target) return;
    suppressHash = true;
    location.hash = target;
  }

  async function renderPath(path) {
    const { route, params } = matchRoute(path);
    const query = new URLSearchParams(path.split('?')[1] ?? '');
    currentNav = route.nav;
    currentCat = query.get('cat') || '';
    drawNav(currentNav);
    topNav.querySelectorAll('.top-nav-link').forEach((a) => {
      a.classList.toggle('active', a.dataset.nav === currentNav);
    });
    pageTitle.textContent = route.title;
    backBtn.disabled = historyStack.length <= 1;
    try {
      await route.view(main, { navigate, query, params, back: goBack });
    } catch (err) {
      console.error(err);
      main.replaceChildren(h('div', { class: 'empty-state' }, '页面加载出错: ', err.message));
    }
    window.scrollTo({ top: 0 });
  }

  function navigate(path, { replace = false } = {}) {
    const target = path || '/';
    if (target === currentPath) { renderPath(target); return; }
    if (replace && historyStack.length) historyStack[historyStack.length - 1] = target;
    else historyStack.push(target);
    currentPath = target;
    syncHash(target);
    renderPath(target);
  }

  function goBack() {
    if (historyStack.length > 1) {
      historyStack.pop();
      currentPath = historyStack[historyStack.length - 1];
      syncHash(currentPath);
      renderPath(currentPath);
      return;
    }
    // 没有来源页 (直接深链进入) → 回首页
    navigate('/', { replace: true });
  }

  // 浏览器前进 / 后退 → 与内部栈对齐
  window.addEventListener('hashchange', () => {
    if (suppressHash) { suppressHash = false; return; }
    const path = location.hash.replace(/^#/, '') || '/';
    const idx = historyStack.lastIndexOf(path);
    if (idx >= 0) historyStack.length = idx + 1;
    else historyStack.push(path);
    currentPath = path;
    renderPath(path);
  });

  // 服务模式标识 (MOCK / 正式 / 未连接)
  fetch('/api/health').then((r) => r.json()).then((j) => {
    const live = j?.mode === 'live';
    modeChip.classList.toggle('live', live);
    modeChip.replaceChildren(h('span', { class: 'dot' }), live ? '正式模式 · 已连接模型服务' : '演示模式 · 未配置 API 密钥');
    modeChip.title = `运行时: ${j?.runtime ?? '未知'} · 存储: ${j?.storage ?? '未知'}`;
  }).catch(() => {
    modeChip.classList.add('offline');
    modeChip.replaceChildren(h('span', { class: 'dot' }), '后端未连接');
    modeChip.title = '未检测到 /api/health 服务 —— 请确认后端已部署 (Vercel: 部署 api/ 函数; 本地: 启动 backend)';
  });

  app.append(
    h('div', { class: 'app-shell' },
      sidebar,
      h('div', { class: 'app-main' },
        topbar,
        main,
        h('footer', { class: 'site' },
          h('div', { class: 'container' },
            h('span', {}, '© 2026 996 Studio · 一个想法 + 一个模板 = 一套可上架内容'),
            h('span', {}, `图片 gpt-image-2.5 · 视频 veo-4-omni · 文本 glm-5.3-flash · ${APP_VERSION}`),
          ),
        ),
      ),
    ),
  );

  // 初始路由
  const initial = location.hash.replace(/^#/, '') || '/';
  historyStack.push(initial);
  currentPath = initial;
  syncHash(initial);
  renderPath(initial);

  return navigate;
}

const navigate = renderShell();

// 页面初始化视觉引导: 首次访问自动开始 (可跳过)
setTimeout(() => startTour({}), 600);
