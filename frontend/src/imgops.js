/**
 * 图片本地处理纯函数 (Canvas) —— 文件不出浏览器, 零费用
 * 全部输入 File/Blob, 输出 { blob, width, height, name }
 */

export function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

async function toCanvas(source, { width, height, fill }) {
  // from-image: 按 EXIF 方向摆正 (手机照片)
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(source));
  const w = width ?? bitmap.width;
  const h = height ?? bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h); }
  return { canvas, ctx, bitmap, w, h };
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

/** 压缩: 统一转 JPEG (透明区填白), quality 0~1 */
export async function compressImage(file, quality = 0.75) {
  const { canvas, bitmap } = await toCanvas(file, { fill: '#ffffff' });
  bitmap.close?.();
  const blob = await canvasBlob(canvas, 'image/jpeg', quality);
  return { blob, width: canvas.width, height: canvas.height, name: outName(file.name, 'jpg') };
}

/**
 * 改尺寸
 * fit 模式: 目标画布 contain 白底居中 (平台主图正方形); stretch: 直接拉伸
 * width/height 只填一个 = 等比缩放另一边
 */
export async function resizeImage(file, { width, height, mode = 'fit' }) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  let w = width, h = height;
  if (!w && !h) throw new Error('至少填写宽或高');
  if (!h) h = Math.round((w / bitmap.width) * bitmap.height);
  if (!w) w = Math.round((h / bitmap.height) * bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
  if (mode === 'fit' && !keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  if (mode === 'fit') {
    const scale = Math.min(w / bitmap.width, h / bitmap.height);
    const dw = Math.round(bitmap.width * scale);
    const dh = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  } else {
    ctx.drawImage(bitmap, 0, 0, w, h);
  }
  bitmap.close?.();
  const type = keepAlpha ? file.type : 'image/jpeg';
  const blob = await canvasBlob(canvas, type, 0.92);
  return { blob, width: w, height: h, name: outName(file.name, type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg') };
}

/** 中心裁剪到指定比例 ('1:1'/'4:3'... sx,sy,sw,sh 为可选的显式选区, 原图坐标) */
export async function cropImage(file, ratio, sel) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  let sx = sel?.x ?? 0, sy = sel?.y ?? 0, sw = sel?.w ?? bitmap.width, sh = sel?.h ?? bitmap.height;
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
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close?.();
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
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
