import { config, isMockMode } from '../../config.js';
import { chatCompletions } from '../../upstream/client.js';

/**
 * 「优化提示词」内置系统提示词 (需求 9)
 * 接入带视觉理解的 glm-5.3-flash: 用户给提示词 + 可选参考图,
 * 模型先看懂图片内容(类目/颜色/材质/构图/背景), 再把提示词改写得与图片强相关。
 */
export const OPTIMIZER_SYSTEM_PROMPT = `你是资深电商 AI 生图/生视频提示词优化师。用户会提供一段中文提示词, 可能附带一张参考图(产品图、原图或场景图)。你的任务:

1. 若有参考图: 先理解图片内容——产品类目、颜色、材质、造型、当前背景与构图。把提示词改写得与图片内容强相关:
   - 保留用户的创作意图;
   - 修正与图片事实冲突的描述(如图里是红色保温杯, 提示词写蓝色, 就改成红色);
   - 补充图片中可见但提示词遗漏的关键卖点细节(材质、结构、配件)。
2. 若无参考图: 把提示词补全为电商出图公式结构: 镜头/构图 + 主体描述 + 场景背景 + 布光 + 风格质感 + 商业规格(如 8K、白底规范)。
3. 文字精炼、具象、可直接用于生图; 保留原有的画幅、语言、风格等约束。
4. 只输出优化后的最终提示词正文(中文), 不要任何解释、前后缀、引号或列表。`;

/** MOCK 模式下的本地规则版优化(不请求上游), 保证流程可演示 */
function localOptimize(prompt, hasImage) {
  const trimmed = (prompt || '').trim();
  const structureHint = '镜头语言明确, 主体突出, 背景干净, 柔和布光, 色彩准确还原, 材质细节清晰锐利, 商业广告级质感, 8K超清';
  if (!trimmed) return structureHint;
  const enriched = hasImage
    ? `${trimmed}。严格忠于参考图中产品的造型、颜色、材质与文字, 光影方向与参考图一致, ${structureHint}`
    : `${trimmed}, ${structureHint}`;
  return enriched;
}

export async function optimizePrompt({ prompt, imageUrl }) {
  if (isMockMode()) {
    return {
      optimizedPrompt: localOptimize(prompt, Boolean(imageUrl)),
      visionUsed: Boolean(imageUrl),
      mock: true,
    };
  }

  const content = [{ type: 'text', text: prompt || '（用户未填写提示词, 请按参考图内容给出一段电商出图提示词）' }];
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } });
  }

  const res = await chatCompletions({
    model: config.models.text,
    messages: [
      { role: 'system', content: OPTIMIZER_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  });

  const optimized = (res?.choices?.[0]?.message?.content ?? '').trim();
  if (!optimized) {
    const err = new Error('优化结果为空'); err.status = 502; throw err;
  }
  return {
    optimizedPrompt: optimized,
    visionUsed: Boolean(imageUrl),
    cost: res?.usage ?? null,
    mock: false,
  };
}
