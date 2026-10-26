/**
 * 部署期后端配置 (可在 Vercel 部署后直接编辑本文件, 无需重新构建)
 *
 * apiBase: 后端 API 根地址
 *   - 留空 ''  → 与前端同域的 /api (推荐: Vercel 一体化部署)
 *   - 填绝对地址 → 例如 'https://my-backend.onrender.com'
 *                  (前端与后端分开部署时使用, 后端需放行 CORS)
 */
window.__APP_CONFIG__ = {
  apiBase: '',
};
