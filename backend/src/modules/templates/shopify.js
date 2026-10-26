/**
 * Shopify 套图模板 — 7 步出全套商品图
 *
 * 两条线路:
 * - Skill A (线路 a): 模型自生成模特, 用户提供灵感 prompt
 * - Skill B (线路 b): 从模特库选择模特三视图作为形象参考
 *
 * 提示词方法论来自:
 * - SkillA_无模特参考_首图建立模特.md
 * - SkillB_产品加模特三视图.md
 * - SkillC_效果图定向微调.md (微调)
 */

export const SHOPIFY_TEMPLATE_ID = 'shopify-lookbook';

/** 7 个交付步骤 */
export const SHOPIFY_STEPS = [
  {
    id: '01', name: '列表主图', desc: '单人正面模特图, 头部至大腿, 衣服完整, 正面印花无遮挡',
    needModel: true, refSteps: [],
  },
  {
    id: '02', name: '背面展示', desc: '同一模特背面图, 相同背景距离光线, 完整展示背面图案',
    needModel: true, refSteps: ['01'], needBack: true,
  },
  {
    id: '03', name: '完整穿搭', desc: '全身或四分之三侧身, 展示落肩、袖长、衣长与搭配效果',
    needModel: true, refSteps: ['01'],
  },
  {
    id: '04', name: '印花细节', desc: '核心图案近景, 看清图案边缘、颜色和印刷表面',
    needModel: false, refSteps: [],
  },
  {
    id: '05', name: '面料与做工', desc: '布料、领口、肩线特写, 表现厚度、纹理、走线',
    needModel: false, refSteps: [],
  },
  {
    id: '06', name: '另一位模特', desc: '换性别或不同身形穿搭, 帮助判断中性款上身效果',
    needModel: true, secondModel: true, refSteps: [],
  },
  {
    id: '07', name: '品牌生活方式', desc: '街头、咖啡馆、宠物等场景, 表达系列故事',
    needModel: true, refSteps: ['01', '06'],
  },
];

const NEGATIVE =
  '禁止更换产品、重绘印花、写错印花文字、混淆正背面、无故改变版型或颜色; ' +
  '禁止手掌、项链、头发和道具遮挡核心印花; ' +
  '禁止塑料皮肤、过度磨皮、肢体畸形、多余手指和重复人物; ' +
  '禁止除指定模特外的路人; 禁止新增水印、文案或标志。';

const FORMAT = '竖版4:5, 1600×2000px, 高细节、高端潮牌电商视觉, 8K级细节。';

/**
 * 组装某一步骤的最终提示词
 * @param {'a'|'b'} mode  线路 a = Skill A (自动建模) / 线路 b = Skill B (模特库)
 * @param {string} stepId 01–07
 * @param {object} opts   { productDesc, inspiration, modelDesc, modelRefName, secondModelDesc, scene, productBackAvailable }
 */
