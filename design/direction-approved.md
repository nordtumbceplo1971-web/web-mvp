# direction-approved

## v2 重塑（2026-10-26，用户反馈驱动）

用户明确反馈 v1（Friendly Candy）「太像 DEMO，不够严肃和商业化」，给出方向：
**强引导 + 弱风格化 + 严肃商业化 + 现代化审美**，风格控制交给 `ui-ux-pro-max-skill`
（本地 zip：`ui-ux-pro-max-skill-main.zip`，搜索引擎 `search.py --domain/style/color/ux/icons`）。

v2 决策（依据 skill 检索结果 `--design-system --variance 2 --motion 2 --density 7`）：

- **风格**：Minimalism & Swiss Style（skill 推荐 SaaS/专业工具首选）——白卡片、细边框、网格化、高对比
- **布局**：对用户参考图——左侧功能导航（品牌/导航/服务模式）+ 顶栏（页面标题/额度/引导）+ 分区内容
- **图标**：skill 交付清单硬性要求「No emojis as icons (use SVG: Heroicons/Lucide)」——
  全站 emoji 图标替换为 `frontend/src/icons.js` 内联 Lucide 风格 SVG（约 30 个）
- **色板**：slate 灰阶中性色 + 专业蓝 `#2563EB`（行动/激活/引导同源）+ 语义色（成功绿/警示琥珀/危险红）；
  弱化分类点缀色为低饱和 tint（蓝/紫/橙/绿/灰，仅作扫读区分）
- **字体**：Inter + Noto Sans SC fallback 链（替换圆体 Nunito）
- **可访问性**（skill 清单）：hover 150-300ms、对比度 4.5:1、`:focus-visible` 焦点环、
  `prefers-reduced-motion` 降级、375/768/960/1440 响应式断点、可跳过的新手引导（蓝色聚光）
- **去玩具化**：凸起糖果按钮→平面按钮；相机转盘加载→线性 spinner；emoji 文案按钮→纯文字；
  「💎 额度」→「剩余额度 N」；步骤 ①②③→蓝色步骤徽章

v1 的 Friendly Candy 方案归档不再使用（过度风格化，与商业定位冲突）。

---

## v1（已废弃，仅存档）

- 项目：BrandStudio MVP（AI 电商自动化创作平台）
- 本会话为无人值守自动化构建（用户不在场），按 huashu-design SKILL.md「唯一豁免」条款记录理由。
- 豁免理由：本次为生产级 Web App（前后端分离系统），SKILL.md 明示「生产级 Web App / 需后端的系统不适用」，
  三方向门按 HTML 原型流程设计；在自治模式下不阻塞等待用户选择，改为：选定 1 个主方向 + 记录 2 个备选方向，
  交付后用户可随时要求换方向重做皮肤。

## 候选方向（参考 huashu-design 风格库 web 分区）

1. **Friendly Geometric Candy（糖果凸起按钮游戏化，Duolingo 谱系）— 已选定**
   - 样张：`assets/style-specimens/web/04-friendly-candy.jpg`（本仓库 .design-tmp 内）
   - 选择理由：目标用户是 0 基础电商从业者（PRD 画像 A/B，40+ 工厂老板、1 人运营），
     「可按压的凸起按钮」「大圆角卡片」「进度徽章」提供最强的操作暗示（affordance），
     与需求 0/7 的「视觉引导、小白友好」直接对位。还原度 85%，纯 CSS 可达。
2. Humanist Rounded Cards（Khan 式人文圆角卡片）— 备选，更安静，但操作暗示弱一档。
3. Bauhaus Geometric（包豪斯几何）— 备选，视觉个性强，但对中老年新手略「冷」。

## 色彩推导（协议：采样 → 收敛 → 论证）

- 采样：电商语境的「行动橙」（货架、购买按钮的色彩记忆：淘宝橙/亚马逊橙家族）。
- 收敛（oklch 思路，压 chroma 至油墨感）：
  - 主色 行动橙 `#F96D02`（按压暗版 `#C25400` 用于凸起底阴影）
  - 辅色 完成绿 `#00A876`（生成完成的「出片」信号，暗版 `#00835D`）
  - 信息蓝 `#1CB0F6`（步骤条/链接，暗版 `#1899D6`）
  - 引导黄 `#FFC800`（仅用于新手引导聚光环与「这里操作」高亮，小面积点睛）
  - 中性 暖灰序列：`#26221E / #6B6259 / #A69D92 / #EFEAE3 / #FAF8F4`（纸感底）
- 论证：主色取电商行动橙并压至油墨饱和度——购买/上架动作的色彩记忆让用户「知道该点哪」；
  黄聚光只出现在新手引导与当前操作区，是「视觉引导」的专用信号，不与功能色混用。

## 字体

- fallback 链（西文在前）："Nunito", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif
- display 用 900 字重；正文 ≥14px、可点元素 ≥44×44px、对比度 ≥4.5:1（web.md 硬规则）。

## 视觉母题

- 糖果凸起按钮：`box-shadow: 0 4px 0 <暗色>` + `:active translateY(4px)`（可按压感）
- 2px 边框 + 16~24px 圆角卡片；胶囊徽章；步骤条圆点
- 新手引导：黄色聚光环 + 遮罩 + 气泡文案，3 步互动引导（需求 7）
