/**
 * 模板库（任务视角, 非模型能力视角 — PRD 模块 1）
 *
 * 提示词方法论参考:
 * - 生图: 电商出图公式 = 镜头/构图 + 产品主体 + 场景背景 + 布光 + 风格质感 + 商业规格
 *   (zhihu p/2061109893466216203 · github Ss-miao/ai-ecommerce-image-prompts)
 * - 视频: 运镜 + 主体动作 + 场景 + 光线氛围 + 音频/旁白 + 商业规格
 *   (tahou.com 217468593963350021 · clipcat.ai ecommerce-video-prompts · iosur.com ai-video-prompts)
 *
 * 【模板写作规范 v2】每个模板的 promptTemplate 统一六段式, 顺序固定:
 *   1) 参考图说明 —— 讲清「第1张图是什么、唯一来源是什么」, 有参考图的模板必写
 *   2) 主体与构图 —— 主体是什么 + 机位/构图/留白
 *   3) 场景与背景 —— 背景内容与材质
 *   4) 光线 —— 光位/软硬/氛围 (可用 {{lighting}} 槽位)
 *   5) 风格与规格 —— 质感 + 清晰度 + 画面比例等商业规格
 *   6) 负面约束 —— 禁止改产品/禁止加字水印/禁止畸形等
 *   (视频模板对应替换为: 主体与动作 / 场景 / 镜头 / 光线 / 声音 / 规格 / 负面约束)
 *
 * 槽位规范:
 * - 选项槽位 (options): value 仅作 UI 标识; **prompt 才是给模型看的描述**, 组装时用 prompt
 * - 文本槽位 (text): 用户输入优先; 未填时用 defaultValue, 再兜底 fallbackPrompt
 * - 槽位必须在 promptTemplate 中被引用, 否则视为死槽位 (lint 会报错)
 *
 * promptTemplate 使用 {{槽位}} 占位; 每个槽位对应一个「可视化点选」微调项 (PRD 模块 2),
 * 用户全程不写 Prompt —— 槽位全部有默认值, 直接生成也能出图。
 */

import { shopifyTemplateMeta, SHOPIFY_STEPS } from './shopify.js';

export const categories = [
  { id: 'all', label: '全部', hint: '按「我要做的事」找模板' },
  { id: 'main-image', label: '产品主图', hint: '上架首图、白底图、场景图' },
  { id: 'series', label: '系列套图', hint: '详情页、多角度、多色变体' },
  { id: 'tryon', label: '模特上身', hint: '服饰虚拟试穿, 模特可换' },
  { id: 'retouch', label: '生图改图', hint: '换背景、去底、翻新、改文案' },
  { id: 'video', label: '视频创作', hint: '种草卖家秀、上身视频、TVC' },
];

const LIGHTING = {
  label: '光线',
  key: 'lighting',
  options: [
    { value: 'soft', label: '柔光棚拍', color: '#FFF3DC', prompt: '柔和影棚顶光加左前补光, 产品底部带淡淡倒影' },
    { value: 'natural', label: '自然光', color: '#FFE9D6', prompt: '午后窗边自然光, 明亮通透' },
    { value: 'dusk', label: '黄昏逆光', color: '#FFD9B8', prompt: '黄昏侧逆光, 边缘轮廓光温暖有层次' },
    { value: 'hard', label: '硬光质感', color: '#E8E8E8', prompt: '硬质定向光, 明暗对比强, 质感锐利' },
  ],
};

/** 通用参考图角色: 图1 = 产品外观唯一来源 (仅产品类模板) */
const REF_PRODUCT =
  '参考图说明: 第1张是产品图, 是画面中产品外观的唯一来源, 其造型、配色、材质、印花与文字必须严格复刻, 不得重绘、改色或虚构细节。';

