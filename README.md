# 996 Studio · AI 电商自动化创作平台

> **一个想法 + 选一个模板 = 一套可直接上架的品牌内容。**
> 面向 0 基础电商从业者：不写提示词、不选模型、不调参数——上传产品图、点选微调、点生成。

**当前版本：v0.1.2**（版本号规则 `v0.1.n`，每次更新递增一位；更新明细见 [`CHANGELOG.md`](./CHANGELOG.md)）

**品牌标识**：`frontend/public/brand/logo-square.png` —— 996 图标在上、996.chat slogan 在下的 1:1 正方形组合
（`logo-icon.png` 为纯图标，用于浏览器 favicon）

## 快速启动

```bash
# 1) 后端 (端口 8787)
cd backend
npm install
cp .env.example .env      # 填入 UPSTREAM_API_KEY 后为真实调用; 留空 = MOCK 演示模式
npm start

# 2) 前端 (端口 5173, 代理 /api 到后端)
cd frontend
npm install
npm run dev
```

打开 http://127.0.0.1:5173 —— 首次进入自动弹出 5 步新手引导（金色聚光 + 遮罩），可随时点右上角「新手引导」重看。

**MOCK 模式**：未配置 `UPSTREAM_API_KEY` 时，生成/优化走本地模拟（约 9 秒出占位结果，明确标注「示意」，不产生任何费用）。配置密钥后自动切换为真实调用上游。

---

## 部署到 Vercel（前端 + API 同域一体部署）

仓库已按「同一个 Vercel 项目同时托管静态前端与 Serverless API」改造完毕：
静态页面来自 `frontend/dist`，`/api/*` 由根目录 `api/[...path].js`（Express 应用）承接，**同域、无跨域**。

### 必改的一处设置：Root Directory

之前只部署前端时 Root Directory 指向了 `frontend`，这样 Vercel 看不到根目录的 `api/` 函数，
于是页面能打开但 `/api/health` 404 → 侧栏显示「后端未连接」。**把 Root Directory 改成仓库根目录即可。**

| Vercel 设置项 | 值 |
|---|---|
| **Root Directory** | `/`（仓库根目录，**清空原来的 `frontend`**） |
| Framework Preset | Other |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `frontend/dist` |

> 以上四项已写进仓库根目录 `vercel.json`，若 Vercel 控制台里手动改过，**控制台优先级更高**，请按表核对。

### 环境变量（可选）

| 变量 | 作用 | 建议 |
|---|---|---|
| `UPSTREAM_API_KEY` | 上游模型密钥 | **留空** = MOCK 演示模式，零费用、可完整跑通全流程；填入 = 真实调用（会产生费用） |
| `CORS_ORIGIN` | 允许跨域来源 | 同域部署留空即可 |
| `WORKS_DATA_DIR` | 作品持久化目录 | 默认自动降级（见下「数据持久化」） |

### 部署后自检

1. 打开站点 → 左下角应显示 **「演示模式 · 未配置 API 密钥」**（不再是「后端未连接」）
2. 直接访问 `https://<你的域名>/api/health` → 应返回 `{"ok":true,"mode":"mock",...}`
3. 走一遍「模板库 → 做同款 → 上传 → 生成」→ 约 9 秒出占位图（明确标注「示意」）

### Serverless 适配要点（已内置）

| 原问题 | 适配方案 |
|---|---|
| MOCK 任务状态存在内存/文件里，冷启动后轮询会永远停在 pending | 任务 ID 自描述（`mock-{类型}-{张数}-{时间戳36进制}-{uuid}`），进度纯靠 ID 解析，**跨实例也能正确推进** |
| 作品存在 `backend/data/works.json`，Serverless 文件系统只读且实例级 | 三级降级：指定目录 → 本地 `backend/data` → `/tmp/996-studio-data`（实例内持久）→ 纯内存 |
| 反向代理下 `req.protocol` 是 http，导致占位图地址变成 http（浏览器按混合内容拦截） | 读取 `x-forwarded-proto` / `x-forwarded-host` 还原真实对外地址 |
| `/mock-assets` 占位素材在后端静态目录，函数只接管 `/api/*` | 同步一份到 `frontend/public/mock-assets/`，由 Vercel 静态托管 |
| 根目录缺少 package.json，函数找不到 express 等依赖 | 新增根 `package.json`（含后端依赖 + build 脚本），Vercel 安装后即可打包函数 |

### 数据持久化说明

Serverless 无状态，作品数据默认落在**函数实例的 `/tmp`**：同一实例内可见，冷启动或实例轮换后会丢失
（演示完全够用，不影响跑通流程）。需要长期保存可任选其一：
- Vercel KV / Upstash Redis（推荐，改 `backend/src/modules/works/store.js` 的存储实现）
- 把后端部署到 Render / Railway 等常驻 Node 平台（自带磁盘），前端改为指向该域名

