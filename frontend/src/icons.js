/**
 * 内联 SVG 图标库 (Lucide 风格, stroke 1.8, 24 viewBox)
 * 规范来源: ui-ux-pro-max-skill — 「No emojis as icons (use SVG: Heroicons/Lucide)」
 */
const P = (d) => `<path d="${d}"/>`;

const ICONS = {
  home: P('m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z') + '<polyline points="9 22 9 12 15 12 15 22"/>',
  grid: ['1 1 7 7', '16 1 7 7', '1 16 7 7', '16 16 7 7'].map((b) => {
    const [x, y, w, h] = b.split(' ');
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;
  }).join(''),
  wand: P('m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z') + P('m14 7 3 3') + P('M5 6v4') + P('M19 14v4') + P('M10 2v2') + P('M7 8H3') + P('M21 16h-4') + P('M11 3H9'),
  folder: P('M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'),
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/>' + P('m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'),
  'image-plus': P('M16 5h6') + P('M19 2v6') + P('M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5') + '<circle cx="9" cy="9" r="2"/>' + P('m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'),
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/>' + P('M12 8v13') + P('M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7') + P('M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5'),
  'file-text': P('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z') + P('M14 2v4a2 2 0 0 0 2 2h4') + P('M10 9H8') + P('M16 13H8') + P('M16 17H8'),
  layers: P('m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z') + P('m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65') + P('m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'),
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>' + P('M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z'),
  shirt: P('M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z'),
  scan: P('M3 7V5a2 2 0 0 1 2-2h2') + P('M17 3h2a2 2 0 0 1 2 2v2') + P('M21 17v2a2 2 0 0 1-2 2h-2') + P('M7 21H5a2 2 0 0 1-2-2v-2') + P('M7 12h10'),
  scissors: '<circle cx="6" cy="6" r="3"/>' + P('M8.12 8.12 12 12') + P('M20 4 8.12 15.88') + '<circle cx="6" cy="18" r="3"/>' + P('M14.8 14.8 20 20'),
  sparkles: P('M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'),
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  combine: P('M10 13H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5') + '<rect width="10" height="10" x="9" y="9" rx="2"/>',
  video: P('m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5') + '<rect x="2" y="6" width="14" height="12" rx="2"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/>' + P('M7 3v18') + P('M3 7.5h4') + P('M3 12h18') + P('M3 16.5h4') + P('M17 3v18') + P('M17 7.5h4') + P('M17 16.5h4'),
  clapperboard: P('M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z') + P('m6.2 5.3 3.1 3.9') + P('m12.4 3.4 3.1 4') + P('M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'),
  package: P('m7.5 4.27 9 5.15') + P('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z') + P('m3.3 7 8.7 5 8.7-5') + P('M12 22V12'),
  user: P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2') + '<circle cx="12" cy="7" r="4"/>',
  upload: P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4') + '<polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4') + '<polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  refresh: P('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8') + P('M21 3v5h-5') + P('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16') + P('M8 16H3v5'),
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  trash: P('M3 6h18') + P('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6') + P('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
  plus: P('M5 12h14') + P('M12 5v14'),
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: P('M18 6 6 18') + P('m6 6 12 12'),
  'arrow-right': P('M5 12h14') + P('m12 5 7 7-7 7'),
  'arrow-left': P('m12 19-7-7 7-7') + P('M19 12H5'),
  'chevron-down': P('m6 9 6 6 6-6'),
  'chevron-right': P('m9 18 6-6-6-6'),
  'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2"/>' + P('M2 10h20'),
  settings: P('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z') + '<circle cx="12" cy="12" r="3"/>',
  wallet: P('M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1') + P('M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'),
  'rotate-ccw': P('M3 12a9 9 0 1 0 3-6.7L3 8') + P('M3 3v5h5'),
  info: '<circle cx="12" cy="12" r="10"/>' + P('M12 16v-4') + P('M12 8h.01'),
};

/** 生成 SVG 元素; name 不存在时回退 info */
export function icon(name, { size = 18, strokeWidth = 1.8, className = '' } = {}) {
  const body = ICONS[name] ?? ICONS.info;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', strokeWidth);
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  if (className) el.setAttribute('class', className);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = body;
  return el;
}

export const hasIcon = (name) => name in ICONS;
