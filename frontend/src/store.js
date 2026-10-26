/** 轻量前端状态 (localStorage 持久化): 额度钱包 / 引导完成标记 / 用户资料 */

const WALLET_KEY = 'bs-wallet';
const TOUR_KEY = 'bs-tour-done-v1';
const PROFILE_KEY = 'bs-profile';
const FREE_CREDITS = 100;

export function getCredits() {
  const raw = localStorage.getItem(WALLET_KEY);
  if (raw == null) return FREE_CREDITS;
  const v = Number(raw);
  return Number.isFinite(v) ? v : FREE_CREDITS;
}

export function spendCredits(n) {
  const next = Math.max(0, getCredits() - n);
  localStorage.setItem(WALLET_KEY, String(next));
  window.dispatchEvent(new CustomEvent('bs:credits'));
  return next;
}

export function refundCredits(n) {
  const next = getCredits() + n;
  localStorage.setItem(WALLET_KEY, String(next));
  window.dispatchEvent(new CustomEvent('bs:credits'));
  return next;
}

/** 充值: 增加额度 */
export function addCredits(n) {
  const next = getCredits() + Math.max(0, Number(n) || 0);
  localStorage.setItem(WALLET_KEY, String(next));
  window.dispatchEvent(new CustomEvent('bs:credits'));
  return next;
}

/* ---------- 用户资料 (设置页) ---------- */
const DEFAULT_PROFILE = {
  nickname: '电商创作者',
  brand: '',
  aspectRatio: '1:1',
  resolution: '2K',
  videoDuration: 6,
  autoSave: true,
};

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const v = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...(v && typeof v === 'object' ? v : {}) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function setProfile(patch) {
  const next = { ...getProfile(), ...(patch || {}) };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bs:profile'));
  return next;
}

/** 重置本地演示数据 (额度 / 资料), 作品数据保留在后端 */
export function resetLocalData() {
  localStorage.removeItem(WALLET_KEY);
  localStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new CustomEvent('bs:credits'));
  window.dispatchEvent(new CustomEvent('bs:profile'));
}

export const isTourDone = () => localStorage.getItem(TOUR_KEY) === '1';
export const markTourDone = () => localStorage.setItem(TOUR_KEY, '1');
