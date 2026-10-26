# 更新日志 · CHANGELOG

> **版本号规则**：采用 `v0.1.n` 形式。本次发布为 **v0.1.0**，后续每次更新版本号递增一位
> （v0.1.1 → v0.1.2 → v0.1.3 …），并在本文件顶部追加对应条目。

当前版本：**v0.1.3**（前端 `frontend/package.json` / 后端 `backend/package.json` 同步为 `0.1.3`，
页面版本号由 `frontend/src/version.js` 的 `APP_VERSION` 统一维护，侧栏底部与页脚均展示）

---

## v0.1.3 · 2026-10-26

**主题**：品牌更名 —— BrandStudio → **996 Studio**（与 996.chat 品牌标识统一）

### 更名范围

| 位置 | 改动 |
|---|---|
| 侧栏品牌区 | `BrandStudio` → `996 Studio`（与上方 996.chat 正方形标识并列） |
| 浏览器标题 | `996.chat · BrandStudio AI 电商内容工作室` → `996.chat · 996 Studio AI 电商内容工作室` |
| 页脚版权 | `© 2026 BrandStudio · …` → `© 2026 996 Studio · …` |
| 新手引导首屏 | 「欢迎来到 BrandStudio」→「欢迎来到 996 Studio」 |
| API 自述 | `/api` 与 `/api/index` 返回的 `name` → `996 Studio API`；启动日志前缀同步 |
| 模板占位示例 | 「改成什么字」示例 `例: BRANDSTUDIO` → `例: 996 STUDIO` |
| 包名 | `brandstudio-web / -frontend / -backend` → `996-studio-web / -frontend / -backend`（含三份 lock 文件） |
| 文档 | README 标题、PRD 标题与产品代号、设计方向文档项目名、根 package 描述 |

### 刻意保留（避免破坏存量数据与历史）

- **localStorage 键**：`bs-wallet` / `bs-profile` / `bs-tour-done-v1` 与 `bs:credits` / `bs:profile` 事件名不变
  —— 改名会让老用户的额度、偏好与引导标记全部丢失
- **`/tmp/brandstudio-data`**：作为兼容候选目录保留在降级链里（新的写入走 `/tmp/996-studio-data`）
- **CHANGELOG 历史条目**（v0.1.0 ~ v0.1.2）与 README 的历史验收记录保持原貌，如实反映当时事实
- CSS 类名 `.brand` / `.brand-name` / `.brand-logo` 属结构性命名，与品牌名无关，未动

### 验证

- 全仓 `grep -i brandstudio` 仅剩上述 3 处刻意保留项
- `vite build` 通过；`tools/vercel-sim.mjs` 4/4 通过；`tools/smoke.mjs` 端到端全绿
- CDP 1440 / 375：无横向溢出、0 控制台报错；侧栏与页脚显示新名称，版本 v0.1.3

---

## v0.1.2 · 2026-10-26

**主题**：全栈 Serverless 化 —— 前端已上 Vercel，补齐后端 `/api` 服务，站点可完整跑通全流程

### 问题诊断

前端已通过 GitHub 部署到 Vercel，但后端 Express（8787）未部署 → `/api/health` 请求失败 →
侧栏左下角显示「服务未连接」。要看到完整运行效果，必须让 `/api/*` 在线上有服务承接。

### 方案：同一 Vercel 项目一体化部署（前端静态 + `/api/*` Serverless Function）

同域部署、无跨域、无需第二个平台账号；仓库已按此形态改造完毕。

### 后端 Serverless 适配（关键改动）

