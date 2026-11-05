import { api } from './api.js';

/**
 * 共享任务轮询调度器 (多任务异步场景的 GET 采集器)
 *
 * 为什么不用「每个任务一个 setInterval」:
 *   N 个任务 → N 个独立定时器, 同一秒内并发打出 N 个请求 (尖峰),
 *   容易撞上上游/网关限流; 任务数增加时请求数线性放大且不可控。
 *
 * 本调度器:
 *   - 全局单一时钟 (默认 5s): 每轮对所有活跃任务各查一次
 *   - 轮内错峰 (默认 150ms/任务): 把 N 个请求摊平到时间轴上, 不形成尖峰
 *   - 单任务失败只计该任务错误数, 不影响其它任务; 连续失败超限判定该任务失败
 *   - 终态任务自动摘除, 空集合时定时器休眠 (零请求)
 *
 * 频率依据 (996.chat 腾讯云 CVM: 2 vCPU / 3.5GB, 负载≈0, nginx 未设限流;
 *   上游手册: 轮询不计费、不占生成额度, 建议 5~10s 一次):
 *   图片 5s 足够 (上游出图 ~1 分钟), 视频同样 5s (任务本身要跑数分钟, 进度刷新意义不大)
 */

export const DEFAULT_POLL_INTERVAL_MS = 5000;
export const DEFAULT_STAGGER_MS = 150;

export function createPoller({ intervalMs = DEFAULT_POLL_INTERVAL_MS, staggerMs = DEFAULT_STAGGER_MS, maxErrors = 5 } = {}) {
  /** taskId -> { onUpdate, errors, lastStart } */
  const watchers = new Map();
  let timer = null;
  let running = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function tick() {
    if (running) return;
    running = true;
    try {
      // 快照: 本轮开始时的任务集合 (新增任务下一轮再查, 避免本轮尾部插入)
      const snapshot = [...watchers.entries()];
      let stagger = 0;
      for (const [taskId, w] of snapshot) {
        if (!watchers.has(taskId)) continue; // 已被移除
        if (stagger) await sleep(stagger);
        stagger = staggerMs;
        try {
          const task = await api.getTask(taskId);
          if (!watchers.has(taskId)) continue;
          w.errors = 0;
          const urls = Array.isArray(task?.data) ? task.data.map((d) => d.url).filter(Boolean) : [];
          const progress = Number(task?.progress ?? 0) || 0;
          w.onUpdate({
            taskId,
            status: task?.status ?? 'processing',
            isFinal: Boolean(task?.is_final),
            progress,
            stageIndex: Math.min(4, Math.floor(progress / 20)),
            urls,
            error: task?.error?.message || (task?.status === 'failed' ? '生成失败, 请重试' : null),
          });
          if (task?.is_final) watchers.delete(taskId);
        } catch (e) {
          if (!watchers.has(taskId)) continue;
          w.errors += 1;
          if (w.errors >= maxErrors) {
            watchers.delete(taskId);
            w.onUpdate({
              taskId, status: 'failed', isFinal: true, progress: 0, stageIndex: 0, urls: [],
              error: `无法获取任务状态: ${e?.message ?? '未知错误'}`,
            });
          }
        }
      }
    } finally {
      running = false;
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      await tick();
      if (watchers.size) schedule(); // 还有活跃任务 → 继续下一轮
      else running = false;
    }, intervalMs);
  }

  return {
    /**
     * 注册一个任务开始轮询
     * @returns {{ stop(): void }} 取消监听 (任务仍在服务端跑, 只是不再查)
     */
    add(taskId, onUpdate) {
      if (!taskId) return { stop() {} };
      watchers.set(taskId, { onUpdate, errors: 0 });
      // 首次查询立刻发起 (不等一个周期), 让用户马上看到进度
      void tick();
      schedule();
      return {
        stop() { watchers.delete(taskId); },
      };
    },
    /** 当前活跃任务数 (可观测) */
    size() { return watchers.size; },
    /** 停止整个调度器 */
    stopAll() { watchers.clear(); if (timer) { clearTimeout(timer); timer = null; } },
  };
}

/** 全局共享实例: 工作台队列 / 复刻弹窗 / 批量生成 共用同一个时钟 */
export const sharedPoller = createPoller();
