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
};

export function tplPreview(tpl) {
  return TPL_PREVIEWS[tpl.id] ?? null;
}

export function tplCover(tpl) {
  const t = CATEGORY_TINT[tpl.category] ?? { tint: '#f1f5f9', color: '#475569' };
  return { iconName: TPL_ICONS[tpl.id] ?? 'image', tint: t.tint, color: t.color };
}
