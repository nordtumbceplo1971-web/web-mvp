import { getProfile } from './store.js';

/**
 * 出图比例 —— 全站唯一来源
 * - 图片: 与上游图片模型 aspect_ratio 枚举对齐 (gpt-image-2.5-flare / sunburst)
 * - 视频: veo-4-omni 只支持 16:9 / 9:16
 */
export const IMAGE_ASPECTS = ['1:1', '3:4', '4:5', '9:16', '9:21', '16:9'];
export const VIDEO_ASPECTS = ['9:16', '16:9'];

/**
 * 解析实际出图比例
 * 优先级:
 *   1. 模板锁定了比例 (lockAspect, 如平台白底图规范 1:1 / 详情页长图 9:21) → 用模板的
 *   2. 视频模板 → 用模板的 (视频模型不支持 4:5 等比例)
 *   3. 用户在「用户设置 → 创作偏好」显式指定过比例 → 用用户的
 *   4. 否则 → 用模板自带的
 *
 * @param {object|string} tpl 模板对象 (含 defaults.aspect_ratio, 可选 lockAspect), 或直接给比例字符串
 * @param {{ isVideo?: boolean }} [opts]
 */
export function resolveAspect(tpl, { isVideo = false } = {}) {
  const isObj = tpl && typeof tpl === 'object';
  const templateAspect = isObj ? tpl.defaults?.aspect_ratio : tpl;
  if (isVideo || (isObj && tpl.lockAspect)) return templateAspect;
  const { aspectRatio, aspectRatioSet } = getProfile();
  if (aspectRatioSet && IMAGE_ASPECTS.includes(aspectRatio)) return aspectRatio;
  return templateAspect;
}
