import crypto from 'node:crypto';

/**
 * MOCK 任务模拟器: 未配置上游密钥时模拟异步任务生命周期
 * pending (0-2s) → processing (2-8s, 带进度) → completed (占位素材)
 * 零费用, 用于界面流程演示与自动化验收。
 *
 * 【Serverless 适配】任务状态完全由 taskId 自描述 (类型/张数/创建时间),
 * 不依赖内存或磁盘 —— 轮询请求即使落到另一个函数实例也能正确推进进度。
 */
const MOCK_DURATION_MS = 9_000;

/** taskId 格式: mock-{type}-{count}-{createdAt36}-{uuid8} */
export function createMockTask({ type, title, count = 1 }) {
  return {
    task_id: `mock-${type}-${count}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    status: 'pending',
    is_final: false,
    type,
    title,
    created_at: Date.now(),
  };
}

/**
 * 从 taskId 还原任务元信息 (无状态)
 * @returns {{type:string, count:number, createdAt:number}|null}
 */
export function parseMockTaskId(taskId) {
  if (typeof taskId !== 'string') return null;
  const m = /^mock-([a-z]+)-(\d+)-([a-z0-9]+)-/.exec(taskId);
  if (!m) return null;
  const createdAt = Number.parseInt(m[3], 36);
  if (!Number.isFinite(createdAt)) return null;
  return { type: m[1], count: Number(m[2]) || 1, createdAt };
}

export function getMockTask(task, baseUrl) {
  const elapsed = Date.now() - task.created_at;
  if (elapsed < MOCK_DURATION_MS * 0.25) {
    return { ...task, status: 'pending', is_final: false, progress: 0 };
  }
  if (elapsed < MOCK_DURATION_MS) {
    const progress = Math.min(95, Math.round((elapsed / MOCK_DURATION_MS) * 100));
    return { ...task, status: 'processing', is_final: false, progress, progress_available: true };
  }
  const n = task.type === 'image' ? (task.count ?? 1) : 1;
  const urls = Array.from({ length: n }, (_, i) => `${baseUrl}/mock-assets/${task.type}-${(i % 4) + 1}.svg`);
  return {
    ...task,
    status: 'completed',
    is_final: true,
    progress: 100,
    output_url: urls[0],
    data: urls.map((url) => ({ url, type: task.type })),
    duration_seconds: Math.round(MOCK_DURATION_MS / 1000),
  };
}

export function isMockTaskId(taskId) {
  return typeof taskId === 'string' && taskId.startsWith('mock-');
}
