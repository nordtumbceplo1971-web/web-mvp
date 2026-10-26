import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isMockMode } from './config.js';
import { api } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: [config.corsOrigin, 'http://127.0.0.1:5173', 'http://localhost:5173'] }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({ name: 'BrandStudio API', version: '0.1.0', docs: '/api/health' });
});
app.use('/api', api);

// MOCK 占位素材 (诚实占位: 明确标注「示意」, 不冒充真实生成结果)
app.use('/mock-assets', express.static(path.join(__dirname, 'mock-assets'), { maxAge: 0 }));

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

app.listen(config.port, () => {
  const mode = isMockMode() ? 'MOCK 演示模式(未配置上游密钥, 不产生费用)' : 'LIVE 模式(真实调用上游)';
  console.log(`[BrandStudio API] http://localhost:${config.port} · ${mode}`);
  console.log(`  图片模型: ${config.models.imagePrimary} / ${config.models.imageSecondary}`);
  console.log(`  视频模型: ${config.models.video} · 文本模型: ${config.models.text}`);
});