| # | 问题 | 方案 |
|---|---|---|
| 1 | MOCK 任务状态依赖内存 + 作品文件，冷启动后轮询永远停在 pending | **任务 ID 自描述**：`mock-{类型}-{张数}-{时间戳36进制}-{uuid}`，进度由 ID 解析得出，跨实例也能正确推进 |
| 2 | 作品存 `backend/data/works.json`，Serverless 文件系统只读且实例级 | **三级降级存储**：`WORKS_DATA_DIR` → 本地 `backend/data` → `/tmp/brandstudio-data` → 纯内存；写失败自动降级 |
| 3 | 反向代理下 `req.protocol` 为 http，占位图 URL 变 http 被浏览器按混合内容拦截 | 新增 `publicBaseUrl()`，读取 `x-forwarded-proto` / `x-forwarded-host` |
| 4 | `/mock-assets` 在后端静态目录，函数只接管 `/api/*` | 同步一份到 `frontend/public/mock-assets/`，由 Vercel 静态托管 |
| 5 | Express 应用直接 `listen`，无法作为函数导出 | 拆出 `backend/src/app.js`（`createApp()`），`index.js` 仅作本地常驻入口 |
| 6 | 根目录无 package.json，函数解析不到 express 等依赖 | 新增根 `package.json`（后端依赖 + `npm run build` 脚本） |

### 新增 / 变更文件

| 文件 | 说明 |
|---|---|
| `api/[...path].js` | **新增**：Vercel Serverless Function 入口（catch-all），统一还原 `/api/*` 路径 |
| `backend/src/app.js` | **新增**：Express 应用装配 `createApp()`（与运行形态解耦），含 CORS 白名单与 `x-forwarded-*` 处理 |
| `backend/src/index.js` | 改为复用 `createApp()`，仅负责本地 `listen` |
| `backend/src/modules/generation/taskSimulator.js` | 任务 ID 自描述 + `parseMockTaskId()`（无状态轮询） |
| `backend/src/modules/works/store.js` | 三级降级存储 + `storageMode()` |
| `backend/src/routes.js` | `/api/health` 增加 `storage` / `runtime` 字段；任务路由改用无状态解析 |
| `vercel.json` | **新增**：build / output / functions 配置 |
| `package.json`（根） | **新增**：后端依赖 + `build` / `dev` / `start` 脚本 |
| `frontend/public/mock-assets/` | **新增**：占位素材静态副本（生产环境由 Vercel 托管） |
| `frontend/vite.config.js` | 新增 `preview.proxy`，可本地预览构建产物 |
| `frontend/src/main.js` | 连接状态提示优化：区分「后端未连接」（红色）与「演示/正式模式」，悬停显示运行时与存储方式 |

### 部署方式（Vercel 控制台）

Root Directory 改为 **`/`（仓库根目录）**，Build `npm run build`，Output `frontend/dist`，Install `npm install`
（其余已写入 `vercel.json`，详见 README「部署到 Vercel」章节）。

### 验证

- `tools/vercel-sim.mjs`：本地以 Node 模拟 Serverless 调用，`/api/health`、`/api/templates`、`/api/works`、
  `/index` 四条路径全部 200
- `tools/smoke.mjs`（对构建产物 + 后端）：健康检查、模板库（17 模板 / 6 分类）、占位素材、MOCK 生成全流程
  （创建 → 轮询 → 完成 → 出图 → 入库）**全部通过**
- 无状态验证：构造一个**没有作品记录**且创建于 30 秒前的任务 ID，轮询直接返回 `completed`（模拟冷启动场景）
- 构建产物侧栏实测显示「演示模式 · 未配置 API 密钥」，版本 v0.1.2
- CDP 体检 1440 / 375：无横向溢出、0 控制台报错

---

## v0.1.1 · 2026-10-26

**主题**：启用 996.chat 品牌标识（图标在上 + slogan 在下的 1:1 正方形组合）

### 品牌标识上线

- 采用 `996-chat-logo-creative-transparent.png` 作为 Web 应用 logo，原图按**图标 / slogan**两块拆分：
  - 左块「996」图标 → `frontend/public/brand/logo-icon.png`（512×512，用于 favicon）
  - 右块「996.chat」品牌 slogan → 与图标**等宽**叠放于下方
- 合成正方形标识 `frontend/public/brand/logo-square.png`（512×512，1:1）：
  - 图标在上（放大，占画布宽度 88%），slogan 在下且**宽度与图标完全一致**（按原始比例等比缩放，不拉伸变形）
  - 上下间距 26px，整体高度 1199px ≈ 画布边长 → 严格 1:1 正方形