export function composeShopifyPrompt(mode, stepId, opts = {}) {
  const {
    productDesc = 'T恤',
    inspiration = '',
    modelDesc = '',
    secondModelDesc = '',
    scene = '纽约时代广场傍晚街头, 轻微虚焦, 无其他人物',
    productBackAvailable = true,
  } = opts;

  const modelLine = mode === 'a'
    ? `模特描述: ${inspiration || modelDesc || '20岁左右欧美白皮年轻男性, 身材苗条高挑, 潮牌街头气质'}。`
    : `模特身份由模特三视图参考图决定, 严格保留参考模特的脸型、五官、发型、肤色、年龄感和身形, 不得自行更改。`;

  const steps = {
    '01': `${modelLine}模特穿着【产品正面图】中的${productDesc}, 竖版半身偏长构图(头部至大腿附近), 领口、袖口、两侧轮廓和完整下摆均在画面内, 衣服完整, 正面核心印花无遮挡、不变形、清晰可辨。模特自然站立, 双臂与躯干保持适度间隙, 手部头发配饰不得遮挡印花。背景为${scene}, 柔和自然光均匀照亮皮肤与服装, 背面添加克制轮廓弧光。眼部平视机位, 85mm人像质感, 真实面料褶皱。`,

    '02': `以【产品背面图】为背面服装唯一参考${mode === 'a' ? ', 引用上一张效果图保持同一模特、同一场景、同一镜头机位和相同光线' : ', 引用模特三视图和上一张效果图保持同一模特身份与拍摄参数'}。模特自然背对镜头站立, 发型、肩颈比例、身形与上一张一致, 双臂自然下垂略离开躯干, 不遮挡背面图案。完整展示${productDesc}背面轮廓、下摆和背面印花, 背印位置、大小、文字、颜色严格服从产品背面图。`,

    '03': `${modelLine}引用上一张效果图保持同一模特、场景和光色。模特以自然的全身或四分之三侧身姿势展示完整穿搭, 重点清晰呈现${productDesc}的落肩程度、实际袖长、衣长、围度、侧面轮廓及搭配效果, 下摆不得被裤腰、手部或配饰遮住。默认四分之三正侧身, 正面印花仍可读。`,

    '04': `以【产品主体】为唯一产品参考, 制作${productDesc}核心图案近景特写。产品自然放置在专业拍摄台上, 俯视至45度之间近景机位, 画面重点覆盖最能代表设计的核心印花区域, 保留少量周围面料。印花边缘、细线、准确文字、颜色层次、印刷表面及其与面料的贴合状态必须清楚可见。infinity sweep背景, 柔和棚拍光结合轻微侧向光, 衣片自然褶皱。高端目录品质。`,

    '05': `以【产品主体】为唯一参考, 输出同一竖版画布内的三区域工艺微距组合图, 三个区域来自同一件产品。第一区域: 领口结构、罗纹或领条、领口走线。第二区域: 肩线、袖窿或肩部接缝、加固走线。第三区域: 衣身面料编织纹理、厚度视觉、印花与面料交界处的真实表面。侧向掠射棚拍光表现织纹、缝线起伏和印花表面, 浅景深但对焦区域清晰, 走线紧密均匀。高端工艺特写。`,

    '06': `建立第二位模特${secondModelDesc ? `(${secondModelDesc})` : '默认采用与第一位不同性别或明显不同身形的年轻成年模特'}。模特穿着与【产品主体】完全一致的${productDesc}, 四分之三侧身动态姿势, 身体约偏离镜头45度、头部自然回转, 呈现街头行走中的放松感。即使身体侧转, 正面印花仍清楚可读, 产品颜色、版型和图案不变。柔和暮光照亮模特, 肩部带轻微轮廓光, 背景虚化, 85mm广告摄影质感。`,

    '07': `两位模特穿着完全相同的【产品主体】, 腰部以上的双人生活方式广告图。左侧模特略靠后, 脸转向左侧、表情冷静, 右手自然整理头发; 右侧模特略靠前, 面向镜头、神情自信, 双手在领口附近做自然造型动作, 不遮挡核心胸前印花。两件${productDesc}的颜色、版型和印花一致, 印花尽可能大、清晰且无透视错误。背景为洛杉矶街头, 棕榈树、低层店面和暖色日落到傍晚的环境光, 中度虚化, 无其他路人。柔和金色时光均匀照亮两位模特, 轻微轮廓光, 强调中性穿搭和系列故事。85mm editorial photography。`,
  };

  const base = steps[stepId] || '';
  return `${base} ${FORMAT} 负面约束: ${NEGATIVE}`;
}

/** Skill C 微调提示词 (针对某一步骤的定向修复) */
export function composeShopifyRetouchPrompt(stepId, userIssue = '') {
  const issues = userIssue?.trim() || '画面不够清晰, 需要提升细节';
  return `以上一版效果图为基础, 重新绑定产品图${stepId === '02' ? '和产品背面图' : ''}${['01', '02', '03', '06', '07'].includes(stepId) ? '及模特锚点' : ''}, 仅修复以下问题, 保留已经正确的产品、模特、姿势、场景和光线: ${issues}。不得为解决问题引入新的图案、人物、配饰、文字或场景。产品印花、文字、颜色和版型服从产品图。${FORMAT} 负面约束: ${NEGATIVE}`;
}

export const shopifyTemplateMeta = {
  id: SHOPIFY_TEMPLATE_ID,
  type: 'image',
  category: 'series',
  title: 'Shopify 套图',
  subtitle: '7 步出全套 Shopify 商品图 · 含模特上身、细节与生活方式',
  timeLabel: '约 5 分钟',
  credits: 2,
  needLabel: '1-2 张产品图 (正面/背面)',
  needImages: 1,
  defaults: { model: 'primary', aspect_ratio: '4:5', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
  promptTemplate: '{{shopifyPrompt}}',
  slots: [],
  isLookbook: true,
  steps: SHOPIFY_STEPS,
  tips: '上传产品正/背面图, 选择线路 a (AI 自动建模) 或线路 b (模特库选模特), 依次生成 01–07 全套图。',
};
