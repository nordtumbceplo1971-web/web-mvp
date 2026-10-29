/** 模板元数据: SVG 图标 + 分类功能色 (弱风格化: 中性底 + 语义色, 不再用 emoji) */

/** 分类 → { 底色微染, 图标色 } */
export const CATEGORY_TINT = {
  'main-image': { tint: '#eff6ff', color: '#2563eb' },
  series: { tint: '#f5f3ff', color: '#7c3aed' },
  tryon: { tint: '#fff7ed', color: '#ea580c' },
  retouch: { tint: '#f1f5f9', color: '#475569' },
  video: { tint: '#ecfdf5', color: '#16a34a' },
};

export const TPL_ICONS = {
  'shopify-lookbook': 'layers',
  'main-white': 'image',
  'main-scene': 'image-plus',
  'main-festival': 'gift',
  'series-detail': 'file-text',
  'series-multi-angle': 'layers',
  'series-colors': 'palette',
  'tryon-female-asia': 'shirt',
  'tryon-detail': 'scan',
  'retouch-bg': 'image-plus',
  'retouch-remove-bg': 'scissors',
  'retouch-enhance': 'sparkles',
  'retouch-text': 'type',
  'retouch-fusion': 'combine',
  'video-seeding': 'clapperboard',
  'video-tryon': 'user',
  'video-tvc': 'film',
  'video-unbox': 'package',
  'video-unbox-halloween': 'gift',
};

export const KIND_LABEL = { image: '图片模板', video: '视频模板' };

/** 模板 logo (蓝框内展示); 未配 logo 的模板回退到分类图标 */
const TPL_LOGOS = {
  'shopify-lookbook': { src: '/brand/shopify-logo.svg', alt: 'Shopify' },
};

export function tplLogo(tpl) {
  return TPL_LOGOS[tpl.id] ?? null;
}

/** 模板效果预览图 (卡片上方 70% 展示); 未配图的模板回退到分类色块 + 图标
    video: 视频封面 (默认显示 poster 首帧, 悬停自动播放); ratio: 预览窗长宽比 (按素材比例适配, 缺省跟随卡片默认) */
const TPL_PREVIEWS = {
  'shopify-lookbook': { src: '/covers/shopify-lookbook.jpg', alt: 'Shopify 套图 7 步成品预览' },
  'main-white': { src: '/covers/main-white.jpg', alt: '白底主图效果预览 · 正面平铺' },
  'tryon-female-asia': { src: '/covers/tryon-female-asia.jpg', alt: '模特上身图效果预览 · Lookbook 街拍' },
  'video-tvc': {
    video: '/covers/tvc-preview.mp4', poster: '/covers/tvc-preview-poster.jpg', ratio: '16/9',
    alt: 'TVC 广告大片效果预览 · 悬停播放',
  },
  'video-tryon': {
    video: '/covers/tryon-video-preview.mp4', poster: '/covers/tryon-video-poster.jpg', ratio: '16/9',
    alt: '模特上身视频效果预览 · 悬停播放',
  },
  'video-unbox-halloween': {
    video: '/covers/video-unbox-halloween.mp4', poster: '/covers/video-unbox-halloween-poster.jpg', ratio: '9/16',
    alt: '万圣节主题产品开箱效果预览 · 悬停播放',
  },
};

export function tplPreview(tpl) {
  return TPL_PREVIEWS[tpl.id] ?? null;
}

/** 模板成品图集 (详情页「效果预览」); 图在 frontend/public/flows/<模板id>/ */
const TPL_FLOWS = {
  // 模特上身图: 图1 服装参考 + 图2 模特形象参考 + 图3 成图 (复用封面素材)
  'tryon-female-asia': [
    { src: '/flows/tryon-female-asia/clothing.png', cap: '图1 服装参考', alt: '服装平铺图 · 唯一服装来源' },
    { src: '/flows/tryon-female-asia/model.png', cap: '图2 模特参考', alt: '模特形象参考 · 仅取身材体型' },
    { src: '/covers/tryon-female-asia.jpg', cap: '图3 成图效果', alt: 'Lookbook 街拍上身成图' },
  ],
  'shopify-lookbook': [
    { src: '/flows/shopify-lookbook/product.jpg', cap: '产品图', alt: '产品原图 · 正/背面拼版' },
    { src: '/flows/shopify-lookbook/step-01.jpg', cap: '01 列表主图', alt: '01 列表主图效果' },
    { src: '/flows/shopify-lookbook/step-02.jpg', cap: '02 背面展示', alt: '02 背面展示效果' },
    { src: '/flows/shopify-lookbook/step-03.jpg', cap: '03 完整穿搭', alt: '03 完整穿搭效果' },
    { src: '/flows/shopify-lookbook/step-04.jpg', cap: '04 印花细节', alt: '04 印花细节效果' },
    { src: '/flows/shopify-lookbook/step-05.jpg', cap: '05 面料做工', alt: '05 面料与做工效果' },
    { src: '/flows/shopify-lookbook/step-06.jpg', cap: '06 另一模特', alt: '06 另一位模特效果' },
    { src: '/flows/shopify-lookbook/step-07.jpg', cap: '07 品牌生活', alt: '07 品牌生活方式效果' },
  ],
  // TVC: 参考素材(产品图/模特图) + 结果预览(视频)
  // 视频条目直接复用封面那条素材 (/covers/tvc-preview.mp4), 不额外拷贝一份
  'video-tvc': [
    { src: '/flows/video-tvc/product.jpg', cap: '产品图', alt: '产品原图 · 正/背面拼版' },
    { src: '/flows/video-tvc/model.jpg', cap: '模特图', alt: '模特上身 · 城市黄昏街拍' },
    {
      video: '/covers/tvc-preview.mp4', poster: '/covers/tvc-preview-poster.jpg',
      cap: '结果预览 · TVC 视频', alt: 'TVC 广告大片 · 成片预览',
    },
  ],
  // 模特上身视频: 产品图(正/背面拼版) + 结果预览(视频, 复用封面素材)
  'video-tryon': [
    { src: '/flows/video-tryon/product.jpg', cap: '产品图', alt: '产品原图 · 正/背面拼版 · CITY IN MOTION' },
    {
      video: '/covers/tryon-video-preview.mp4', poster: '/covers/tryon-video-poster.jpg',
      cap: '结果预览 · 上身视频', alt: '模特上身视频 · 成片预览',
    },
  ],
  // 万圣节主题开箱: 结果预览(视频, 复用封面素材)
  'video-unbox-halloween': [
    {
      video: '/covers/video-unbox-halloween.mp4', poster: '/covers/video-unbox-halloween-poster.jpg',
      cap: '结果预览 · 万圣节开箱', alt: '万圣节主题产品开箱 · 成片预览',
    },
  ],
};

export function tplFlow(tpl) {
  return TPL_FLOWS[tpl.id] ?? null;
}

export function tplCover(tpl) {
  const t = CATEGORY_TINT[tpl.category] ?? { tint: '#f1f5f9', color: '#475569' };
  return { iconName: TPL_ICONS[tpl.id] ?? 'image', tint: t.tint, color: t.color };
}
