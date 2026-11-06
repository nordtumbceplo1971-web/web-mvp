/**
 * 组装结果回归断言 (不调用任何生成接口)
 * 用法: node backend/scripts/check-composed.mjs [--print]
 */
import { templates, composePrompt } from '../src/modules/templates/templates.js';

const print = process.argv.includes('--print');
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
// 负向约束写法: 中文「负面约束」或英文「NEGATIVE」都算
const hasNegative = (s) => ['负面约束', 'NEGATIVE', '禁止', '不要', '不得'].some((h) => s.includes(h));

for (const t of templates) {
  if (t.passthrough) continue;
  // 用「非默认」槽位值, 验证能解析成对应 option.prompt 描述
  const values = {};
  for (const s of t.slots ?? []) {
    if (s.type === 'text') values[s.key] = '';
    else values[s.key] = s.options?.[Math.min(1, s.options.length - 1)]?.value;   // 取第二个选项
  }
  const composed = composePrompt(t, values);

  // 1. 不得残留占位符
  ok(!composed.includes('{{'), `${t.id}: 残留占位符 ${composed.match(/\{\{\w+\}\}/g)?.join(',')}`);
  // 2. 选项槽位必须解析成描述, 而非枚举值本身 (用最小模板精确验证, 避免正文同名词误判)
  for (const s of t.slots ?? []) {
    if (s.type === 'text') continue;
    const chosen = s.options.find((o) => o.value === values[s.key]);
    if (!chosen?.prompt) continue;
    const only = composePrompt({ ...t, promptTemplate: `{{${s.key}}}` }, { [s.key]: values[s.key] });
    ok(only === chosen.prompt, `${t.id}: 槽位 ${s.key} 解析结果是 ${JSON.stringify(only)} 而不是描述文本 ${JSON.stringify(chosen.prompt.slice(0, 30))}`);
    ok(composed.includes(chosen.prompt), `${t.id}: 组装结果里找不到槽位 ${s.key} 的描述文本`);
  }
  // 3. 文本槽位未填时用默认/兜底文案
  for (const s of t.slots ?? []) {
    if (s.type !== 'text') continue;
    const fallback = s.defaultValue || s.fallbackPrompt;
    if (fallback) ok(composed.includes(fallback), `${t.id}: 文本槽位 ${s.key} 未使用默认值 ${fallback}`);
  }
  // 4. 结构完整性
  ok(hasNegative(composed), `${t.id}: 缺少负向约束段`);
  if ((t.needImages ?? 0) > 0 && !t.isLookbook) {
    ok(/参考图|第1张|图1/.test(composed), `${t.id}: 缺少参考图角色说明`);
  }
  // 5. 长度
  ok(composed.length >= 150, `${t.id}: 组装结果过短 (${composed.length})`);
  if (print) console.log(`\n===== ${t.id} · ${t.title} (${composed.length} 字符)\n${composed}`);
}

if (errors.length) {
  console.log(`断言失败 ${errors.length} 条:`);
  for (const e of errors) console.log('  FAIL  ' + e);
  process.exit(1);
}
console.log(`✅ 组装回归断言全部通过 (${templates.filter((t) => !t.passthrough).length} 个模板)`);
