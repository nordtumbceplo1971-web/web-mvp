/**
 * 批量套图 · 任务执行器 (自包含内存队列)
 *
 * - 行 × 镜头展开为格 (Cell), 依赖就绪即可被 Worker 领取 (自然形成波次, 无需显式排波)
 * - 全局并发上限 4, 指数退避重试 ≤3 次
 * - 幂等: 已成功/已锁定的格在「全量/试跑」时直接复用, 不重复调用上游
 * - 断点续跑: 进程重启后 queued/running 的格自动重新入队
 * - MOCK 模式: 本地模拟出图 (~3 秒/格, 复用 /mock-assets 占位图), 零费用
 */
import { createHash } from 'node:crypto';
import { config, isMockMode } from '../../config.js';
import { modelRuntimeInvoke, getTask } from '../../upstream/client.js';
import { composeStepPrompt, assetsForCell, checkDeps, stepById, cellFileName, PER_CELL_CREDITS } from './recipe.js';
import { saveProject, getProject, allProjects } from './store.js';

const MAX_CONCURRENT = 4;
const MAX_ATTEMPTS = 3;
const POLL_INTERVAL = 4000;
const POLL_MAX = 60; // 单格最长等 ~4 分钟

/** 内存态: 待跑格队列 + 正在执行数 (进程内, 重启即重建) */
const queue = []; // { projectId, rowId, stepId }
let executing = 0;
let pumping = false;

