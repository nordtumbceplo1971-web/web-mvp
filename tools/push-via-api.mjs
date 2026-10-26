/**
 * 通过 GitHub REST API 推送提交 (代理拦截 github.com 主站时的兜底通道)
 * 精确复刻本地 commit 的 tree/author/committer/时间戳 → 生成的 SHA 与本地一致
 * 用法: node tools/push-via-api.mjs
 */
import { execSync, execFileSync } from 'node:child_process';

const REPO = 'nordtumbceplo1971-web/web-mvp';
const API = `https://api.github.com/repos/${REPO}`;
const git = (cmd) => execSync(`git ${cmd}`, { cwd: 'D:/ai-server-mvp', encoding: 'utf8' }).trim();

// ---- 凭证: 从 git credential helper 取 ----
const cred = execSync('git credential fill', {
  cwd: 'D:/ai-server-mvp',
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
});
const token = cred.split('\n').find((l) => l.startsWith('password='))?.slice(9).trim();
if (!token) throw new Error('未找到 GitHub 凭证');

const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': '996-studio-push',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* 非 JSON */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return data;
};

// ---- 本地提交元信息 ----
const localSha = git('rev-parse HEAD');
const parent = git('rev-parse HEAD~1');
const localTree = git('rev-parse HEAD:');
const author = { name: git('log -1 --format=%an'), email: git('log -1 --format=%ae'), date: git('log -1 --format=%aI').replace(/([+-]\d\d):(\d\d)$/, '$1$2') };
const committer = { name: git('log -1 --format=%cn'), email: git('log -1 --format=%ce'), date: git('log -1 --format=%cI').replace(/([+-]\d\d):(\d\d)$/, '$1$2') };
const message = execSync('git log -1 --format=%B', { cwd: 'D:/ai-server-mvp', encoding: 'utf8' });

// ---- 远程当前状态 ----
const ref = await call('GET', `/git/ref/heads/main`);
console.log(`远程 main 当前为 ${ref.object.sha.slice(0, 7)}（本地父提交 ${parent.slice(0, 7)}）`);

// ---- 变更文件 → blob (直接取 git 对象里的原始内容, 保证 blob/tree/commit SHA 与本地一致) ----
const files = git('diff --name-only HEAD~1 HEAD').split('\n').filter(Boolean);
const treeEntries = [];
for (const path of files) {
  const mode = git(`ls-tree HEAD -- "${path}"`).split(/\s+/)[0];
  const localBlob = git(`rev-parse "HEAD:${path}"`);
  // 从 git 对象库读原始字节 (避免工作区的 CRLF/LF 差异)
  const buf = execFileSync('git', ['cat-file', 'blob', `HEAD:${path}`], { cwd: 'D:/ai-server-mvp' });
  const blob = await call('POST', '/git/blobs', {
    content: buf.toString('base64'),
    encoding: 'base64',
  });
  const ok = blob.sha === localBlob;
  if (!ok) throw new Error(`blob 不一致: ${path} 本地 ${localBlob.slice(0, 7)} / API ${blob.sha.slice(0, 7)}`);
  treeEntries.push({ path, mode, type: 'blob', sha: blob.sha });
}
console.log(`✓ ${treeEntries.length} 个 blob 与本地逐一校验一致`);

// ---- tree → commit → ref ----
const baseTree = await call('GET', `/git/commits/${parent}`);
const tree = await call('POST', '/git/trees', {
  base_tree: baseTree.tree.sha,
  tree: treeEntries,
});
console.log(`tree: 本地 ${localTree.slice(0, 7)} / API ${tree.sha.slice(0, 7)} ${tree.sha === localTree ? '✓ 一致' : '⚠ 不一致'}`);

const commit = await call('POST', '/git/commits', {
  message,
  tree: tree.sha,
  parents: [parent],
  author,
  committer,
});
console.log(`commit: 本地 ${localSha.slice(0, 7)} / API ${commit.sha.slice(0, 7)} ${commit.sha === localSha ? '✓ 一致' : '⚠ 不一致'}`);

await call('PATCH', '/git/refs/heads/main', { sha: commit.sha, force: true });
console.log(`✓ 已推送 main → ${commit.sha.slice(0, 7)}`);
