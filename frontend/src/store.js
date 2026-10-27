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
  aspectRatio: '',        // 空 = 跟随模板自带比例; 非空 = 用户指定的图片默认比例
  resolution: '2K',
  videoDuration: 6,
  autoSave: true,
};

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const v = JSON.parse(raw);
    const merged = { ...DEFAULT_PROFILE, ...(v && typeof v === 'object' ? v : {}) };
    // aspectRatio 早期是「死设置」(只存不生效), 旧存档里的值不视为用户显式指定,
    // 否则升级后所有历史用户会被突然按 1:1 出图。显式指定以 aspectRatioSet 为准。
    if (!merged.aspectRatioSet) merged.aspectRatio = '';
    return merged;
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
