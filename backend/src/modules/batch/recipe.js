/**
 * 批量套图 · 配方定义 (Stage 1: 仅 Shopify 7 步套图)
 *
 * 自包含模块: 只 import 现有 shopify.js 的步骤与提示词组装, 不修改其代码。
 * 配方 = 有序 7 镜头 + 依赖图 + 每步规格/命名/质检线。
 * 依赖图与 lookbook 前端 (STEP_DEPS/EXEC_WAVES) 语义一致, 此处为服务端版。
 */
import { SHOPIFY_STEPS, composeShopifyPrompt } from '../templates/shopify.js';

export const RECIPE_ID = 'shopify-7';
export const PER_CELL_CREDITS = 2;

/** 步骤依赖 (前置节点须成功后才可跑); 07 特例: 03 成功可替代 01 */
export const STEP_DEPS = {
  '01': [],
  '02': ['01'],
  '03': ['01'],
  '04': [],
  '05': [],
  '06': [],
  '07': ['01', '06'],
};

/** 导出文件名里的镜头标识 */
const STEP_VIEW = {
  '01': 'main', '02': 'back', '03': 'outfit', '04': 'print',
  '05': 'fabric', '06': 'model-b', '07': 'lifestyle',
};

function step(id) {
  const s = SHOPIFY_STEPS.find((x) => x.id === id);
  return {
    id,
    name: s.name,
    desc: s.desc,
    needModel: s.needModel,
    needBack: !!s.needBack,
    view: STEP_VIEW[id],
    aspectRatio: '4:5',
    resolution: '2K',
    quality: 'high',
    minLongEdge: 1200, // 质检线: 长边低于此值判不合格 (避免误杀, 只拦明显坏图)
  };
}

export const RECIPE = {
  id: RECIPE_ID,
  name: 'Shopify 7 步套图',
  steps: SHOPIFY_STEPS.map((s) => step(s.id)),
};

export const stepById = (id) => RECIPE.steps.find((s) => s.id === id) ?? null;

/** 组装某行某步的提示词 (线路 b = 选了模特库模特; a = AI 自动建模) */
export function composeStepPrompt(row, stepId) {
  const mode = row.modelPublicUrl ? 'b' : 'a';
  return composeShopifyPrompt(mode, stepId, {
    productDesc: row.productDesc || row.productName || '产品',
    inspiration: row.inspiration || '',
    modelDesc: row.modelDesc || '',
    secondModelDesc: row.model2Desc || '',
    productBackAvailable: (row.images?.length ?? 0) > 1,
  });
}

/** 某格的参考图 (公网 URL 数组), 依赖格的产出作为身份/背景锚点 */
export function assetsForCell(project, row, stepId) {
  const imgs = row.images ?? [];
  const front = imgs[0];
  const back = imgs[1] || imgs[0];
  const cell = (sid) => project.cells[`${row.id}|${sid}`];
  const c01 = cell('01');
  const c03 = cell('03');
  const c06 = cell('06');
  // 主模特身份优先用 03 (全身), 回退 01, 再回退模特库封面
  const mainModelResult = c03?.url || c01?.url || row.modelPublicUrl;

  switch (stepId) {
    case '01': return [front, row.modelPublicUrl].filter(Boolean);
    case '02': return [back, c01?.url].filter(Boolean);
    case '03': return [front, c01?.url].filter(Boolean);
    case '04':
    case '05': return front ? [front] : [];
    case '06': return [front, row.model2PublicUrl].filter(Boolean);
    case '07': return [front, mainModelResult, c06?.url].filter(Boolean);
    default: return front ? [front] : [];
  }
}

/** 依赖是否就绪; 返回 null=可跑, 否则返回未就绪的依赖说明 */
export function checkDeps(project, row, stepId) {
  const unmet = [];
  for (const dep of STEP_DEPS[stepId] || []) {
    const c = project.cells[`${row.id}|${dep}`];
    if (c?.url) continue; // success 或 locked 均算就绪
    unmet.push(dep);
  }
  // 07 特例: 03 成功可满足主模特身份 (与 lookbook 前端逻辑一致)
  if (stepId === '07' && unmet.includes('01') && project.cells[`${row.id}|03`]?.url) {
    unmet.splice(unmet.indexOf('01'), 1);
  }
  return unmet.length ? `依赖镜头 ${unmet.join('/')} 未完成` : null;
}

/** 导出文件名: {sku}_{step:02d}_{view}_{w}x{h}.jpg (尺寸未知时省略段) */
export function cellFileName(row, stepDef, width, height) {
  const sku = sanitizeName(row.sku || row.id);
  const size = width && height ? `_${width}x${height}` : '';
  return `${sku}_${stepDef.id}_${stepDef.view}${size}.jpg`;
}

export function sanitizeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60) || 'unnamed';
}
