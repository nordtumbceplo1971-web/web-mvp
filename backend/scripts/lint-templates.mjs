/**
 * 模板系统体检 (静态校验, 不调用任何生成接口)
 *
 * 用法: node backend/scripts/lint-templates.mjs [--verbose]
 *
 * 校验项:
 *  1. 必填字段齐全 / id 唯一
 *  2. promptTemplate 里的 {{占位符}} 都有对应槽位 (无悬空占位符)
 *  3. 每个槽位都被 promptTemplate 引用 (无死槽位 —— UI 上能点但对提示词无影响)
 *  4. 选项槽位: value 唯一、label/color/prompt 非空
 *  5. 文本槽位被引用时必须有 defaultValue 或 fallbackPrompt (否则提示词出现空洞)
 *  6. 必须含负向约束 (禁止改产品 / 禁止加水印文字 / 禁止畸形…)
 *  7. 参考图模板必须写明参考图角色 (图1 是产品唯一来源…)
 *  8. 提示词长度区间 (过短 <120 说明没写开, 过长 >2200 说明塞太多)
 *  9. composePrompt 默认组装结果: 不残留 {{}}、长度达标
 */
import { templates, composePrompt } from '../src/modules/templates/templates.js';

const verbose = process.argv.includes('--verbose');
const errors = [];
const warns = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warns.push(`${id}: ${msg}`);

const NEGATIVE_HINTS = ['禁止', '不要', '不得', 'NEGATIVE', '负面'];
const REF_ROLE_HINTS = ['图1', '第1张', '参考图', '唯一来源', '唯一参考'];

const REQUIRED = ['id', 'type', 'category', 'title', 'subtitle', 'timeLabel', 'credits', 'needLabel', 'defaults', 'promptTemplate', 'slots', 'tips'];
const seenIds = new Set();

for (const t of templates) {
  const id = t.id ?? '(no-id)';
  if (seenIds.has(t.id)) fail(id, '模板 id 重复');
  seenIds.add(t.id);
  for (const f of REQUIRED) {
    if (t[f] === undefined || t[f] === null || t[f] === '') fail(id, `缺少必填字段 ${f}`);
  }
  if (!['image', 'video'].includes(t.type)) fail(id, `type 非法: ${t.type}`);
  if (!Number.isFinite(t.credits) || t.credits <= 0) fail(id, `credits 非法: ${t.credits}`);

  const prompt = t.promptTemplate ?? '';
  const slots = t.slots ?? [];
  // 直通模板 (纯净模式): 提示词原样传给模型, 不套框架 → 跳过质量规则
  const passthrough = Boolean(t.passthrough);
  const slotKeys = new Set(slots.map((s) => s.key));
  const refs = [...prompt.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

  // 2. 悬空占位符
  for (const key of new Set(refs)) {
    if (!slotKeys.has(key)) fail(id, `占位符 {{${key}}} 没有对应槽位`);
  }
  // 3. 死槽位 (纯静态模板才检查; lookbook 模板的提示词由步骤动态组装)
  if (!t.isLookbook) {
    for (const s of slots) {
      if (!refs.includes(s.key)) fail(id, `槽位 ${s.key} 未被 promptTemplate 引用 (死槽位)`);
    }
  }
  // 4/5. 槽位完整性
  for (const s of slots) {
    if (s.type === 'text') {
      if (refs.includes(s.key) && !passthrough && !s.defaultValue && !s.fallbackPrompt) {
        fail(id, `文本槽位 ${s.key} 被引用但没有 defaultValue / fallbackPrompt (提示词会留空洞)`);
      }
      continue;
    }
    if (!Array.isArray(s.options) || !s.options.length) { fail(id, `选项槽位 ${s.key} 没有 options`); continue; }
    const vals = new Set();
    for (const o of s.options) {
      if (!o.value) fail(id, `槽位 ${s.key} 有选项缺少 value`);
      if (vals.has(o.value)) fail(id, `槽位 ${s.key} 的 value 重复: ${o.value}`);
      vals.add(o.value);
      if (!o.label) fail(id, `槽位 ${s.key} 的选项 ${o.value} 缺少 label`);
      if (!o.color) fail(id, `槽位 ${s.key} 的选项 ${o.value} 缺少 color`);
      if (!o.prompt?.trim()) fail(id, `槽位 ${s.key} 的选项 ${o.value} 缺少 prompt 描述 (模型会收到空描述)`);
    }
  }
  // 6. 负向约束
  if (!passthrough && !NEGATIVE_HINTS.some((h) => prompt.includes(h))) fail(id, 'promptTemplate 缺少负向约束段');
  // 7. 参考图角色
  if ((t.needImages ?? 0) > 0 && !t.isLookbook && !passthrough) {
    if (!REF_ROLE_HINTS.some((h) => prompt.includes(h))) fail(id, '需要参考图但没写明参考图角色 (图1 是什么)');
  }
  // 8. 长度
  if (!passthrough) {
    if (prompt.length < 120) warn(id, `promptTemplate 偏短 (${prompt.length} 字符), 可能写不透`);
    if (prompt.length > 2200) warn(id, `promptTemplate 过长 (${prompt.length} 字符), 建议拆段`);
  }

  // 9. 默认组装
  const defaults = {};
  for (const s of slots) defaults[s.key] = s.type === 'text' ? '' : s.options?.[0]?.value;
  const composed = composePrompt(t, defaults);
  if (composed.includes('{{')) fail(id, `默认组装结果仍残留占位符: ${composed.match(/\{\{\w+\}\}/g)?.join(',')}`);
  if (!passthrough && composed.length < 150) warn(id, `默认组装结果偏短 (${composed.length} 字符)`);
  if (verbose) console.log(`\n--- ${id} (${composed.length} 字符)\n${composed}`);
}

// 汇总
console.log(`模板总数: ${templates.length} (校验 ${templates.length} 个)`);
if (warns.length) {
  console.log(`\n警告 ${warns.length} 条:`);
  for (const w of warns) console.log('  WARN  ' + w);
}
if (errors.length) {
  console.log(`\n错误 ${errors.length} 条:`);
  for (const e of errors) console.log('  FAIL  ' + e);
  process.exit(1);
}
console.log('\n✅ 模板系统体检通过 (0 错误)');
