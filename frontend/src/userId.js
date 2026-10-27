/**
 * 用户 ID (localStorage 隔离, 无登录体系)
 * 单独成文件, 避免 views/models.js ↔ views/modelAddDialog.js 循环依赖
 */
export function getUserId() {
  try {
    let id = localStorage.getItem('bs-user-id');
    if (!id) {
      id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('bs-user-id', id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}