### 备选方案：后端独立部署

若不想用 Serverless，可把 `backend/` 部署到 **Render / Railway / Fly.io**（常驻 Node + 持久磁盘），
前端在 `frontend/src/api.js` 的 `request()` 里把相对路径改为该后端的绝对地址即可
（后端已支持 `CORS_ORIGIN` 白名单配置）。

---

## 与需求的对应

| 需求 | 实现 |
|---|---|
| 0. 小白友好 + 视觉引导 + 模块层级 | 严肃商业 SaaS 控制台（ui-ux-pro-max-skill 规范，见 `design/direction-approved.md` v2）：左侧功能导航 + 顶栏 + 分区布局，专业蓝聚焦引导环 + 步骤徽章 + 可跳过新手引导 |
| 主图 / 套图 / 上身图 / 种草视频(多语言) / 上身视频 / TVC | 模板库 17 个任务模板（`backend/src/modules/templates/templates.js`） |
| 1. 前后端分离 | Express 8787 + Vite 5173，REST API |
| 2. 模型数据按上游 API 文档配置 | `backend/src/config.js` + `src/upstream/client.js`，接口形态严格照《上游API文档.md》 |
| 3. 模型接入 | 图片 `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`；视频 `veo-4-omni`；文本 `glm-5.3-flash`(视觉理解) |
| 4. 模块化设计 | 后端 `modules/{templates,generation,works,prompt}` + `upstream/`；前端 `views/` 每页一模块 + `api/ui/store/tour` 基础件 |
| 5. 界面风格控制 | ui-ux-pro-max-skill（Minimalism & Swiss Style + slate 灰阶 + 专业蓝），初版方向探索由 huashu-design 风格库提供 |
| 6. 灵活交互 | 点选微调（色块圆点）、折叠「更多想法」、失败自动退额度、换一批首次免费 |
| 7. 页面初始化视觉引导 | 首次访问自动 5 步聚光引导（`frontend/src/tour.js`） |
| 8. 生图改图多需求模板 | 自由工作台内置 17 个快捷需求模板，一键套用提示词框架 |
| 9. 「优化提示词」按钮 | 接入 glm-5.3-flash 视觉理解：上传图 + 大白话 → 看图改写（`backend/src/modules/prompt/optimizer.js` 内置系统提示词） |
| 10. 参考资料方法论 | 提示词模板按「镜头/构图 + 主体 + 场景 + 布光 + 风格 + 商业规格」公式编写 |
| 11. tabbit CLI 自动化验收 | 已完成（见下「验收记录」） |
| 12. 不代跑真实生成 | 默认 MOCK；真实生成由你配置密钥后自行操作 |
| v0.1.0 界面改动 | 侧栏模板库拆分「图片类目 / 视频类目」两块分组展示；顶栏新增「首页 / 我的作品」入口与统一「返回上一页」；「剩余额度」悬停浮出「充值 / 用户设置」；首页改为 75% 预览区 + 25% 快捷创作栏（详见 `CHANGELOG.md`） |

## 架构

```
backend/                     Express (端口 8787)
  src/
    config.js                环境配置 + 模型 ID（.env 可覆盖）
    routes.js                REST 路由（/api/*）
    index.js                 入口 + 错误处理
    upstream/client.js       上游 API 客户端（按文档判定成败: body.error 而非 HTTP 状态码）
    mock-assets/             MOCK 模式占位素材（诚实标注「示意」）
    modules/
      templates/templates.js 17 个任务模板 + 槽位系统 + 提示词组装
      generation/service.js  图片(统一调用入口, 真异步) / 视频(/v1/media/generate)
      generation/taskSimulator.js  MOCK 任务生命周期模拟
      works/store.js         作品持久化 (data/works.json)
      prompt/optimizer.js    「优化提示词」: glm-5.3-flash + 内置视觉理解系统提示词
frontend/                    Vite + 原生 JS 模块 (端口 5173)
  src/
    main.js                  应用外壳 + hash 路由 + 访问栈(统一返回) + 侧栏分组 + 额度浮层
    api.js / ui.js / store.js / tour.js / tplMeta.js / version.js / announcements.js（轮播公告数据源）
    styles/main.css          设计系统 (slate 灰阶 + 专业蓝, 变量化)
    views/  home / templates / templateDetail / create / studio / works / recharge / settings
design/
  direction-approved.md      设计方向 gate（选定理由 + 色彩推导论证）
CHANGELOG.md                 更新日志 (v0.1.0)
```

