/**
 * 登录鉴权 (单一访问码 + 邮箱账号体系 · 无状态 token)
 *
 * - ACCESS_CODE 未配置 → 访问码通道关闭; SMTP/账号由 mailer 与 users 模块负责
 * - 两种登录均签发统一格式 token: `${exp}|${uid}.${hmac(payload, ACCESS_CODE)}`
 *   - uid: 账号登录为用户 id; 访问码登录为 "guest"
 *   - token 有效期 30 天; 无状态; 改 ACCESS_CODE 即吊销全部旧 token
 * - authRequired 中间件: 校验 Authorization: Bearer <token>, 失败返回 401
 * - 访问码 login 限流 5 次/分钟/IP, 防爆破
 */

import crypto from 'node:crypto';
import { config } from '../config.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/** 是否启用访问码通道 (配置了访问码才启用) */
export const authEnabled = () => Boolean(config.accessCode);

function hmac(payload) {
  return crypto.createHmac('sha256', `996studio:${config.accessCode}`).update(payload).digest('hex');
}

/** uid: 用户 id (账号登录) 或 'guest' (访问码登录) */
export function createToken(uid = 'guest') {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const payload = `${exp}|${uid}`;
  return { token: `${payload}.${hmac(payload)}`, expiresAt: Number(exp), uid };
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const bar = payload.indexOf('|');
  if (bar <= 0) return null;
  const exp = payload.slice(0, bar);
  const uid = payload.slice(bar + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return null;
  const expect = hmac(payload);
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  return { uid, exp: expNum };
}

// ---------- 访问码 login 限流 (内存, 5 次/分钟/IP) ----------
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
  const { token, expiresAt } = createToken('guest');
  res.json({ ok: true, token, expiresAt, uid: 'guest' });
}

/** 鉴权中间件: 挂在 /api 路由上 (login / health 等公开端点在此之前注册) */
export function authRequired(req, res, next) {
  if (!authEnabled()) return next();
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = verifyToken(token);
  if (claims) {
    req.auth = claims; // { uid, exp } — 供后续按用户隔离使用
    return next();
  }
  res.status(401).json({ error: { code: 'unauthorized', message: '请先登录' } });
}
