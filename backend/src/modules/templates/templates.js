/**
 * 模板库（任务视角, 非模型能力视角 — PRD 模块 1）
 *
 * 提示词方法论参考:
 * - 生图: 电商出图公式 = 镜头/构图 + 产品主体 + 场景背景 + 布光 + 风格质感 + 商业规格
 *   (zhihu p/2061109893466216203 · github Ss-miao/ai-ecommerce-image-prompts)
 * - 视频: 运镜 + 主体动作 + 场景 + 光线氛围 + 音频/旁白 + 商业规格
 *   (tahou.com 217468593963350021 · clipcat.ai ecommerce-video-prompts · iosur.com ai-video-prompts)
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
      '根据图片的图片参考，输出白底的的产品主图（如果主体图有正反面，那就是用正面输出产品主图）。保持与原图产品的整体形态和细节的一致性，形态，材质等元素都要完美还原。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一双米白色帆布鞋', defaultValue: '产品' },
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
      '电商场景主图: {{product}}自然摆放在{{scene}}, 三分法构图, 浅景深虚化背景突出主体, {{lighting}}, 画面明亮干净, 高级生活方式感, 商业广告摄影, 8K超清。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一瓶气泡水', defaultValue: '产品' },
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
      '电商节日大促KV主图: {{product}}为绝对视觉中心, {{festival}}节日氛围布景, 礼盒彩带丝带飘带点缀但不过度遮挡产品, 画面上方留出标题文字区, {{lighting}}, 热烈高级的商业促销海报质感, 8K超清。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一盒坚果礼盒', defaultValue: '产品' },
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
      '电商详情页首屏长图: {{product}}居中偏上构图, {{scene}}, 画面下方三分之一留白用于卖点文案排版, {{lighting}}, 信息层级清晰, 高级电商详情页设计感, 8K超清。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一款保温杯', defaultValue: '产品' },
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
      '电商产品多角度套装图: {{product}}的完整多视图展示, 每张一个角度(正面/侧面/背面/底部细节), 统一纯白背景与统一布光({{lighting}}), 像素级一致的色彩还原, 产品摄影图鉴风格, 8K超清。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一台迷你投影仪', defaultValue: '产品' },
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
      '电商多色变体展示图: {{product}}并排展示全部配色({{palette}}), 等距一字排开, 每个变体造型完全一致仅颜色不同, 纯白背景, {{lighting}}, 产品目录图鉴风格, 8K超清。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一件连帽卫衣', defaultValue: '产品' },
      {
        label: '配色',
        key: 'palette',
        options: [
          { value: 'earth', label: '大地色系', color: '#D9C6A5', prompt: '燕麦色/咖色/焦糖/米白' },
          { value: 'candy', label: '糖果色系', color: '#FFD6E7', prompt: '奶黄/薄荷绿/樱花粉/天蓝' },
          { value: 'mono', label: '经典黑白灰', color: '#E8E8E8', prompt: '黑/白/浅灰/深灰' },
          { value: 'jewel', label: '宝石色系', color: '#B8D8D8', prompt: '墨绿/酒红/藏蓝/烟紫' },
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
    subtitle: 'Lookbook 街拍上身展示 · 服装+模特双参考',
    timeLabel: '约 2 分钟',
    credits: 3,
    needLabel: '服装图 + 模特参考图（2 张）',
    needImages: 2,
    defaults: { model: 'primary', aspect_ratio: '3:4', resolution: '2K', quality: 'high', count: 1, mode: 'image-edit' },
    // 内置提示词 (用户提供, 固定完整框架): 图1=服装唯一来源, 图2=仅模特体型参考
    promptTemplate:
      '图1是唯一的服装来源：模特必须完整穿着图1中的这件服饰，其款式、版型、颜色、面料、图案细节均严格还原图1，不得有任何改动。图2仅作为模特形象参考：只参考图2中模特的身材体型，必须完全忽略（不复制、不保留）图2模特身上所穿的任何服装。成图中模特全身只穿图1的这一套服饰，严禁混入图2中的任何服饰元素。\n'
      + '时尚电商Lookbook摄影。模特穿着与参考图1完全一致的上衣，整套造型（上衣+下装）为同一套系搭配：下装为与上衣自然色系搭配（黑配白，白配黑）、同质感面料、同风格版型的配套裤装/裙装，色彩过渡自然、色相统一、明度协调，整体搭配和谐完整，严禁出现与上衣风格或颜色冲突的下装。\n'
      + '模特身体呈约45度侧对镜头，重心完全落在后侧支撑腿上，前腿膝盖微曲、脚尖轻点地面，胯部自然向一侧顶出，形成柔和的S形腰线。双肩下沉并向后展开，侧面肩线与背部线条干净利落。一手自然垂于身侧、五指放松微张，另一手轻搭在腰侧或服饰口袋处，指尖引导视线落在服装设计细节上。头部向镜头回转，下巴微收、略向肩侧倾斜，眼神从发丝后直视镜头，嘴角含一丝若有似无的浅笑，神情从容优雅，传递"不经意被捕捉"的松弛高级感。\n'
      + '背景为美国极具现代化时尚风的fashion城市街头；柔和影棚顶光加左前补光，产品底部带淡淡倒影；清晰呈现服装版型、面料质感与垂坠感，真实皮肤质感与自然光影；8K超清，时尚电商Lookbook摄影风格。',
    slots: [],
    tips: '第 1 张传服装平铺/挂拍图（服装唯一来源），第 2 张传模特形象参考图（只取身材体型）。',
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
      '服饰细节特写图: 模特身穿{{product}}的局部特写, 聚焦{{part}}, 微距镜头, 布料纹理、走线与材质清晰可见, {{lighting}}, 高级质感商业静物摄影, 8K超清。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一件针织开衫', defaultValue: '服装' },
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
      '产品换背景: 完整保留图中产品的造型、颜色、材质与文字, 仅将背景替换为{{scene}}, 主体边缘干净无白边, 阴影与新场景光源方向一致({{lighting}}), 画面自然真实, 8K超清。',
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
      '产品去背景: 精准保留图中产品的完整造型与细节, 移除全部背景, 输出透明底, 产品边缘干净锐利无锯齿无白边, 保留产品原有的光影层次。',
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
      '图片翻新增强: 在完全保留原图构图、产品造型与文字信息的前提下, 提升清晰度与分辨率, 去除噪点与压缩痕迹, 校正白平衡与色彩({{tone}}), 细节锐利通透, 商业级画质。',
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
      '包装文字替换: 保持包装的设计、材质、光影与透视完全不变, 仅将包装上的主文字替换为「{{text}}」, 新文字遵循原有的字体风格、弧度与透视变形, 印刷质感真实, 边缘自然。',
    slots: [
      { key: 'text', label: '改成什么字', type: 'text', placeholder: '例: 996 STUDIO', defaultValue: 'NEW TEXT' },
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
      '多图融合: 将第一张图中的产品自然融入第二张图的场景中, 产品造型颜色材质严格忠于原图, 透视与比例协调, 光影方向与场景光源一致({{lighting}}), 生成真实自然的合成照片, 8K超清。',
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
      '竖屏电商种草短视频: 年轻主播手持{{product}}面对镜头, 用{{language}}热情介绍产品卖点, 语速轻快口语化, 带货话术自然有感染力, 背景为{{scene}}, 手持vlog运镜轻微晃动, 中间切一个产品细节特写, 画面鲜活有网感, 真人实拍质感, 收音清晰人声突出。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一款便携榨汁杯', defaultValue: '产品' },
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
      '竖屏服饰上身展示视频: 模特身穿图中服装, {{motion}}, 镜头{{camera}}, 背景为{{scene}}, {{lighting}}, 完整展示服装版型与面料动感(垂坠/飘逸/弹力), 节奏感配乐, 时尚大片质感。',
    slots: [
      {
        label: '模特动作',
        key: 'motion',
        options: [
          { value: 'turn', label: '原地转身', color: '#F5EFE6', prompt: '原地缓慢转身一周展示前后版型' },
          { value: 'walk', label: '走向镜头', color: '#EAF3F8', prompt: '自信走向镜头再停顿' },
          { value: 'spin', label: '裙摆旋转', color: '#FFF3DC', prompt: '旋转让裙摆/衣摆飞扬' },
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
      '电影感产品TVC广告: {{product}}特写开场, 缓慢推镜+环绕运镜, {{scene}}中{{lighting}}, 产品材质细节极致呈现, 镜头语言: 产品全景→细节特写→使用场景→品牌落版, 快慢结合的节奏剪辑, 高级质感配乐, 商业大片质感, 画面统一的电影级调色。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一瓶精华液', defaultValue: '产品' },
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
      '竖屏开箱展示视频: 俯拍桌面视角, 双手打开{{product}}的包装, 拆封动作真实流畅, 依次展示包装盒→产品→配件, 每件物品入场都有轻微景深变化, 背景为{{scene}}, 明亮柔和布光, 最后产品居中定格, ASMR 质感收音(拆封摩擦声), 干净治愈的开箱氛围。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一副无线耳机', defaultValue: '产品' },
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
      '万圣节主题竖屏开箱展示视频: {{scene}}, 双手打开{{product}}的包装, 拆封动作真实流畅, 依次展示包装盒→产品→配件, 画面中点缀{{decor}}, 暗调节日氛围里{{lighting}}, 最后产品居中定格, ASMR 质感收音(拆封摩擦声), 趣味而不诡异的节日开箱氛围。',
    slots: [
      { key: 'product', label: '产品是什么', type: 'text', placeholder: '例: 一款主题卫衣', defaultValue: '产品' },
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

/** 把模板 + 槽位值组合成最终提示词 (PRD: 用户全程不写 Prompt) */
export function composePrompt(template, slotValues = {}) {
  return template.promptTemplate.replace(/\{\{(\w+)\}\}/g, (raw, key) => {
    const v = slotValues[key];
    if (v && typeof v === 'string' && v.trim()) return v.trim();
    // 兜底: 找槽位默认选项
    const slot = template.slots.find((s) => s.key === key);
    if (slot?.type === 'text') return slot.defaultValue ?? '';
    const firstOpt = slot?.options?.[0];
    return firstOpt ? firstOpt.prompt : raw;
  });
}