- 侧栏品牌区替换原「B」色块：左侧为 52×52 正方形标识，右侧保留「BrandStudio / AI 电商内容工作台」文字，
  文字改为中性墨色，让 logo 的蓝青渐变成为视觉焦点（悬停仍变品牌蓝）。
- 浏览器图标（favicon）由内联 SVG「B」改为 `logo-icon.png`（小尺寸下仅图标更易辨识），
  Apple Touch 图标使用 `logo-square.png`；页面标题更新为「996.chat · BrandStudio AI 电商内容工作室」。
- 素材处理：16bit → 8bit、512×512、PNG 透明通道、`-strip` 去元数据，单文件 156KB / 118KB。

### 验证

- CDP 实测 1440 / 375 两档断点：`scrollWidth == clientWidth`，**无横向溢出**，控制台 0 报错
- `vite build` 通过，`dist/brand/` 下两个素材正确产出
- 侧栏实测：标识呈 1:1 正方形，图标在上、slogan 在下且等宽，无变形

---

## v0.1.0 · 2026-10-26

**主题**：导航结构重排 + 首页上下分区改版 + 全局返回能力补齐 + 额度入口升级

### 1. 左侧导航栏重构（模板库拆分为两个独立板块）

- 侧栏「模板库」不再是一块混合列表，拆为两个**独立板块**：
  - **图片类目**：产品主图(3) · 系列套图(3) · 模特上身(2) · 生图改图(5)
  - **视频类目**：视频创作(4)
- 每个板块下分组展示各自的模板数量，点击任一子类目直接进入该分组的模板列表
  （`/templates?cat=<分类id>`），图片与视频模板不再混杂无序。
- 侧栏顶部保留「功能导航」（模板库 / 自由工作台），底部保留服务模式标识、提示文案，并新增版本号展示。
- 模板库页面同步改为**两级分组**展示：`图片类目` / `视频类目` → 子分类 → 模板卡片；
  顶部筛选条新增「图片类目 / 视频类目」快捷筛选，并支持 `?type=image|video` 直达。
- 侧栏分组数据由后端模板库实时聚合（`GET /api/templates`），新增模板后导航计数自动更新。

### 2. 顶部「剩余额度」交互优化（悬停浮层）

- 「剩余额度 N」改为可点击胶囊，鼠标**悬停即在其下方自动弹出**浮层，内含两个入口：
  - **充值** → `/recharge` 充值额度页
  - **用户设置** → `/settings` 用户设置页
- 支持键盘操作（`focus-within` 自动展开）与触屏点击展开（`.open` 状态），点击空白处自动收起。
- 浮层沿用既有设计语言：白卡片 + 细边框 + 阴影，图标为 Lucide 风格内联 SVG。

### 3. 首页布局按上下比例划分（75% / 25%）

- **上方约 75%（预览区）**：展示各类快捷创作模板卡片（图片类 + 视频类混合，覆盖 4 个图片子类目与 4 个视频模板），
  卡片可点击直接进入创作，右侧保留累计作品 / 今日创作 / 剩余额度统计与「查看全部模板」入口。
- **下方约 25%（快捷创作栏）**：提供两个快捷创作板块
  - **图片生成** → 图片类目模板（产品主图 / 系列套图 / 模特上身 / 生图改图）
  - **视频生成** → 视频类目模板（种草 / 上身 / TVC / 开箱）
- 比例由 CSS Grid `3fr / 1fr` + 视口高度约束实现，严格保持 75% : 25%；
  预览区内容超出时内部滚动，底部带渐隐提示，页面主体不产生横向溢出。
- 小屏（≤960px）自动降级为自然堆叠，模板卡片单列展示。

### 4. 全局补齐返回功能（统一「返回上一页」）

