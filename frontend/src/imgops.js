/**
 * 图片本地处理纯函数 (Canvas) —— 文件不出浏览器, 零费用
 * 全部输入 File/Blob, 输出 { blob, width, height, name, quality? }
 *
 * 画质原则: 所有缩放统一走浏览器高质量重采样算子 (imageSmoothingQuality='high',
 * 内部为卷积核加权插值, 近似 Lanczos 效果) —— 不用最近邻 (锯齿) 也不手写矩阵;
 * 压缩到目标体积用「质量二分」逼近: 在达标前提下取最高质量, 保持与原图最大一致性。
 */

export function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function highQualityCtx(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

async function loadBitmap(source) {
  // from-image: 按 EXIF 方向摆正 (手机照片); 不支持的浏览器退化为默认解码
  return createImageBitmap(source, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(source));
}

function canvasBlob(canvas, type = 'image/jpeg', quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), type, quality);
  });
}

function outName(name, ext) {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${ext}`;
}

const keepAlphaOf = (file) => file.type === 'image/png' || file.type === 'image/webp';
const jpgName = (name) => outName(name, 'jpg');

/** 压缩: 原分辨率重编码 JPEG (透明区填白), quality 0~1
 * 膨胀保护: 源图本身已高压缩时, canvas 编码器重编码可能反而变大 ——
 * 此时退化为「压到原图 85%」的智能二分, 保证压缩工具永远有实际收益 */
export async function compressImage(file, quality = 0.8) {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = highQualityCtx(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const blob = await canvasBlob(canvas, 'image/jpeg', quality);
  if (file.size > 30 * 1024 && blob.size >= file.size * 0.95) {
    return compressToTarget(file, Math.round(file.size * 0.85));
  }
  return { blob, width: canvas.width, height: canvas.height, name: jpgName(file.name) };
}

/**
 * 智能压缩到目标体积 (字节):
 * 1) 原分辨率下二分质量 [0.5, 0.95] 取 ≤目标 的最高质量 —— 优先保分辨率
 * 2) 最低质量仍超 → 高质量降采样 (面积比 sqrt) 后重新二分 (最多 3 轮)
 */
export async function compressToTarget(file, targetBytes) {
  const encode = async (quality, scale = 1) => {
    const bitmap = await loadBitmap(file);
    const w = Math.max(16, Math.round(bitmap.width * scale));
    const h = Math.max(16, Math.round(bitmap.height * scale));
    bitmap.close?.();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = highQualityCtx(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const bm = await loadBitmap(file);
    ctx.drawImage(bm, 0, 0, w, h);
    bm.close?.();
    const blob = await canvasBlob(canvas, 'image/jpeg', quality);
    return { blob, width: w, height: h, quality };
  };

  // 阶段 1: 原分辨率二分
  const top = await encode(0.95);
  if (top.blob.size <= targetBytes) return { ...top, name: jpgName(file.name) };
  let lo = 0.5, hi = 0.95, best = null, floorSize = null;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const r = await encode(mid);
    if (r.blob.size <= targetBytes) { best = r; lo = mid; } else { hi = mid; floorSize = r.blob.size; }
  }

  // 阶段 2: 最低质量仍超 → 按面积比降采样后重新二分
  if (!best) {
    let scale = Math.sqrt((targetBytes * 0.9) / floorSize);
    for (let round = 0; round < 3 && !best; round++) {
      lo = 0.5; hi = 0.95;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        const r = await encode(mid, scale);
        if (r.blob.size <= targetBytes) { best = r; lo = mid; } else { hi = mid; }
      }
      if (!best) scale *= 0.8;
    }
  }
  if (!best) best = await encode(0.5, 0.55); // 兜底: 极限小图
  return { ...best, name: jpgName(file.name) };
}

/**
 * 改尺寸
 * fit 模式: 目标画布 contain 白底居中 (平台主图正方形); stretch: 直接拉伸
 * width/height 只填一个 = 等比缩放另一边
 */
export async function resizeImage(file, { width, height, mode = 'fit' }) {
  const bitmap = await loadBitmap(file);
  let w = width, h = height;
  if (!w && !h) throw new Error('至少填写宽或高');
  if (!h) h = Math.round((w / bitmap.width) * bitmap.height);
  if (!w) w = Math.round((h / bitmap.height) * bitmap.width);
  const keepAlpha = keepAlphaOf(file);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = highQualityCtx(canvas);
  if (mode === 'fit') {
    const scale = Math.min(w / bitmap.width, h / bitmap.height);
    const dw = Math.round(bitmap.width * scale);
    const dh = Math.round(bitmap.height * scale);
    if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(bitmap, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  } else {
    ctx.drawImage(bitmap, 0, 0, w, h);
  }
  bitmap.close?.();
  const type = keepAlpha ? file.type : 'image/jpeg';
  const blob = await canvasBlob(canvas, type, 0.92);
  return { blob, width: w, height: h, name: outName(file.name, type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg') };
}

/** 中心裁剪到指定比例 ('1:1'/'4:3'... sx,sy,sw,sh 为可选的显式选区, 原图坐标; 自动 clamp 进边界) */
export async function cropImage(file, ratio, sel) {
  const bitmap = await loadBitmap(file);
  const clamp = (v, max) => Math.max(0, Math.min(Math.round(v), max));
  let sx = clamp(sel?.x ?? 0, bitmap.width - 16), sy = clamp(sel?.y ?? 0, bitmap.height - 16);
  let sw = clamp(sel?.w ?? bitmap.width, bitmap.width - sx), sh = clamp(sel?.h ?? bitmap.height, bitmap.height - sy);
  if (ratio && ratio !== 'free') {
    const [rw, rh] = ratio.split(':').map(Number);
    const target = rw / rh;
    if (!sel) {
      // 中心最大选区
      if (bitmap.width / bitmap.height > target) {
        sh = bitmap.height;
        sw = Math.round(sh * target);
      } else {
        sw = bitmap.width;
        sh = Math.round(sw / target);
      }
      sx = Math.round((bitmap.width - sw) / 2);
      sy = Math.round((bitmap.height - sh) / 2);
    }
  }
  bitmap.close?.();
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  highQualityCtx(canvas);
  const bm = await loadBitmap(file);
  canvas.getContext('2d').drawImage(bm, sx, sy, sw, sh, 0, 0, sw, sh);
  bm.close?.();
  const keepAlpha = keepAlphaOf(file);
  const type = keepAlpha ? file.type : 'image/jpeg';
  const blob = await canvasBlob(canvas, type, 0.92);
  return { blob, width: sw, height: sh, name: outName(file.name, type === 'image/png' ? 'png' : 'jpg') };
}

/** 触发浏览器下载 */
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
