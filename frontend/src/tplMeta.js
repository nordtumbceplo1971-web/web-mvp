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

export function tplCover(tpl) {
  const t = CATEGORY_TINT[tpl.category] ?? { tint: '#f1f5f9', color: '#475569' };
  return { iconName: TPL_ICONS[tpl.id] ?? 'image', tint: t.tint, color: t.color };
}
