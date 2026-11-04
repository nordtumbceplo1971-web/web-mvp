/**
 * 登录鉴权 (单一访问码 · 无状态 token)
 *
 * - ACCESS_CODE 未配置 → 鉴权关闭, 全部放行 (本地开发 / MOCK 模式)
 * - POST /api/auth/login { code } → 校验访问码, 签发 token: `${exp}.${hmac(exp, ACCESS_CODE)}`
 *   - token 有效期 30 天; 无状态, 不依赖存储/会话
 *   - 改 ACCESS_CODE 即吊销全部旧 token (HMAC key 变化)
 * - authRequired 中间件: 校验 Authorization: Bearer <token>, 失败返回 401
 * - login 尝试限流: 5 次/分钟/IP, 防爆破
 */

import crypto from 'node:crypto';
import { config } from '../config.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/** 是否启用鉴权 (配置了访问码才启用) */
export const authEnabled = () => Boolean(config.accessCode);

function hmac(payload) {
  return crypto.createHmac('sha256', `996studio:${config.accessCode}`).update(payload).digest('hex');
}

export function createToken() {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return { token: `${exp}.${hmac(exp)}`, expiresAt: Number(exp) };
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expect = hmac(exp);
  if (sig.length !== expect.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
}

// ---------- login 限流 (内存, 5 次/分钟/IP) ----------
const attempts = new Map(); // ip -> { count, resetAt }
const LIMIT = 5;
const WINDOW_MS = 60 * 1000;

function rateLimit(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  rec.count += 1;
  return rec.count <= LIMIT;
}

export function loginHandler(req, res) {
  if (!authEnabled()) {
    return res.json({ ok: true, authRequired: false });
  }
  if (!rateLimit(req.ip ?? req.socket?.remoteAddress ?? 'unknown')) {
    return res.status(429).json({ error: { code: 'too_many_attempts', message: '尝试过于频繁, 请 1 分钟后再试' } });
  }
  const code = String(req.body?.code ?? '').trim();
  const expect = String(config.accessCode);
  const ok = code.length === expect.length
    && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expect));
  if (!ok) {
    return res.status(401).json({ error: { code: 'bad_code', message: '访问码不正确' } });
  }
  const { token, expiresAt } = createToken();
  res.json({ ok: true, token, expiresAt });
}

/** 鉴权中间件: 挂在 /api 路由上 (login / health 等公开端点在此之前注册) */
export function authRequired(req, res, next) {
  if (!authEnabled()) return next();
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (verifyToken(token)) return next();
  res.status(401).json({ error: { code: 'unauthorized', message: '请先登录' } });
}
