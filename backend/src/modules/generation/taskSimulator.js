import crypto from 'node:crypto';

/**
 * MOCK 任务模拟器: 未配置上游密钥时模拟异步任务生命周期
 * pending (0-2s) → processing (2-8s, 带进度) → completed (占位素材)
 * 零费用, 用于界面流程演示与自动化验收。
 */
const MOCK_DURATION_MS = 9_000;

export function createMockTask({ type, title }) {
  return {
    task_id: `mock-${type}-${crypto.randomUUID().slice(0, 8)}`,
    status: 'pending',
    is_final: false,
    type,
    title,
    created_at: Date.now(),
  };
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
