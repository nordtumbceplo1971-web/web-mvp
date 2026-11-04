/**
 * 登录态 (单一访问码 · token 存 localStorage)
 *
 * - 后端配置 ACCESS_CODE 后, /api 全部要求 Bearer token
 * - token 由 /api/auth/login 签发 (30 天有效), 存 localStorage 跨会话
 * - 401 → 清 token 并派发 bs:unauthorized 事件 (main.js 捕获后跳登录页)
 */

const KEY = 'bs-auth-token';

export function getToken() {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function setToken(token) {
  try { localStorage.setItem(KEY, token); } catch { /* ignore */ }
}

export function clearToken() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function isAuthed() {
  return Boolean(getToken());
}

/** api 层收到 401 时调用: 清登录态并通知外壳跳登录页 */
export function handleUnauthorized() {
  clearToken();
  try { window.dispatchEvent(new CustomEvent('bs:unauthorized')); } catch { /* ignore */ }
}