export const templates = [
  // ============ Shopify 套图 (多步骤) ============
  shopifyTemplateMeta,

  // ============ 产品主图 ============
  {
    id: 'main-white',
    type: 'image',
    category: 'main-image',
    title: '白底主图',
    subtitle: '平台上架规范白底图, 产品居中',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '1 张产品图',
    needImages: 1,
    lockAspect: true,   // 平台白底图规范固定 1:1, 不受用户全局比例偏好影响
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      REF_PRODUCT + '\n'
      + '主体与构图: 输出{{product}}的纯白底电商主图, 产品居中并正面朝向镜头, 占画面约八成面积, 四周留均匀白边, 产品完整不裁切; 若参考图为正背拼版, 取正面角度输出主图。\n'
      + '场景与背景: 纯白无缝背景 (纯白 255/255/255), 无渐变、无装饰、无多余道具。\n'
      + '光线: {{lighting}}, 光线柔和均匀不产生硬阴影, 产品边缘与白底自然过渡无灰边无黑边。\n'
      + '风格与规格: 电商平台上架级产品摄影, 真实材质与纹理, 细节锐利, 8K超清。\n'
      + '负面约束: 禁止改动产品形态与颜色, 禁止凭空添加配件与文字, 禁止水印、Logo、边框与背景装饰, 禁止畸形与塑料感。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一双米白色帆布鞋', defaultValue: '该商品', fallbackPrompt: '该商品' },
      LIGHTING,
    ],
    tips: '白底图是搜索流量的第一印象, 产品务必占满画面中心。',
  },
  {
    id: 'main-scene',
    type: 'image',
    category: 'main-image',
    title: '场景主图',
    subtitle: '把产品放进生活场景, 提升点击率',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      REF_PRODUCT + '\n'
      + '主体与构图: {{product}}自然摆放在{{scene}}, 三分法构图, 产品位于视觉中心且完整不出画, 浅景深虚化背景突出主体, 产品与背景之间有自然的前后景层次。\n'
      + '光线: {{lighting}}, 阴影方向与场景光源一致, 高光不遮挡产品关键细节。\n'
      + '风格与规格: 明亮干净的高品质生活方式电商摄影, 真实材质与自然光影, 色彩通透, 8K超清。\n'
      + '负面约束: 禁止改动产品造型与颜色, 禁止虚构产品结构或配件, 禁止多余商品与人物, 禁止水印、文字与Logo, 禁止畸形与塑料感。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一瓶气泡水', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '场景',
        key: 'scene',
        options: [
          { value: 'home', label: '居家桌面', color: '#EAF3EA', prompt: '原木风居家桌面, 搭配亚麻桌布与绿植' },
          { value: 'outdoor', label: '户外野餐', color: '#EAF3F8', prompt: '草坪野餐布上, 阳光斑驳' },
          { value: 'coffee', label: '咖啡店', color: '#F5EFE6', prompt: '咖啡店大理石台面, 暖色灯光' },
          { value: 'studio', label: '极简几何', color: '#F0F0F5', prompt: '极简几何布景平台, 色块背景' },
        ],
      },
      LIGHTING,
    ],
    tips: '场景与产品使用人群对齐: 家居品选居家, 户外品选自然场景。',
  },
  {
    id: 'main-flatlay',
    type: 'image',
    category: 'main-image',
    title: 'T恤平铺摆拍图',
    subtitle: '摄影台 + 三面反光板棚拍质感, Lifestyle 道具点缀',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '1 张产品图（左正面 / 右背面拼版最佳）',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '4:5', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    // 批量能力: 一次上传多张产品图, 每张单独生成一条请求 (批量走 /generate/image-batch)
    batch: { enabled: true, max: 10 },
    // 内置提示词 (用户定稿): 中文参考图说明 + 英文摄影场景公式, 固定不发槽位
    promptTemplate:
      '图1为主要的T恤产品（左边是正面图，右边是背面图）。\n'
      + 'Overhead-to-45-degree styled product shot on a professional shooting table with infinity sweep background, '
      + 'surrounded by three bounce walls for gentle diffused lighting, one side open for the lens and the main light, '
      + 'casual organic drape of the product with lifestyle props arranged nearby, soft studio light, '
      + 'high-end catalog quality, single composition, 8K.\n'
      + '参考图说明: 图1是服装外观的唯一来源, 版型、印花图案、字体字样、颜色与面料质感必须严格复刻, 不得重绘、改色或虚构图案细节。\n'
      + '负面约束: 禁止改变服装版型与印花, 禁止生成文字水印与Logo, 禁止出现人物, 禁止道具遮挡服装主体, 禁止畸形与塑料质感。',
    slots: [],
    tips: '上传左正面 / 右背面拼版的产品图, 印花与文字会按原图精确复刻; 道具与光线由场景公式自动安排。',
  },
  {
    id: 'main-festival',
    type: 'image',
    category: 'main-image',
    title: '节日营销主图',
    subtitle: '大促氛围 KV, 双11/年货节直接用',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { model: 'secondary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      REF_PRODUCT + '\n'
      + '主体与构图: {{product}}为绝对视觉中心, 位于画面中部并完整清晰, {{festival}}节日氛围布景环绕主体, 礼盒彩带丝带作为点缀不得遮挡产品。\n'
      + '留白: 画面上方保留干净的标题文案区, 该区域不生成任何文字只留空位。\n'
      + '光线: {{lighting}}, 节日彩光与主体光比合理, 产品细节不被彩光污染。\n'
      + '风格与规格: 高级商业促销海报质感, 色彩饱和但主体不过曝, 8K超清。\n'
      + '负面约束: 禁止改动产品造型与颜色, 禁止生成促销文字、价格与标签, 禁止水印与Logo, 禁止多余商品堆叠遮挡主体, 禁止畸形。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一盒坚果礼盒', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '节日',
        key: 'festival',
        options: [
          { value: 'double11', label: '双11', color: '#FF4D4F', prompt: '红金配色双11大促, 几何光效与优惠券元素' },
          { value: 'newyear', label: '新年', color: '#E02020', prompt: '中国新年, 红灯笼生肖元素, 金色点缀' },
          { value: 'christmas', label: '圣诞', color: '#2E7D32', prompt: '圣诞, 松枝红果与暖灯串' },
          { value: 'midyear', label: '618', color: '#FF7A00', prompt: '618年中大促, 橙色渐变与光带' },
        ],
      },
      LIGHTING,
    ],
    tips: '氛围元素点到为止, 产品永远是最显眼的主体。',
  },

  // ============ 系列套图 ============
  {
    id: 'series-detail',
    type: 'image',
    category: 'series',
    title: '详情页长图',
    subtitle: '9:21 竖版详情页首屏图',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '1 张产品图',
    needImages: 1,
    lockAspect: true,   // 详情页长图固定 9:21 竖版, 不受用户全局比例偏好影响
    defaults: { model: 'primary', aspect_ratio: '9:21', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      REF_PRODUCT + '\n'
      + '主体与构图: {{product}}居中偏上构图, 占据画面上半部并完整清晰, 背景为{{scene}}, 主体与背景之间有明确层次。\n'
      + '留白: 画面下方三分之一保持干净平整, 便于后期叠加卖点文案, 该区域不生成任何文字。\n'
      + '光线: {{lighting}}, 主体与背景光比柔和, 材质细节通透不发灰。\n'
      + '风格与规格: 高级电商详情页设计感, 信息层级清晰, 真实材质与自然光影, 8K超清。\n'
      + '负面约束: 禁止改动产品造型与颜色, 禁止生成文字、水印与Logo, 禁止多余道具与人物, 禁止畸形与塑料感。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一款保温杯', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '场景',
        key: 'scene',
        options: [
          { value: 'gradient', label: '品牌渐变', color: '#E6F7FF', prompt: '品牌色渐变背景, 干净大气' },
          { value: 'lifestyle', label: '生活方式', color: '#EAF3EA', prompt: '生活方式场景, 有代入感' },
          { value: 'structure', label: '卖点图解', color: '#F0F0F5', prompt: '几何卖点图解风, 突出参数' },
        ],
      },
      LIGHTING,
    ],
    tips: '详情页首屏的任务: 3 秒内让人明白「这是什么、对我有什么用」。',
  },
  {
    id: 'series-multi-angle',
    type: 'image',
    category: 'series',
    title: '多角度套装',
    subtitle: '一次生成正面/侧面/背面/细节',
    timeLabel: '约 2 分钟',
    credits: 4,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 4, mode: 'image-edit' },
    promptTemplate:
      REF_PRODUCT + '\n'
      + '主体与构图: {{product}}的完整多视图展示, 四格分别呈现正面、侧面、背面、底部细节, 四格排布整齐一致, 每格只展示一个角度, 产品完整不裁切。\n'
      + '场景与背景: 四格统一纯白无缝背景, 统一布光({{lighting}}), 四格明暗一致不出现色偏。\n'
      + '风格与规格: 产品摄影图鉴风格, 四个角度之间像素级一致的色彩还原, 细节清晰, 8K超清。\n'
      + '负面约束: 四个视角必须是同一件产品, 禁止改变配色、比例与结构, 禁止生成文字与水印, 禁止多余道具与人物, 禁止畸形。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一台迷你投影仪', defaultValue: '该商品', fallbackPrompt: '该商品' },
      LIGHTING,
    ],
    tips: '多角度套装一次出 4 张, 正好凑齐主图位。',
  },
  {
    id: 'series-colors',
    type: 'image',
    category: 'series',
    title: '多色变体系列',
    subtitle: '一个产品展示全部配色',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '16:9', resolution: '2K', quality: 'high', count: 1, mode: 'multi-reference' },
    promptTemplate:
      '参考图说明: 第1张是产品图, 是产品造型与结构的唯一来源, 各配色变体必须保持同一版型。\n'
      + '主体与构图: {{product}}并排展示全部配色({{palette}}), 等距一字排开, 每个变体的造型、比例、细节完全一致, 仅颜色不同, 纯白背景。\n'
      + '光线: {{lighting}}, 各变体受光方向一致, 颜色还原准确不偏色。\n'
      + '风格与规格: 产品目录图鉴风格, 排版规整, 8K超清。\n'
      + '负面约束: 禁止改变产品结构与版型, 禁止各变体造型不一致, 禁止生成文字与水印, 禁止多余道具, 禁止畸形。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一件连帽卫衣', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '配色',
        key: 'palette',
        options: [
          { value: 'earth', label: '大地色系', color: '#D9C6A5', prompt: '燕麦色、咖色、焦糖色、米白色' },
          { value: 'candy', label: '糖果色系', color: '#FFD6E7', prompt: '奶黄、薄荷绿、樱花粉、天蓝' },
          { value: 'mono', label: '经典黑白灰', color: '#E8E8E8', prompt: '黑、白、浅灰、深灰' },
          { value: 'jewel', label: '宝石色系', color: '#B8D8D8', prompt: '墨绿、酒红、藏蓝、烟紫' },
        ],
      },
      LIGHTING,
    ],
    tips: '配色系列图能显著提升客单价: 一次看全所有颜色。',
  },

  // ============ 模特上身 ============
  {
    id: 'tryon-female-asia',
    type: 'image',
    category: 'tryon',
    title: '模特上身图',
    subtitle: 'Lookbook 街拍上身展示 · 服装+模特双参考 · 男/女模特可换',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '服装图 + 模特参考图（2 张）',
    needImages: 2,
    defaults: { model: 'primary', aspect_ratio: '3:4', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    // 内置提示词 (用户提供框架 + model-sheet skill 产品复用分支强化): 图1=服装唯一来源, 图2=仅模特体型参考
    promptTemplate:
      '图1是唯一的服装来源：模特必须完整穿着图1中的这件服饰，其款式、版型、颜色、面料、图案细节均严格还原图1，不得有任何改动（reproduce the exact print from the product reference image: all graphic artwork elements, brand logo lettering elements, typography, color palette and print texture must match the reference photo exactly, do not redesign, do not invent new elements）。图2仅作为模特形象参考：只参考图2中模特的身材体型，必须完全忽略（不复制、不保留）图2模特身上所穿的任何服装。成图中模特全身只穿图1的这一套服饰，严禁混入图2中的任何服饰元素。\n'
      + 'ACCESSORIES RULE (strict): do not invent or add any accessory — hat, necklace, earrings, rings, chains, glasses, bags. Include accessories ONLY if they are visible on the person in the model reference image; if the reference shows no accessories, the model appears with clean bare styling, nothing added. Never improvise.\n'
      + '时尚电商Lookbook摄影。模特是{{gender}}。模特穿着与参考图1完全一致的上衣，整套造型（上衣+下装）为同一套系搭配：下装为与上衣自然色系搭配（黑配白，白配黑）、同质感面料、同风格版型的配套裤装/裙装，色彩过渡自然、色相统一、明度协调，整体搭配和谐完整，严禁出现与上衣风格或颜色冲突的下装。\n'
      + '模特身体呈约45度侧对镜头，重心落在后侧支撑腿上，前腿膝盖微曲，双肩下沉并向后展开，侧面肩线与背部线条干净利落。一手自然垂于身侧、五指放松微张，另一手轻搭在腰侧或服饰口袋处，指尖引导视线落在服装设计细节上。头部向镜头回转，下巴微收，眼神直视镜头，神情从容自然不刻意，传递"不经意被捕捉"的松弛高级感。\n'
      + '背景为美国极具现代化时尚风的fashion城市街头；柔和影棚顶光加左前补光，产品底部带淡淡倒影；清晰呈现服装版型、面料质感与垂坠感，真实皮肤质感与自然光影；8K超清，时尚电商Lookbook摄影风格。\n'
      + '负面约束：禁止改动服装版型、印花与文字，禁止生成水印、Logo与字幕，禁止多余人物与路人，禁止肢体畸形、多余手指与穿模，禁止过度磨皮的塑料皮肤，禁止虚构配饰。',
    slots: [
      {
        label: '模特性别',
        key: 'gender',
        options: [
          { value: 'female', label: '女模特', color: '#FFD6E7', prompt: '年轻女性模特, 20-25岁, 东方面孔, 身材匀称修长, 气质自然' },
          { value: 'male', label: '男模特', color: '#EAF3F8', prompt: '年轻男性模特, 20-25岁, 东方面孔, 身材高挑精干, 肩线利落' },
        ],
      },
    ],
    tips: '第 1 张传服装平铺/挂拍图（服装唯一来源），第 2 张传模特形象参考图（只取身材体型）。配饰只在参考图可见时保留, 不会自创。',
  },
  {
    id: 'tryon-sheet',
    type: 'image',
    category: 'tryon',
    title: '模特三视图',
    subtitle: '16:9 模特库 / 参考照重建 / 服装上身 · 三方案切换',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '1 张参考图（人物或服装）',
    needImages: 1,
    lockAspect: true,   // 三视图版式固定 16:9 横版
    defaults: { model: 'primary', aspect_ratio: '16:9', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    // 内置提示词 (源自 model-sheet-prompt-generator skill): 版式块按方案路由, Subject 按性别路由
    promptTemplate:
      '参考图说明: 若上传了参考图, 它只作为人物形象或服装外观的参考依据, 具体以「生成方案」为准; 未上传时使用标准棚拍人物设定。\n'
      + '生成方案:\n{{variant}}\n'
      + '模特设定:\n{{gender}}\n'
      + 'CONSISTENCY: identical face, hairstyle, skin tone, body build and outfit across all three views; identical lighting, color grading and light-grey seamless studio background behind all panels.\n'
      + 'STYLE: photorealistic editorial fashion photography, soft even studio lighting, 85mm lens, natural skin texture, sharp fabric detail, 8K. No text, no logo, no graphic overlay.\n'
      + 'NEGATIVE: different person, changed face, beautified face, changed hairstyle, outfit mismatch between views, unintended print or text on the shirt, altered print, warped lettering, extra fingers, extra hands, extra limbs, deformed hands, twisted neck, asymmetric duplicated body, plastic skin, overly retouched porcelain skin, anime or illustration style, busy background, props, watermark, logo, text, panel border errors, cropped feet in the full-body view.',
    slots: [
      {
        label: '生成方案',
        key: 'variant',
        options: [
          {
            value: 'sheet', label: 'A · 模特库三视图', color: '#EFF4FF',
            prompt: 'Character reference sheet, 16:9 landscape canvas with three views of the same person: LEFT HALF full-body standing shot; RIGHT UPPER QUADRANT half-body portrait facing camera; RIGHT LOWER QUADRANT half-body turn-around shot from behind. Outfit: plain pure-white crew-neck cotton T-shirt, relaxed fit, no print, no logo; washed-black cargo trousers; clean chunky sneakers. Accessories: none — deliberately bare, no jewelry. Expression: natural, relaxed, unposed, no forced smile. The uploaded reference image (if provided) is only an appearance hint; keep the standard studio character-sheet styling.',
          },
          {
            value: 'rebuild', label: 'B · 参考照重建', color: '#F5F3FF',
            prompt: 'Use the person in the uploaded reference photo as the ONLY subject. Keep this exact person\'s facial identity 100% unchanged: same face shape, same eye color and shape, same nose, same lips, same hairstyle, hair color and hair length, same skin tone, same body proportions and height. Do not beautify, do not change the face, do not generate a different person. Rebuild this person into a character reference sheet on a 16:9 landscape canvas with exactly three views of the SAME person in ONE image: LEFT HALF (50% of the width) — full-body head-to-toe standing shot, feet fully inside the frame; RIGHT UPPER QUADRANT (25%) — half-body waist-up portrait facing the camera, natural relaxed expression, no forced smile; RIGHT LOWER QUADRANT (25%) — half-body turn-around shot from behind, head turned slightly. WARDROBE: plain pure-white crew-neck cotton T-shirt, relaxed fit, no print, no logo; washed-black or grey cargo trousers; clean chunky sneakers. Keep accessories only as visible in the reference, add nothing.',
          },
          {
            value: 'outfit', label: 'C · 服装上身三视图', color: '#FFF7ED',
            prompt: 'Character reference sheet, 16:9 landscape canvas with three views of the same person: LEFT HALF full-body standing shot; RIGHT UPPER QUADRANT half-body portrait facing camera; RIGHT LOWER QUADRANT half-body turn-around shot from behind. WARDROBE: wearing the exact outfit from the uploaded product reference image, unchanged — reproduce every print, color, logo lettering element and graphic detail pixel-accurately, do not redesign, recolor or restyle the garment. Pair it with plain bottoms that match the outfit\'s natural color palette. Accessories: none — do not invent or add any accessory, nothing added. Expression: natural, relaxed, unposed, no forced smile.',
          },
        ],
      },
      {
        label: '模特性别',
        key: 'gender',
        options: [
          { value: 'female', label: '女模特', color: '#FFD6E7', prompt: 'Subject: female model, 20-25 years old, East Asian features, slender well-proportioned frame with model proportions, shoulder-length black hair, natural brown eyes, fair skin, soft oval face.' },
          { value: 'male', label: '男模特', color: '#EAF3F8', prompt: 'Subject: male model, 20-25 years old, East Asian features, tall lean athletic frame with model proportions, short textured black hair, natural brown eyes, fair skin, defined jawline.' },
        ],
      },
    ],
    tips: '方案 A 生成模特库三视图（纯白 T 标准版式）；B 按参考照 1:1 重建同一人；C 穿上参考图服装出三视图（印花像素级复刻）。16:9 横版固定。',
  },
  {
    id: 'tryon-detail',
    type: 'image',
    category: 'tryon',
    title: '上身细节特写',
    subtitle: '面料/领口/袖口细节放大图',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '1 张上身图或产品图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      '参考图说明: 第1张是上身图或产品图, 是服装面料、版型与工艺细节的唯一来源。\n'
      + '主体与构图: 模特身穿{{product}}的局部特写, 聚焦{{part}}, 微距镜头, 画面只保留被摄部位与少量周边面料, 焦点落在细节上。\n'
      + '光线: {{lighting}}, 侧向掠射光表现织纹起伏、走线与印刷表面。\n'
      + '风格与规格: 高级质感商业静物摄影, 布料纹理与工艺清晰可辨, 真实色彩, 8K超清。\n'
      + '负面约束: 禁止改变服装款式与颜色, 禁止生成文字与水印, 禁止出现人物面部, 禁止畸形与塑料感。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一件针织开衫', defaultValue: '该件服装', fallbackPrompt: '该件服装' },
      {
        label: '特写部位',
        key: 'part',
        options: [
          { value: 'collar', label: '领口', color: '#F5EFE6', prompt: '领口与纽扣' },
          { value: 'fabric', label: '面料纹理', color: '#EAF3EA', prompt: '面料编织纹理' },
          { value: 'cuff', label: '袖口', color: '#EAF3F8', prompt: '袖口与走线' },
          { value: 'logo', label: '品牌标识', color: '#FFF3DC', prompt: '胸前品牌标识刺绣' },
        ],
      },
      LIGHTING,
    ],
    tips: '细节图是打消「质量疑虑」的关键一图。',
  },

  // ============ 生图改图 ============
  {
    id: 'retouch-bg',
    type: 'image',
    category: 'retouch',
    title: '产品换背景',
    subtitle: '保留产品, 背景换成想要的场景',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '1 张产品原图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      '参考图说明: 第1张是产品原图, 产品的造型、颜色、材质与文字必须完全保留, 本次只替换背景。\n'
      + '主体与构图: 产品完整保留在画面中央, 尺寸、比例与透视不变, 主体边缘干净无白边无锯齿。\n'
      + '场景与背景: {{scene}}。\n'
      + '光线: {{lighting}}, 阴影方向与新场景光源方向一致, 接触阴影自然不漂浮。\n'
      + '风格与规格: 真实自然的合成照片, 边缘光与色温与场景融合, 8K超清。\n'
      + '负面约束: 禁止改动产品本身, 禁止残留原背景元素, 禁止生成文字与水印, 禁止畸形。',
    slots: [
      {
        label: '新背景',
        key: 'scene',
        options: [
          { value: 'white', label: '纯白', color: '#FFFFFF', prompt: '纯白无缝背景' },
          { value: 'marble', label: '大理石', color: '#F0EDE8', prompt: '高级灰大理石台面' },
          { value: 'nature', label: '自然', color: '#EAF3EA', prompt: '清新自然绿植背景' },
          { value: 'gradient', label: '品牌渐变', color: '#E6F7FF', prompt: '柔和品牌色渐变背景' },
        ],
      },
      LIGHTING,
    ],
    tips: '换背景后布光要跟着场景走, 阴影方向一致才不假。',
  },
  {
    id: 'retouch-remove-bg',
    type: 'image',
    category: 'retouch',
    title: '一键去背景',
    subtitle: '透明底 PNG, 抠图直接用',
    timeLabel: '约 1 分钟',
    credits: 1,
    needLabel: '1 张产品原图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit', background: 'transparent', output_format: 'png' },
    promptTemplate:
      '参考图说明: 第1张是产品原图, 需要完整保留产品的造型与全部细节。\n'
      + '主体与构图: 抠出完整产品主体, 移除全部背景, 输出透明底, 产品边缘干净锐利无锯齿无白边, 保留产品原有的光影层次与自然接触阴影。\n'
      + '风格与规格: 专业电商抠图, 透明通道纯净无杂色, 边缘半透明像素自然, 8K超清。\n'
      + '负面约束: 禁止裁切或补全产品轮廓, 禁止添加阴影、背景与装饰物, 禁止生成文字与水印。',
    slots: [],
    tips: '去底图是做所有后期合成的基础素材。',
  },
  {
    id: 'retouch-enhance',
    type: 'image',
    category: 'retouch',
    title: '老图翻新',
    subtitle: '画质增强 + 去噪 + 色彩校正',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '1 张需要翻新的图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '4K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      '参考图说明: 第1张是待翻新原图, 构图、产品造型与画面文字信息必须完全保留, 本次只提升画质。\n'
      + '画质处理: 提升清晰度与分辨率, 去除噪点、压缩痕迹与色块, 校正白平衡与色彩({{tone}}), 细节锐利通透。\n'
      + '风格与规格: 商业级画质, 保持原图景深、光影关系与色调倾向, 不做风格化重绘。\n'
      + '负面约束: 禁止改变构图与产品形态, 禁止重绘或改写画面文字, 禁止添加元素与水印, 禁止过度锐化产生白边。',
    slots: [
      {
        label: '色调',
        key: 'tone',
        options: [
          { value: 'keep', label: '忠于原图', color: '#E8E8E8', prompt: '色彩忠实于原图' },
          { value: 'bright', label: '明亮通透', color: '#FFF9E6', prompt: '整体明亮通透, 提亮暗部' },
          { value: 'warm', label: '暖调', color: '#FFE9D6', prompt: '偏暖调, 温馨氛围' },
          { value: 'cool', label: '冷调高级', color: '#E6F7FF', prompt: '偏冷调, 高级清冷感' },
        ],
      },
    ],
    tips: '翻新不会改变产品本身, 只提升画质。',
  },
  {
    id: 'retouch-text',
    type: 'image',
    category: 'retouch',
    title: '包装改字',
    subtitle: '替换包装上的文字/型号, 其他不动',
    timeLabel: '约 2 分钟',
    credits: 2,
    needLabel: '1 张包装图',
    needImages: 1,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    promptTemplate:
      '参考图说明: 第1张是包装原图, 是包装设计、材质、光影与透视的唯一来源。\n'
      + '主体与构图: 保持包装的设计、材质、光影与透视完全不变, 仅将包装上的主文字替换为「{{text}}」。\n'
      + '文字处理: 新文字沿用原有字体风格、字重、弧度与透视变形, 印刷质感真实, 边缘自然无涂抹无重影。\n'
      + '风格与规格: 商业包装摄影级还原, 材质细节真实, 8K超清。\n'
      + '负面约束: 禁止改动包装形状与颜色, 禁止出现多余或重复文字, 禁止水印与Logo, 禁止畸形。',
    slots: [
      { key: 'text', label: '改成什么字', type: 'text', placeholder: '例: 996 STUDIO', defaultValue: 'NEW TEXT', fallbackPrompt: 'NEW TEXT' },
    ],
    tips: '适合换 Logo、换型号、做外语版本包装。',
  },
  {
    id: 'retouch-fusion',
    type: 'image',
    category: 'retouch',
    title: '多图融合',
    subtitle: '产品 + 场景两张图合成一张',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '2 张图(产品+场景)',
    needImages: 2,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'multi-reference' },
    promptTemplate:
      '参考图说明: 第1张是产品图(产品外观唯一来源), 第2张是场景图(环境、透视与光线的唯一来源)。\n'
      + '主体与构图: 将第1张图中的产品自然融入第2张图的场景中, 产品造型、颜色与材质严格忠于原图, 透视与比例协调, 与接触面之间有自然阴影。\n'
      + '光线: {{lighting}}, 光影方向与场景光源一致, 色温与场景匹配。\n'
      + '风格与规格: 真实自然的合成照片, 边缘、景深与噪点与场景融合无破绽, 8K超清。\n'
      + '负面约束: 禁止改变产品造型与颜色, 禁止残留原图背景, 禁止生成文字与水印, 禁止畸形。',
    slots: [LIGHTING],
    tips: '上传顺序: 第 1 张产品图, 第 2 张场景图。',
  },

  // ============ 视频 ============
  {
    id: 'video-seeding',
    type: 'video',
    category: 'video',
    title: '种草卖家秀',
    subtitle: '达人出镜口播带货, 自选语言',
    timeLabel: '约 5 分钟',
    credits: 20,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { aspect_ratio: '9:16', resolution: '720p', duration: 10, mode: 'first-frame', language: '中文' },
    promptTemplate:
      '参考图说明: 第1张是产品图, 画面中手持产品的外观必须与参考图严格一致, 不得改款或虚构卖点。\n'
      + '主体与动作: 年轻主播手持{{product}}面对镜头, 用{{language}}口语化介绍产品卖点, 手势自然, 眼神与镜头有交流, 状态放松真实。\n'
      + '场景: {{scene}}, 背景整洁有生活感, 浅景深突出人物与产品。\n'
      + '镜头: 竖屏手持vlog轻微晃动, 中段切一个产品细节特写, 结尾产品定格展示。\n'
      + '光线: 明亮柔和, 面部通透, 产品细节清晰。\n'
      + '声音: 清晰人声收音, 语速轻快自然, 背景音乐轻, 无刺耳噪音。\n'
      + '规格: 竖屏9:16, 10秒, 真人实拍质感, 画面干净有网感。\n'
      + '负面约束: 禁止出现字幕与水印, 禁止口型与声音不一致, 禁止人物畸形与多余手指, 禁止产品变形, 禁止虚构卖点文案与价格。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一款便携榨汁杯', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '语言',
        key: 'language',
        options: [
          { value: 'zh', label: '中文', color: '#FFE9D6', prompt: '中文(普通话)' },
          { value: 'en', label: 'English', color: '#E6F7FF', prompt: 'English' },
          { value: 'ja', label: '日本語', color: '#EAF3EA', prompt: '日本語' },
          { value: 'ko', label: '한국어', color: '#FFF3DC', prompt: '한국어' },
          { value: 'es', label: 'Español', color: '#F5EFE6', prompt: 'Español' },
        ],
      },
      {
        label: '场景',
        key: 'scene',
        options: [
          { value: 'bedroom', label: '卧室桌面', color: '#EAF3EA', prompt: '明亮卧室桌面, 有生活道具' },
          { value: 'studio', label: '直播间', color: '#F0F0F5', prompt: '专业带货直播间, 补光灯与货架' },
          { value: 'office', label: '办公室', color: '#EAF3F8', prompt: '办公室工位' },
          { value: 'outdoor', label: '户外', color: '#FFF3DC', prompt: '户外街边自然光' },
        ],
      },
    ],
    durationOptions: [10],
    tips: '语言任选, 外贸朋友直接生成英语/日语版种草视频。',
  },
  {
    id: 'video-tryon',
    type: 'video',
    category: 'video',
    title: '模特上身视频',
    subtitle: '走秀/转身展示服装上身效果',
    timeLabel: '约 5 分钟',
    credits: 25,
    needLabel: '1 张上身图或服装图',
    needImages: 1,
    defaults: { aspect_ratio: '9:16', resolution: '720p', duration: 10, mode: 'first-frame', language: '无旁白' },
    promptTemplate:
      '参考图说明: 第1张是上身图或服装图, 视频中服装的版型、颜色、印花必须与参考图一致。\n'
      + '主体与动作: 模特穿着参考图中的服装, {{motion}}, 完整展示版型、面料垂坠与动态。\n'
      + '场景: {{scene}}, 背景简洁不抢主体。\n'
      + '镜头: {{camera}}, 竖屏9:16, 运镜平滑无抖动突跳。\n'
      + '光线: {{lighting}}, 面料质感与轮廓线清晰。\n'
      + '声音: 节奏感配乐, 无突兀人声。\n'
      + '规格: 10秒, 时尚大片质感, 全片统一调色。\n'
      + '负面约束: 禁止改变服装版型与印花, 禁止字幕与水印, 禁止人物畸形与肢体穿模, 禁止画面闪烁与帧间跳变。',
    slots: [
      {
        label: '模特动作',
        key: 'motion',
        options: [
          { value: 'turn', label: '原地转身', color: '#F5EFE6', prompt: '原地缓慢转身一周展示前后版型' },
          { value: 'walk', label: '走向镜头', color: '#EAF3F8', prompt: '自信走向镜头再停顿' },
          { value: 'spin', label: '裙摆旋转', color: '#FFF3DC', prompt: '旋转让裙摆与衣摆飞扬' },
          { value: 'pose', label: '多变 pose', color: '#EAF3EA', prompt: '连续切换三个时尚 pose' },
        ],
      },
      {
        label: '运镜',
        key: 'camera',
        options: [
          { value: 'slow-push', label: '缓推', color: '#E8E8E8', prompt: '由全身缓慢推近到半身' },
          { value: 'orbit', label: '环绕', color: '#F0F0F5', prompt: '围绕模特缓慢环绕一周' },
          { value: 'low-angle', label: '低角度上摇', color: '#E6F7FF', prompt: '低角度起幅缓慢上摇至全身' },
        ],
      },
      {
        label: '场景',
        key: 'scene',
        options: [
          { value: 'street', label: '城市街头', color: '#EAF3F8', prompt: '城市街头, 浅景深' },
          { value: 'studio', label: '纯色棚', color: '#F0F0F5', prompt: '纯色摄影棚, 专业打光' },
          { value: 'show', label: '秀场', color: '#F5EFE6', prompt: '时装秀场跑道, 聚光灯' },
        ],
      },
      {
        label: '光线',
        key: 'lighting',
        options: LIGHTING.options,
      },
    ],
    durationOptions: [10],
    tips: '上传上身图做首帧, 动作还原更稳定。',
  },
  {
    id: 'video-tvc',
    type: 'video',
    category: 'video',
    title: 'TVC 广告大片',
    subtitle: '电影感品牌广告, 横屏投放',
    timeLabel: '约 8 分钟',
    credits: 40,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { aspect_ratio: '16:9', resolution: '1080p', duration: 10, mode: 'first-frame', language: '无旁白' },
    promptTemplate:
      '参考图说明: 第1张是产品图, 片中产品的造型、颜色与材质必须与参考图一致, 不得变形。\n'
      + '主体与动作: {{product}}特写开场, 缓慢推镜加环绕运镜, 材质细节极致呈现。\n'
      + '场景: {{scene}}, 画面干净有纵深。\n'
      + '光线: {{lighting}}, 体积光与高光层次分明。\n'
      + '镜头语言: 产品全景→细节特写→使用场景→品牌落版, 快慢结合的节奏剪辑, 转场干净不闪白。\n'
      + '声音: 电影感配乐, 结尾留出品牌落版空间但不生成文字。\n'
      + '规格: 横屏16:9, 10秒, 1080p, 全片统一电影级调色。\n'
      + '负面约束: 禁止出现字幕、水印与Logo, 禁止产品形变与材质失真, 禁止画面闪烁与帧间跳变, 禁止人物畸形。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一瓶精华液', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '场景',
        key: 'scene',
        options: [
          { value: 'water', label: '水面舞台', color: '#E6F7FF', prompt: '黑色镜面水面上, 产品倒影, 水花慢动作' },
          { value: 'desert', label: '旷野', color: '#FFE9D6', prompt: '金色旷野, 长焦压缩, 尘埃光束' },
          { value: 'studio', label: '极简棚拍', color: '#F0F0F5', prompt: '极简摄影棚, 单束硬光' },
          { value: 'city', label: '都市夜景', color: '#EAF3F8', prompt: '都市夜景霓虹虚化' },
        ],
      },
      {
        label: '光线',
        key: 'lighting',
        options: [
          { value: 'rim', label: '侧逆光轮廓', color: '#FFD9B8', prompt: '侧逆光勾勒产品轮廓, 体积光' },
          { value: 'hard', label: '硬光质感', color: '#E8E8E8', prompt: '硬质定向光, 明暗对比强烈' },
          { value: 'soft', label: '柔光高级', color: '#FFF3DC', prompt: '大面积柔光, 高级通透' },
        ],
      },
    ],
    durationOptions: [10],
    tips: 'TVC 节奏: 前 2 秒抓眼球, 结尾留品牌落版。',
  },
  {
    id: 'video-unbox',
    type: 'video',
    category: 'video',
    title: '开箱展示',
    subtitle: '桌面开箱 + 细节翻拍',
    timeLabel: '约 5 分钟',
    credits: 20,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { aspect_ratio: '9:16', resolution: '720p', duration: 10, mode: 'first-frame', language: '无旁白' },
    promptTemplate:
      '参考图说明: 第1张是产品图, 片中拆出的产品外观必须与参考图一致, 不得变形或换款。\n'
      + '主体与动作: 俯拍桌面视角, 双手打开{{product}}的包装, 拆封动作真实流畅, 依次展示包装盒→产品→配件, 每件物品入场都有轻微景深变化。\n'
      + '场景: {{scene}}, 桌面干净无杂物。\n'
      + '光线: 明亮柔和布光, 产品细节通透不发灰。\n'
      + '声音: ASMR质感收音, 保留拆封摩擦声。\n'
      + '规格: 竖屏9:16, 10秒, 结尾产品居中定格, 干净治愈的开箱氛围。\n'
      + '负面约束: 禁止出现字幕与水印, 禁止手部畸形与多余手指, 禁止产品凭空变形或出现多余配件, 禁止画面闪烁。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一副无线耳机', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '桌面',
        key: 'scene',
        options: [
          { value: 'wood', label: '原木桌面', color: '#F5EFE6', prompt: '温暖的原木桌面' },
          { value: 'white', label: '纯白桌面', color: '#F8F8F8', prompt: '纯白桌面, 极简' },
          { value: 'marble', label: '大理石', color: '#F0EDE8', prompt: '高级灰大理石台面' },
        ],
      },
    ],
    durationOptions: [10],
    tips: '开箱视频的完播率最高, 适合做详情页头图视频。',
  },
  {
    id: 'video-unbox-halloween',
    type: 'video',
    category: 'video',
    title: '万圣节主题产品开箱',
    subtitle: '南瓜灯氛围 · 节日限定开箱',
    timeLabel: '约 5 分钟',
    credits: 20,
    needLabel: '1 张产品图',
    needImages: 1,
    defaults: { aspect_ratio: '9:16', resolution: '720p', duration: 10, mode: 'first-frame', language: '无旁白' },
    promptTemplate:
      '参考图说明: 第1张是产品图, 片中拆出的产品外观必须与参考图一致, 不得变形或换款。\n'
      + '主体与动作: 双手打开{{product}}的包装, 拆封动作真实流畅, 依次展示包装盒→产品→配件, 结尾产品居中定格。\n'
      + '场景: {{scene}}, 画面点缀{{decor}}。\n'
      + '光线: 暗调节日氛围, {{lighting}}。\n'
      + '声音: ASMR质感收音, 保留拆封摩擦声。\n'
      + '规格: 竖屏9:16, 10秒, 趣味而不诡异的节日开箱氛围。\n'
      + '负面约束: 禁止出现字幕与水印, 禁止血腥恐怖元素, 禁止手部畸形与多余手指, 禁止产品变形, 禁止画面闪烁。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一款主题卫衣', defaultValue: '该商品', fallbackPrompt: '该商品' },
      {
        label: '氛围场景',
        key: 'scene',
        options: [
          { value: 'pumpkin', label: '南瓜灯阵', color: '#FFD9B8', prompt: '南瓜灯环绕的原木桌面, 暖橙光晕' },
          { value: 'skeleton', label: '骷髅派对', color: '#E8E8E8', prompt: '骷髅手办与蛛网装饰的桌面' },
          { value: 'magic', label: '魔法夜幕', color: '#E6E0F8', prompt: '深紫夜幕, 魔法光点悬浮' },
        ],
      },
      {
        label: '装饰元素',
        key: 'decor',
        options: [
          { value: 'spider', label: '蜘蛛与蛛网', color: '#E0E0E8', prompt: '蜘蛛与蛛网' },
          { value: 'bat', label: '蝙蝠剪影', color: '#D8DCE8', prompt: '蝙蝠剪影' },
          { value: 'candy', label: '糖果散落', color: '#FFE9D6', prompt: '节日糖果散落' },
        ],
      },
      {
        label: '光线',
        key: 'lighting',
        options: [
          { value: 'warm', label: '南瓜暖光', color: '#FFD9B8', prompt: '南瓜灯内暖橙光晕明暗摇曳' },
          { value: 'moon', label: '冷月蓝光', color: '#EAF3F8', prompt: '冷蓝月光氛围' },
          { value: 'candle', label: '烛光摇曳', color: '#FFF3DC', prompt: '烛光摇曳明暗' },
        ],
      },
    ],
    durationOptions: [10],
    tips: '万圣节节点前 1-2 周发布, 配合节日标签流量最高。',
  },

  // ============ 纯净模式内置模板 (hidden: 不进模板库列表) ============
  // 自由工作台「纯净模式」专用: 不套任何提示词框架, 用户提示词原样直通模型,
  // 定位: 有提示词工程基础、不想套模板的创作者
  {
    id: 'pure-image',
    type: 'image',
    category: 'retouch',
    hidden: true,
    passthrough: true,   // 提示词原样直通: 跳过模板质量规则 (不补负向约束, 不做长度下限)
    title: '纯净模式',
    subtitle: '提示词直通, 不套模板',
    timeLabel: '约 1 分钟',
    credits: 2,
    needLabel: '自由描述',
    needImages: 0,
    defaults: { model: 'primary', aspect_ratio: '1:1', resolution: '2K', quality: 'high', count: 1, mode: 'text-to-image' },
    promptTemplate: '{{prompt}}',
    slots: [{ key: 'prompt', label: '提示词', type: 'text', defaultValue: '' }],
    tips: '提示词原样发给模型, 不做任何改写与补充。',
  },
  {
    id: 'pure-video',
    type: 'video',
    category: 'video',
    hidden: true,
    passthrough: true,   // 提示词原样直通: 跳过模板质量规则
    title: '纯净模式',
    subtitle: '提示词直通, 不套模板',
    timeLabel: '约 5 分钟',
    credits: 20,
    needLabel: '自由描述',
    needImages: 0,
    defaults: { aspect_ratio: '9:16', resolution: '720p', duration: 10, mode: 'text-to-video' },
    promptTemplate: '{{prompt}}',
    slots: [{ key: 'prompt', label: '提示词', type: 'text', defaultValue: '' }],
    durationOptions: [10],
    tips: '提示词原样发给模型, 不做任何改写与补充。',
  },
];