const key = (rowId, stepId) => `${rowId}|${stepId}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 幂等键: 同一行同一镜头, 提示词/参数一致即视为同一任务 */
function idempotencyKey(row, stepId, prompt) {
  return createHash('sha1')
    .update(`${row.sku}|${stepId}|${prompt}|4:5|2K|v1`)
    .digest('hex');
}

/**
 * 入队一批格。已有产出的格默认幂等复用 (跳过), 锁定格任何时候都不重跑。
 * @param {'pilot'|'full'|'cell'} kind
 */
export function enqueue(project, { kind = 'full', rowIds = [], cell = null, force = false } = {}) {
  const picked = project.rows.filter((r) => (rowIds.length ? rowIds.includes(r.id) : true));
  let queuedCount = 0;
  let reusedCount = 0;

  const plan = [];
  if (kind === 'cell' && cell) {
    plan.push(cell);
  } else {
    for (const row of picked) {
      for (let n = 1; n <= 7; n += 1) plan.push({ rowId: row.id, stepId: String(n).padStart(2, '0') });
    }
  }

  for (const { rowId, stepId } of plan) {
    const row = project.rows.find((r) => r.id === rowId);
    const c = project.cells[key(rowId, stepId)];
    if (!row || !c) continue;
    if (c.locked || (c.url && !force)) { reusedCount += 1; continue; }
    c.status = 'queued';
    c.error = null;
    c.updatedAt = Date.now();
    if (!queue.some((q) => q.projectId === project.id && q.rowId === rowId && q.stepId === stepId)) {
      queue.push({ projectId: project.id, rowId, stepId });
      queuedCount += 1;
    }
  }

  project.status = kind === 'pilot' ? 'pilot' : 'running';
  saveProject(project);
  pump();
  return { queued: queuedCount, reused: reusedCount };
}

/** 单格重跑 (尊重锁定) */
export function rerunCell(project, rowId, stepId) {
  const c = project.cells[key(rowId, stepId)];
  if (!c) return { error: '格子不存在' };
  if (c.locked) return { error: '该格已锁定, 请先解锁再重跑' };
  return enqueue(project, { kind: 'cell', cell: { rowId, stepId }, force: true });
}

export function setCellLock(project, rowId, stepId, locked) {
  const c = project.cells[key(rowId, stepId)];
  if (!c) return { error: '格子不存在' };
  if (!c.url) return { error: '该格还没有产出, 无法锁定' };
  c.locked = !!locked;
  c.updatedAt = Date.now();
  saveProject(project);
  return { ok: true, locked: c.locked };
}

/** 从队列取第一个依赖就绪的格 (就绪 = 前置格已有产出) */
function takeNextReady() {
  for (let i = 0; i < queue.length; i += 1) {
    const job = queue[i];
    const project = getProject(job.projectId);
    if (!project) { queue.splice(i, 1); i -= 1; continue; }
    const row = project.rows.find((r) => r.id === job.rowId);
    if (!row) { queue.splice(i, 1); i -= 1; continue; }
    if (!checkDeps(project, row, job.stepId)) return queue.splice(i, 1)[0];
  }
  return null;
}

function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (executing < MAX_CONCURRENT) {
      const job = takeNextReady();
      if (!job) break;
      executing += 1;
      runCell(job).catch((e) => {
        console.error('[batch-runner] cell error:', e?.message || e);
      }).finally(() => {
        executing -= 1;
        setTimeout(pump, 50);
      });
    }
  } finally {
    pumping = false;
  }
}

async function runCell({ projectId, rowId, stepId }) {
  const project = getProject(projectId);
  if (!project) return;
  const row = project.rows.find((r) => r.id === rowId);
  const stepDef = stepById(stepId);
  const cell = project.cells[key(rowId, stepId)];
  if (!row || !stepDef || !cell) return;

  const prompt = composeStepPrompt(row, stepId);
  cell.idempotencyKey = idempotencyKey(row, stepId, prompt);
  cell.status = 'running';
  cell.attempts += 1;
  cell.updatedAt = Date.now();
  saveProject(project);

  try {
    const images = assetsForCell(project, row, stepId);
    let url = null;

    if (isMockMode()) {
      await sleep(2500 + Math.random() * 1500);
      url = `/mock-assets/image-${1 + Math.floor(Math.random() * 4)}.svg`;
    } else {
      url = await invokeUpstream({ prompt, images, stepDef });
    }

    if (!url) throw new Error('上游未返回图片 url');
    cell.qa = await qaCheck(url, stepDef);
    if (cell.qa?.fail) {
      cell.status = 'rejected_by_qa';
      cell.error = cell.qa.reason;
      scheduleRetry(project, rowId, stepId, cell);
    } else {
      cell.url = url;
      cell.status = 'success';
      cell.width = cell.qa?.width || 0;
      cell.height = cell.qa?.height || 0;
      cell.fileName = cellFileName(row, stepDef, cell.width, cell.height);
      project.budget.spent += PER_CELL_CREDITS;
    }
  } catch (e) {
    cell.status = 'failed';
    cell.error = e?.message || '生成失败';
    scheduleRetry(project, rowId, stepId, cell);
  }
  cell.updatedAt = Date.now();
  saveProject(project);
  refreshProjectStatus(project);
  pump();
}

function scheduleRetry(project, rowId, stepId, cell) {
  project.budget.failed += 1;
  if (cell.attempts < MAX_ATTEMPTS) {
    setTimeout(() => {
      const p = getProject(project.id);
      if (!p) return;
      const c = p.cells[key(rowId, stepId)];
      if (!c || c.locked || c.status === 'success') return;
      c.status = 'queued';
      c.updatedAt = Date.now();
      saveProject(p);
      queue.push({ projectId: p.id, rowId, stepId });
      pump();
    }, 2000 * cell.attempts);
  }
}

/** 调上游 model-runtime (与 service.js generateImage 同通道, 只 import 不改) */
async function invokeUpstream({ prompt, images, stepDef }) {
  const params = {
    prompt,
    aspect_ratio: stepDef.aspectRatio,
    resolution: stepDef.resolution,
    quality: stepDef.quality,
    count: 1,
    mode: images.length > 1 ? 'multi-reference' : (images.length === 1 ? 'image-edit' : 'text-to-image'),
  };
  const payload = {
    model_id: config.models.imagePrimary,
    modality: 'image',
    operation: images.length ? 'edit' : 'generate',
    params,
  };
  if (images.length) payload.attachments = images;
  const res = await modelRuntimeInvoke(payload);
  const taskId = res?.task_id;
  if (!taskId) throw new Error('上游未返回 task_id');

  for (let i = 0; i < POLL_MAX; i += 1) {
    await sleep(POLL_INTERVAL);
    const task = await getTask(taskId);
    if (task?.is_final) {
      if (task.status === 'completed' || task.success) {
        const urls = Array.isArray(task.data) ? task.data.map((d) => d.url).filter(Boolean) : [];
        return urls[0] ?? null;
      }
      throw new Error(task?.error?.message || task?.error || '上游任务失败');
    }
  }
  throw new Error('上游任务超时');
}

/**
 * L1 质检 (零依赖): 拉取图片头部字节解析宽高, 长边低于质检线判不合格。
 * 解析失败视为通过 (记录 unchecked), 不误杀。
 */
async function qaCheck(url, stepDef) {
  if (url.startsWith('/mock-assets/') || url.startsWith('mock://')) {
    return { checked: false, width: 1024, height: 1280, note: 'mock' };
  }
  try {
    const dims = await fetchImageDims(url);
    if (!dims) return { checked: false };
    const longEdge = Math.max(dims.width, dims.height);
    const fail = longEdge < stepDef.minLongEdge;
    return {
      checked: true,
      width: dims.width,
      height: dims.height,
      fail,
      ...(fail ? { reason: `分辨率 ${dims.width}x${dims.height} 低于质检线 (长边 ≥ ${stepDef.minLongEdge})` } : {}),
    };
  } catch {
    return { checked: false };
  }
}

/** 只取头部字节解析 JPEG SOF / PNG IHDR 宽高 */
async function fetchImageDims(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-131071' }, signal: controller.signal });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG: 扫 SOF0-SOF15 段
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off += 1; continue; }
        const marker = buf[off + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
        }
        const len = buf.readUInt16BE(off + 2);
        off += 2 + len;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 项目状态收敛: 队列与执行都不再有该项目的格 → running 收敛为 done */
function refreshProjectStatus(project) {
  const cells = Object.values(project.cells);
  const busy = cells.some((c) => c.status === 'queued' || c.status === 'running');
  const pendingRetry = queue.some((q) => q.projectId === project.id);
  if (!busy && !pendingRetry && project.status === 'running') {
    project.status = 'done';
    saveProject(project);
  }
}

/** 断点续跑: 进程重启后, 把所有 queued/running 的格重新入队 */
export function recoverOnBoot() {
  let recovered = 0;
  for (const p of allProjects()) {
    const stale = Object.values(p.cells ?? {}).filter((c) => c.status === 'queued' || c.status === 'running');
    if (!stale.length) continue;
    for (const c of stale) {
      c.status = 'queued';
      queue.push({ projectId: p.id, rowId: c.rowId, stepId: c.stepId });
      recovered += 1;
    }
    if (p.status !== 'pilot') p.status = 'running';
    saveProject(p);
  }
  if (recovered) {
    console.log(`[batch-runner] 断点续跑: ${recovered} 个格子重新入队`);
    pump();
  }
}

/** 试跑: 只跑指定一行 (幂等复用该行已有产出) */
export function enqueuePilot(project, rowId) {
  return enqueue(project, { kind: 'pilot', rowIds: [rowId] });
}

/** 全量: 所有行 (已成功/锁定的格自动复用) */
export function enqueueFull(project) {
  return enqueue(project, { kind: 'full' });
}

/** 重跑某行整行 7 格 (强制, 锁定格除外) */
export function rerunRow(project, rowId) {
  return enqueue(project, { kind: 'full', rowIds: [rowId], force: true });
}
