/**
 * 邮件发送 (网易企业邮箱 SMTP) + 注册验证码
 *
 * env:
 *   SMTP_HOST   smtphz.qiye.163.com
 *   SMTP_PORT   465 (ssl) / 994
 *   SMTP_USER   发信邮箱, 如 no-reply@yourdomain.com
 *   SMTP_PASS   邮箱密码或授权码
 *   SMTP_FROM   发件人显示, 缺省同 SMTP_USER
 *   REGISTER_DOMAIN 注册邮箱白名单域名, 如 yourdomain.com (多个逗号分隔; 空 = 不限, 不推荐)
 *
 * SMTP 未配置时: 验证码只打印到服务端日志 (devCode 仅在 MOCK 模式返回给前端, 方便本地调试)
 */

import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import { config, isMockMode } from '../config.js';

const CODE_TTL_MS = 10 * 60 * 1000;        // 验证码 10 分钟
const RESEND_COOLDOWN_MS = 60 * 1000;      // 重发冷却 60 秒
const MAX_ATTEMPTS = 5;                    // 每个验证码最多尝试 5 次

// email -> { code, exp, attempts, lastSentAt }
const pending = new Map();

const smtpReady = () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

function transporter() {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: Number(config.smtp.port) || 465,
    secure: Number(config.smtp.port) !== 994 && Number(config.smtp.port) !== 25,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: 15_000,
  });
}

/** 注册域名白名单: 空 = 不限; 否则邮箱必须以 @<域名> 结尾之一 */
export function emailAllowed(email) {
  const domains = String(config.smtp.registerDomain ?? '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!domains.length) return true;
  const norm = String(email ?? '').trim().toLowerCase();
  return domains.some((d) => norm.endsWith(`@${d}`));
}

export function issueCode(email) {
  const norm = String(email ?? '').trim().toLowerCase();
  const prev = pending.get(norm);
  const now = Date.now();
  if (prev && now - prev.lastSentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - prev.lastSentAt)) / 1000);
    const err = new Error(`发送过于频繁, 请 ${wait} 秒后再试`); err.status = 429; err.code = 'resend_cooldown';
    throw err;
  }
  const code = String(crypto.randomInt(100000, 1000000));
  pending.set(norm, { code, exp: now + CODE_TTL_MS, attempts: 0, lastSentAt: now });
  return code;
}

export async function sendCodeEmail(email, code) {
  const from = config.smtp.from || config.smtp.user;
  const info = await transporter().sendMail({
    from: `"996 Studio" <${from}>`,
    to: email,
    subject: `996 Studio 注册验证码: ${code}`,
    text: `你的注册验证码是 ${code}，10 分钟内有效。如非本人操作请忽略本邮件。`,
    html: `<p>你的注册验证码是</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>10 分钟内有效。如非本人操作请忽略本邮件。</p>`,
  });
  return info.messageId;
}

export async function deliverCode(email) {
  const code = issueCode(email);
  if (!smtpReady()) {
    console.warn(`[mailer] SMTP 未配置, 验证码未发送 — ${email}: ${code}`);
    if (config.smtp.devEcho) return { sent: false, devCode: code };
    const err = new Error('邮件服务未配置, 请联系管理员'); err.status = 503; err.code = 'smtp_not_configured';
    throw err;
  }
  await sendCodeEmail(email, code);
  return { sent: true, devCode: null };
}

/** 校验验证码 (正确则立即作废) */
export function checkCode(email, code) {
  const norm = String(email ?? '').trim().toLowerCase();
  const rec = pending.get(norm);
  if (!rec) return { ok: false, reason: '请先获取验证码' };
  if (Date.now() > rec.exp) { pending.delete(norm); return { ok: false, reason: '验证码已过期, 请重新获取' }; }
  if (rec.attempts >= MAX_ATTEMPTS) { pending.delete(norm); return { ok: false, reason: '尝试次数过多, 请重新获取' }; }
  rec.attempts += 1;
  if (String(code ?? '').trim() !== rec.code) return { ok: false, reason: '验证码不正确' };
  pending.delete(norm);
  return { ok: true };
}