- 顶栏左侧新增**统一「返回上一页」按钮**，全局常驻（无可回退来源时置灰禁用）。
- 新增内部访问栈（`historyStack`）实现来源页追踪：
  - 侧栏分类 → 模板详情 → 返回，正确回到 `/templates?cat=...`
  - 我的作品 → 充值页 → 返回，正确回到 `/works`
  - 浏览器地址栏 hash 同步更新，浏览器前进/后退与内部栈自动对齐。
- 模板详情由弹窗升级为**独立页面**（`/templates/:id`），展示：需要准备 / 预计耗时 / 消耗额度 /
  系统内部提示词预览 / 可点选微调项 / 使用建议 / 同类模板 / 「做同款」。
- 新增两个页面并配齐返回能力：
  - **充值页** `/recharge`：当前余额、3 档额度包（体验包 / 标准包 / 专业包）、额度消耗说明、演示环境说明
  - **用户设置页** `/settings`：账户资料（昵称、店铺名）、创作偏好（默认比例 / 清晰度 / 视频时长 / 自动存档）、账户信息、本地数据重置
- 创作页、自由工作台的页面级「← 模板库」统一替换为「返回上一页」，行为一致。

### 新增 / 变更文件

| 文件 | 说明 |
|---|---|
| `frontend/src/main.js` | 重写：路由表（新增 `:id` 参数匹配）、访问栈与统一返回、侧栏分组、顶部导航、额度浮层 |
| `frontend/src/views/home.js` | 重写：75% 预览区 + 25% 快捷创作栏 |
| `frontend/src/views/templates.js` | 重写：图片/视频两级分组展示 + `?cat=` / `?type=` 过滤 |
| `frontend/src/views/templateDetail.js` | **新增**：模板详情独立页 |
| `frontend/src/views/recharge.js` | **新增**：充值额度页 |
| `frontend/src/views/settings.js` | **新增**：用户设置页 |
| `frontend/src/views/create.js` | 顶部改为统一「返回上一页」 |
| `frontend/src/views/studio.js` | 顶部改为统一「返回上一页」 |
| `frontend/src/store.js` | 新增 `addCredits` / `getProfile` / `setProfile` / `resetLocalData` |
| `frontend/src/icons.js` | 新增 chevron-down / chevron-right / credit-card / settings / wallet / rotate-ccw |
| `frontend/src/version.js` | **新增**：版本号常量 `APP_VERSION = 'v0.1.0'` |
| `frontend/src/styles/main.css` | 新增侧栏分组、顶部导航、额度浮层、返回按钮、首页 75/25、详情/充值/设置页样式 |
| `frontend/package.json` / `backend/package.json` | 版本号 `0.1.0` |

### 兼容性说明

- 视觉风格、配色、卡片/按钮/表单组件样式保持不变，仅新增与重排，未改动既有设计变量。
- 原有功能全部保留：模板筛选与做同款、三步创作流、自由工作台与「优化提示词」、我的作品、
  新手引导、额度扣减/退回、MOCK 演示模式。
- 后端接口未变更，模板库聚合直接复用 `GET /api/templates`。
- 数据兼容：额度与新偏好写入 `localStorage`（`bs-wallet` / `bs-profile`），老用户额度不受影响。

### 验证记录（无头浏览器实测）

- 10 条路由（`/`、`/templates`、`/templates/:id`、`/create`、`/studio`、`/works`、`/recharge`、
  `/settings`、`/templates?type=video`、`/templates?cat=tryon`）全部渲染正常，**0 处「页面加载出错」**。
- 首页实测网格行高 `520.5px / 173.5px`，即精确 **75% : 25%**。
- 额度浮层实测 `display: block`，包含「充值」「用户设置」两项，定位在额度胶囊下方。
- 导航链路实测：侧栏「产品主图」→ 模板详情 → 返回上一页 → 正确回到 `/templates?cat=main-image`；
  我的作品 → 额度浮层「充值」→ 顶栏返回 → 正确回到 `/works`；首页「视频生成」快捷入口 →
  `/templates?type=video`（1 个分组 / 4 个视频模板）。
- `vite build` 通过：`19 modules transformed`，无报错。
