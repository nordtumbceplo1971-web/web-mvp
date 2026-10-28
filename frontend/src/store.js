/** 轻量前端状态 (localStorage 持久化): 额度钱包 / 额度账本 / 会员分层 / 引导完成标记 / 用户资料 */

const WALLET_KEY = 'bs-wallet';
const LEDGER_KEY = 'bs-ledger';
const MEMBER_KEY = 'bs-membership';
const TOUR_KEY = 'bs-tour-done-v1';
const PROFILE_KEY = 'bs-profile';
const FREE_CREDITS = 100;
const LEDGER_MAX = 200;

export function getCredits() {
  const raw = localStorage.getItem(WALLET_KEY);
  if (raw == null) return FREE_CREDITS;
  const v = Number(raw);
  return Number.isFinite(v) ? v : FREE_CREDITS;
}

/* ---------- 额度账本 (1.1.3 消耗明细): 每笔变动记 时间/事由/模型/变动后余额 ---------- */
function pushLedger(kind, n, meta = {}) {
  try {
    const list = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
    list.unshift({
      t: Date.now(), kind, n,
      balance: getCredits(),
      label: meta.label || (kind === 'recharge' ? '充值' : kind === 'refund' ? '失败退回' : '生成消耗'),
      model: meta.model || null,
    });
    localStorage.setItem(LEDGER_KEY, JSON.stringify(list.slice(0, LEDGER_MAX)));
  } catch { /* 账本写入失败不阻塞扣费主流程 */ }
}

export function getLedger() {
  try {
    const list = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function clearLedger() {
  localStorage.removeItem(LEDGER_KEY);
  window.dispatchEvent(new CustomEvent('bs:ledger'));
}

export function spendCredits(n, meta) {
  const next = Math.max(0, getCredits() - n);
  localStorage.setItem(WALLET_KEY, String(next));
  pushLedger('spend', -n, meta);
  window.dispatchEvent(new CustomEvent('bs:credits'));
  return next;
}

export function refundCredits(n, meta) {
  const next = getCredits() + n;
  localStorage.setItem(WALLET_KEY, String(next));
  pushLedger('refund', n, meta);
  window.dispatchEvent(new CustomEvent('bs:credits'));
  return next;
}

/** 充值: 增加额度 */
export function addCredits(n, meta) {
  const add = Math.max(0, Number(n) || 0);
  const next = getCredits() + add;
  localStorage.setItem(WALLET_KEY, String(next));
  pushLedger('recharge', add, meta);
  window.dispatchEvent(new CustomEvent('bs:credits'));
  return next;
}

/* ---------- 会员分层 (1.1.4): free / standard / pro (演示环境, 权益暂不接入生成链路) ---------- */
export function getMembership() {
  const v = localStorage.getItem(MEMBER_KEY);
  return v === 'standard' || v === 'pro' ? v : 'free';
}

export function setMembership(tier) {
  localStorage.setItem(MEMBER_KEY, tier === 'standard' || tier === 'pro' ? tier : 'free');
  window.dispatchEvent(new CustomEvent('bs:membership'));
  return getMembership();
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

/** 重置本地演示数据 (额度 / 账本 / 会员 / 资料), 作品数据保留在后端 */
export function resetLocalData() {
  localStorage.removeItem(WALLET_KEY);
  localStorage.removeItem(LEDGER_KEY);
  localStorage.removeItem(MEMBER_KEY);
  localStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new CustomEvent('bs:credits'));
  window.dispatchEvent(new CustomEvent('bs:profile'));
}

export const isTourDone = () => localStorage.getItem(TOUR_KEY) === '1';
export const markTourDone = () => localStorage.setItem(TOUR_KEY, '1');
