import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { api } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Express 应用装配 (与运行形态解耦)
 * - 本地: backend/src/index.js → app.listen(8787)
 * - Vercel Serverless: api/[...path].js → export default app (不 listen)
 */
export function createApp() {
  const app = express();

  // ---- CORS: 同域部署 (Vercel) 无需跨域; 独立部署时用 CORS_ORIGIN 指定 ----
  const allowList = [
    config.corsOrigin,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://localhost:8787',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ].filter(Boolean);
  const allowAll = !config.corsOrigin || config.corsOrigin === '*';
  app.use(cors({ origin: allowAll ? true : allowList }));

  app.use(express.json({ limit: '2mb' }));

  app.get('/', (req, res) => {
    res.json({ name: '996 Studio API', version: '0.1.5', docs: '/api/health' });
  });
  app.use('/api', api);

  // MOCK 占位素材 (本地开发用; 生产环境由前端 public/mock-assets 静态托管)
  const assetsDir = path.join(__dirname, 'mock-assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/mock-assets', express.static(assetsDir, { maxAge: 0 }));
  }

  // 统一错误处理
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status ?? 500;
    if (status >= 500) console.error('[api-error]', err);
    res.status(status).json({
      error: {
        code: err.code ?? 'internal_error',
        message: status >= 500 ? '服务内部错误, 请稍后重试' : err.message,
      },
    });
  });

  return app;
}

export const app = createApp();
export default app;
