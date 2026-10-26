/**
 * 系统内置模特（全局共享）
 * 图片为「三视图合成图」：左侧全身正面 + 右上面部特写 + 右下背面
 * 图片存放在 frontend/public/models/system/，由 Vercel 静态托管
 */

const img = (n) => `/models/system/${n}.jpg`;

export const systemModels = [
  {
    id: 'sys-f-01', name: '女模 01 · 红发酷女孩', scope: 'system', userId: null,
    cover: img('Female-(1)'), views: { front: img('Female-(1)'), side: null, back: img('Female-(1)') },
    desc: '20岁左右红发女性, 冷白皮, 身形苗条, 穿白色短T+黑色牛仔裤+马丁靴, 潮牌街头气质',
    tags: ['female', 'european', 'slim', 'street'],
  },
  {
    id: 'sys-f-02', name: '女模 02 · 温柔长发', scope: 'system', userId: null,
    cover: img('Female-(2)'), views: { front: img('Female-(2)'), side: null, back: img('Female-(2)') },
    desc: '20岁左右亚裔女性, 柔和五官, 长直发, 身形纤细, 温柔自然气质',
    tags: ['female', 'asian', 'slim', 'soft'],
  },
  {
    id: 'sys-f-03', name: '女模 03 · 阳光活力', scope: 'system', userId: null,
    cover: img('Female-(3)'), views: { front: img('Female-(3)'), side: null, back: img('Female-(3)') },
    desc: '20岁左右欧美女性, 浅棕发, 自信微笑, 身形匀称, 活力运动气质',
    tags: ['female', 'european', 'athletic', 'bright'],
  },
  {
    id: 'sys-f-04', name: '女模 04 · 知性短发', scope: 'system', userId: null,
    cover: img('Female-(4)'), views: { front: img('Female-(4)'), side: null, back: img('Female-(4)') },
    desc: '20岁左右女性, 利落短发, 五官立体, 身形高挑, 知性高级气质',
    tags: ['female', 'european', 'tall', 'chic'],
  },
  {
    id: 'sys-f-05', name: '女模 05 · 甜美邻家', scope: 'system', userId: null,
    cover: img('Female-(5)'), views: { front: img('Female-(5)'), side: null, back: img('Female-(5)') },
    desc: '20岁左右亚裔女性, 黑色中长发, 甜美亲和, 身形娇小, 日常休闲气质',
    tags: ['female', 'asian', 'petite', 'sweet'],
  },
  {
    id: 'sys-m-01', name: '男模 01 · 阳光少年', scope: 'system', userId: null,
    cover: img('Male-(1)'), views: { front: img('Male-(1)'), side: null, back: img('Male-(1)') },
    desc: '20岁左右欧美白皮男性, 姜红色卷发, 雀斑, 苗条高挑, 白色T恤+浅色牛仔裤, 青春街头气质',
    tags: ['male', 'european', 'slim', 'youthful'],
  },
  {
    id: 'sys-m-02', name: '男模 02 · 硬朗潮男', scope: 'system', userId: null,
    cover: img('Male-(2)'), views: { front: img('Male-(2)'), side: null, back: img('Male-(2)') },
    desc: '20-25岁男性, 短发轮廓分明, 身形健硕, 潮牌工装风, 街头气质',
    tags: ['male', 'european', 'athletic', 'street'],
  },
  {
    id: 'sys-m-03', name: '男模 03 · 日系清新', scope: 'system', userId: null,
    cover: img('Male-(3)'), views: { front: img('Male-(3)'), side: null, back: img('Male-(3)') },
    desc: '20岁左右亚裔男性, 黑色短发, 干净清爽, 身形匀称, 日系休闲气质',
    tags: ['male', 'asian', 'slim', 'clean'],
  },
  {
    id: 'sys-m-04', name: '男模 04 · 成熟稳重', scope: 'system', userId: null,
    cover: img('Male-(4)'), views: { front: img('Male-(4)'), side: null, back: img('Male-(4)') },
    desc: '25-30岁男性, 深色短发, 五官成熟, 身形挺拔, 简约商务休闲气质',
    tags: ['male', 'european', 'tall', 'mature'],
  },
  {
    id: 'sys-m-05', name: '男模 05 · 运动机能', scope: 'system', userId: null,
    cover: img('Male-(5)'), views: { front: img('Male-(5)'), side: null, back: img('Male-(5)') },
    desc: '20-25岁男性, 短发精干, 身形健美, 运动机能风, 活力充沛',
    tags: ['male', 'european', 'athletic', 'sporty'],
  },
  {
    id: 'sys-m-06', name: '男模 06 · 文艺复古', scope: 'system', userId: null,
    cover: img('Male-(6)'), views: { front: img('Male-(6)'), side: null, back: img('Male-(6)') },
    desc: '20岁左右男性, 中长发或卷发, 文艺气质, 身形偏瘦, 复古休闲风',
    tags: ['male', 'european', 'slim', 'retro'],
  },
];

export function getSystemModel(id) {
  return systemModels.find((m) => m.id === id) ?? null;
}
