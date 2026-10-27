/**
 * 模特生成提示词模板 (AI 生成模特)
 *
 * 模板来源: 用户配好的「AI 模特库 · 生图提示词」
 *   D:\Downloads\AI模特库_生图提示词.md  →  〇、通用提示词模板 + 通用负面提示词
 *
 * 规格: 16:9 横向画布, 三视图排版 (左半 = 全身像 | 右上 = 半身正面 | 右下 = 转身背对)
 * 产物用途: 生成「模特形象参考图」, 之后作为套图线路 b 的身份参考图, 与系统模特库形态一致。
 *
 * ⚠️ 若用户换了新版 skill, 只改下面两个常量即可。
 */

/** 通用提示词模板 — {idea} 处填用户描述的模特形象 */
export const MODEL_GENERATION_TEMPLATE = `Character reference sheet, 16:9 landscape canvas containing three views of the same person arranged in one single image:
LEFT HALF — full-body standing shot, head to toe, relaxed natural stance, weight on one leg, arms hanging naturally away from the body so the full outfit reads clearly;
RIGHT UPPER QUADRANT — half-body portrait from the waist up, facing the camera, natural relaxed expression, eyes toward the lens;
RIGHT LOWER QUADRANT — half-body turn-around shot from behind, back to the camera, head turned slightly so the shoulder line and the back of the hairstyle read clearly;
strict three-panel layout: left panel occupies exactly 50% of the canvas width, right column split into two equal quadrants stacked vertically.

Subject: {idea}.
Outfit: plain pure-white crew-neck cotton T-shirt, slightly relaxed fit, sleeves ending mid-bicep, paired with neutral-tone everyday trousers; no graphic prints, no text, no logos, no patterns.
Expression: natural, relaxed and unforced, no staged smile.

Clean seamless light-grey studio background, soft even editorial studio lighting, identical lighting and color grading across all three views, exposure compensated for the white garment with visible fabric folds and soft shadows in the white cotton, photorealistic high-fashion editorial photography, shot on 85mm lens, sharp fabric texture, neutral color grade, 8K detail, no graphic overlay, no text, no logo.`;

/** 通用负面提示词 (负向锁定, 每次都带) */
export const MODEL_NEGATIVE_PROMPT = `Negative prompt: extra fingers, extra limbs, deformed hands, twisted neck, asymmetric duplicated body, face identity change between views, clothing change between views, print or text on the shirt, colored or graphic tee, beard on female subject, plastic skin, overly retouched porcelain skin, exaggerated body proportions, anime or illustration style, busy background, props, watermark, logo, text, panel border errors, cropped feet in the full-body view.`;

/**
 * 用用户想法填充模板
 * @param {string} idea 用户描述的模特形象
 * @returns {string} 完整提示词 (正向 + 负向)
 */
export function composeModelPrompt(idea) {
  const text = String(idea || '').trim();
  if (!text) throw new Error('请描述你想要的模特形象');
  return `${MODEL_GENERATION_TEMPLATE.replace('{idea}', text)}\n\n${MODEL_NEGATIVE_PROMPT}`;
}