export function getTemplate(id) {
  return templates.find((t) => t.id === id) ?? null;
}

/**
 * 把模板 + 槽位值组合成最终提示词 (PRD: 用户全程不写 Prompt)
 *
 * 槽位取值规则 (前端只传 option.value, 描述文本在服务端解析):
 * - 选项槽位 (options): value → 该选项的 prompt 描述 (给模型看的内容)
 *   未命中时取第一个选项; option.prompt 为空时退回 value
 * - 文本槽位 (text): 用户输入优先 → defaultValue → fallbackPrompt
 * - 未知占位符: 原样保留, 不吞掉
 */
export function composePrompt(template, slotValues = {}) {
  const slots = template.slots ?? [];
  const byKey = new Map(slots.map((s) => [s.key, s]));
  return template.promptTemplate.replace(/\{\{(\w+)\}\}/g, (raw, key) => {
    const slot = byKey.get(key);
    const v = slotValues?.[key];
    if (slot?.type === 'text') {
      if (typeof v === 'string' && v.trim()) return v.trim();
      return slot.defaultValue?.trim() || slot.fallbackPrompt?.trim() || '';
    }
    if (slot?.options?.length) {
      const picked = slot.options.find((o) => o.value === v) ?? slot.options[0];
      return picked.prompt?.trim() || picked.value || '';
    }
    if (typeof v === 'string' && v.trim()) return v.trim();
    return raw;
  });
}
