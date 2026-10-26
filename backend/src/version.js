import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 后端版本号 —— 唯一来源为 backend/package.json 的 version 字段
 * 之前在 app.js / routes.js 里各硬编码一份, 改版本容易漏改导致对外自述不一致。
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

/** 形如 '0.1.7' (不带 v 前缀) */
export const VERSION = pkg.version;

/** 形如 'v0.1.7' (带 v 前缀, 与前端 APP_VERSION 保持一致) */
export const APP_VERSION = `v${VERSION}`;
