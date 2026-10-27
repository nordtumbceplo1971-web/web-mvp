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
};

export const KIND_LABEL = { image: '图片模板', video: '视频模板' };

/** 模板 logo (蓝框内展示); 未配 logo 的模板回退到分类图标 */
const TPL_LOGOS = {
  'shopify-lookbook': { src: '/brand/shopify-logo.svg', alt: 'Shopify' },
};

export function tplLogo(tpl) {
  return TPL_LOGOS[tpl.id] ?? null;
}

/** 模板效果预览图 (卡片上方 70% 展示); 未配图的模板回退到分类色块 + 图标 */
const TPL_PREVIEWS = {
  'shopify-lookbook': { src: '/covers/shopify-lookbook.jpg', alt: 'Shopify 套图 7 步成品预览' },
  'main-white': { src: '/covers/main-white.jpg', alt: '白底主图效果预览 · 正面平铺' },
};

export function tplPreview(tpl) {
  return TPL_PREVIEWS[tpl.id] ?? null;
}

/** 模板成品图集 (详情页「效果预览」); 图在 frontend/public/flows/<模板id>/ */
const TPL_FLOWS = {
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
};

export function tplFlow(tpl) {
  return TPL_FLOWS[tpl.id] ?? null;
}

export function tplCover(tpl) {
  const t = CATEGORY_TINT[tpl.category] ?? { tint: '#f1f5f9', color: '#475569' };
  return { iconName: TPL_ICONS[tpl.id] ?? 'image', tint: t.tint, color: t.color };
}