### API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（返回 mock/live 模式与模型配置） |
| GET | `/api/templates` | 模板列表（支持 `?category=&type=` 过滤） |
| GET | `/api/templates/:id` | 模板详情 |
| POST | `/api/templates/:id/preview-prompt` | 预览组装后的提示词 |
| POST | `/api/uploads` | 上传文件 → 公网 URL（走上游 `/v1/files`） |
| POST | `/api/generate/image` | 图片生成（上游 `/api/v1/model-runtime/invoke`） |
| POST | `/api/generate/video` | 视频生成（上游 `/v1/media/generate`） |
| GET | `/api/tasks/:taskId` | 任务状态轮询（上游 `/v1/tasks/:id`） |
| POST | `/api/prompt/optimize` | 优化提示词（glm-5.3-flash, 支持参考图） |
| GET/DELETE/PATCH | `/api/works` | 我的作品 |

## 验收记录（tabbit CLI 自动化）

2026-10-26，全程 Playwright 驱动，结果全部通过：

- **首页**：hero/分类卡/推荐模板渲染正常；新手引导遮罩自动出现，5 步走完后正确消失
- **模板库**：6 分类 chips 过滤正常（视频分类 4 个模板）；详情弹窗展示「需要准备/耗时/额度 + 系统内部提示词」
- **图片创作流**（白底主图模板）：上传 → 填产品名 → 点选「自然光」→ 生成 → 拟物进度（打光/布景/拍摄）→ 出片入作品
- **自由工作台**：上传参考图 → 大白话提示词 → 「优化提示词」改写生效 → 生成出片
- **视频创作流**（种草卖家秀）：切换 English 语言 + 直播间场景 → 生成 → `<video>` 结果可播放
- **我的作品**：作品卡片、MOCK 标注、「再做一张」跳转正常
- **控制台**：全程 0 报错
- **响应式**：375px 无横向溢出（修复过一处顶栏溢出），1440px 正常

截图存于 Tabbit artifacts（任务「BrandStudio 验收」）。

### v0.1.0 界面改动验收（CDP 自动化）

用 `node tools/page-check.mjs <宽> <高> [hash]`（Node 22 内置 WebSocket 驱动本机 Edge，无需额外依赖）逐页体检：

- **路由渲染**：8 条路由（`/` `/templates` `/templates/:id` `/create` `/studio` `/works` `/recharge` `/settings`）
  标题正确、无「页面加载出错」、控制台 0 报错
- **响应式**：375 / 768 / 1440 三档均 `scrollWidth == clientWidth`，**无横向溢出**
- **首页上下比例**：实测网格行高 `520.5px / 173.5px`（精确 75% : 25%）
- **额度浮层**：实测 `display:block`，含「充值」「用户设置」，定位在额度胶囊下方
- **返回链路**：侧栏分类 → 模板详情 → 返回 → 正确回到 `/templates?cat=...`；我的作品 → 充值 → 返回 → 正确回到 `/works`

## 切换到真实生成（由你操作）

1. `backend/.env` 填 `UPSTREAM_API_KEY=sk-xxx`
2. 重启后端，`/api/health` 返回 `"mode": "live"`
3. 之后所有生成走真实上游；作品卡片的「MOCK 示意」角标消失

## 设计说明（v2 · 严肃商业化）

- 风格：ui-ux-pro-max-skill 检索推荐 **Minimalism & Swiss Style**（SaaS/专业工具首选）；v1 玩具化方向已废弃
- 布局：左侧功能导航（品牌/导航/服务模式标识）+ 顶栏（页面标题/额度/新手引导）+ 内容分区
- 色板：slate 灰阶中性色 + 专业蓝 `#2563EB`（行动/激活/引导同源）+ 语义色；分类点缀为低饱和 tint
- 图标：全站 Lucide 风格内联 SVG（`frontend/src/icons.js`），禁用 emoji 充当图标
- 字体：`Inter → Noto Sans SC → 系统中文` fallback 链
- 可访问性：hover 150-300ms、对比度 ≥4.5:1、`:focus-visible` 焦点环、`prefers-reduced-motion` 降级、375/768/960/1440 断点

## 已知边界（MVP 范围外）

- 品牌资产库 / 一键成套 / 登录体系 / 真实额度计费（PRD 列为 V2/V3；当前额度为 localStorage 演示值）
- MOCK 模式的「优化提示词」为本地规则版（追加电商出图公式），LIVE 模式才走 glm-5.3-flash 视觉理解
- 上传后的参考图在 LIVE 模式经上游 `/v1/files` 换公网 URL；MOCK 模式仅本地预览
