import 'dotenv/config';

const env = (key, fallback = '') => process.env[key] ?? fallback;

export const config = {
  port: Number(env('PORT', 8787)),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
  // 单一访问码登录: 留空 = 鉴权关闭 (本地开发 / MOCK); 配置后 /api 全部要求 Bearer token
  accessCode: env('ACCESS_CODE', ''),
  // 邮箱账号体系 (SMTP 发信通道, 网易企业邮): 未配 SMTP 时验证码仅打印日志
  smtp: {
    host: env('SMTP_HOST', ''),
    port: env('SMTP_PORT', '465'),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    from: env('SMTP_FROM', ''),
    // 注册邮箱白名单域名 (逗号分隔); 空 = 不限, 不推荐公网站点放开
    registerDomain: env('REGISTER_DOMAIN', ''),
    // SMTP 未配置时把验证码回显给前端 (仅本地调试用; 生产务必留空)
    devEcho: env('SMTP_DEV_ECHO', '') === '1',
  },
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
