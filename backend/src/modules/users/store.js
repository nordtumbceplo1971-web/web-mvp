/**
 * 用户账号存储 (单一访问码之外的正式账号体系)
 *
 * 存储: 三级降级 (同 works/store.js) — USERS_DATA_DIR → 共用 data 目录 → /tmp → 内存
 * 文件: users.json
 *   [{ id, email, passHash, salt, createdAt, verifiedAt }]
 * 密码: scrypt (node:crypto 内置, 无原生依赖)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDataDir() {
  const candidates = [
    process.env.USERS_DATA_DIR,
    process.env.WORKS_DATA_DIR,
    path.join(__dirname, '..', '..', '..', 'data'),
    path.join('/tmp', '996-studio-data'),
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch { /* 试下一个 */ }
  }
  return null;
}

const DATA_DIR = resolveDataDir();
const FILE = DATA_DIR ? path.join(DATA_DIR, 'users.json') : null;
let memoryOnly = !DATA_DIR;
let memoryUsers = [];

const readAll = () => {
  if (memoryOnly) return memoryUsers;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeAll = (users) => {
  if (memoryOnly) { memoryUsers = users; return; }
  try {
    fs.writeFileSync(FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.warn('[users] 磁盘写入失败, 降级内存:', err.message);
    memoryOnly = true;
    memoryUsers = users;
  }
};

export function findUserByEmail(email) {
  const norm = String(email ?? '').trim().toLowerCase();
  return readAll().find((u) => u.email === norm) ?? null;
}

export function createUser(email, password) {
  if (findUserByEmail(email)) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const passHash = crypto.scryptSync(password, salt, 32).toString('hex');
  const user = {
    id: `u-${crypto.randomUUID().slice(0, 12)}`,
    email: String(email).trim().toLowerCase(),
    passHash, salt,
    createdAt: Date.now(),
    verifiedAt: Date.now(),
  };
  const users = readAll();
  users.push(user);
  writeAll(users);
  return { id: user.id, email: user.email };
}

export function verifyPassword(user, password) {
  const hash = crypto.scryptSync(password, user.salt, 32).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(user.passHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function userCount() {
  return readAll().length;
}

/**
 * 内置种子账号 (SEED_USERS env: "user1:pass1,user2:pass2")
 * 启动时调用; 已存在 (按用户名) 则跳过, 幂等。密码仅存 scrypt 哈希, env 不进 git。
 */
export function ensureSeedUsers(seedSpec) {
  const pairs = String(seedSpec ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const idx = s.indexOf(':');
      if (idx <= 0) return null;
      return { name: s.slice(0, idx).trim().toLowerCase(), pass: s.slice(idx + 1) };
    })
    .filter(Boolean);
  for (const { name, pass } of pairs) {
    if (findUserByEmail(name)) continue;
    const created = createUser(name, pass);
    if (created) console.log(`[users] seed 账号已创建: ${name}`);
  }
}
