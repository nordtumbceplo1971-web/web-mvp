import { config, isMockMode } from './config.js';
import { app } from './app.js';

/**
 * 本地开发入口 (常驻进程)
 * 生产/Serverless 部署请使用 api/[...path].js (Vercel) 或自行托管 app
 */
app.listen(config.port, () => {
  const mode = isMockMode() ? 'MOCK 演示模式(未配置上游密钥, 不产生费用)' : 'LIVE 模式(真实调用上游)';
  console.log(`[BrandStudio API] http://localhost:${config.port} · ${mode}`);
  console.log(`  图片模型: ${config.models.imagePrimary} / ${config.models.imageSecondary}`);
  console.log(`  视频模型: ${config.models.video} · 文本模型: ${config.models.text}`);
});
