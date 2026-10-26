import 'dotenv/config';

const env = (key, fallback = '') => process.env[key] ?? fallback;

export const config = {
  port: Number(env('PORT', 8787)),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
  upstream: {
    baseUrl: env('UPSTREAM_BASE_URL', 'https://121481.token6688.com').replace(/\/+$/, ''),
    apiKey: env('UPSTREAM_API_KEY', ''),
  },
  models: {
    imagePrimary: env('MODEL_IMAGE_PRIMARY', 'gpt-image-2.5-flare'),
    imageSecondary: env('MODEL_IMAGE_SECONDARY', 'gpt-image-2.5-sunburst'),
    video: env('MODEL_VIDEO', 'veo-4-omni'),
    text: env('MODEL_TEXT', 'glm-5.3-flash'),
  },
};

/** 未配置上游密钥时进入 MOCK 演示模式：生成/优化接口走本地模拟，不请求上游、不产生费用 */
export const isMockMode = () => !config.upstream.apiKey;
