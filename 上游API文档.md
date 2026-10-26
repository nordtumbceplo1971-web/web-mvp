# 优创AIGC · 开放 API 文档

> 导出日期: 2026-10-26 · 共 126 个模型

- **Base URL**: `https://121481.token6688.com`
- **鉴权**: 请求头 `Authorization: Bearer sk-xxx` (在「管理密钥」页创建)

> **使用须知与免责声明**: 本 API 仅面向 优创AIGC 已注册用户开放, 用于在您自建的智能体 / 应用中调用本平台已接入的模型能力, 且仅限本人或本组织内部自用。禁止将 API 密钥或本平台接口转售、二次分发、封装后向不特定第三方提供服务, 或用于其他未经许可的外部接入; 禁止生成或传播违反法律法规的内容。经您的密钥发起的全部请求内容及生成结果由您自行负责; 平台对模型输出的准确性、完整性不作保证, 并有权在发现违规或异常调用时限流、停用密钥或终止服务。继续使用即视为已阅读并同意上述条款。

## 3 步接入 (GT 兼容, 换 base_url 即可)

1. 把你现有 GT 兼容 SDK 的 base_url 改成 https://api.tokengo.love/v1
1. 把 api_key 换成本平台创建的 sk- 密钥
1. model 字段填目标模型 ID (用 /v1/skills/models 查), 其余请求体保持 GT 兼容格式原样

```bash
curl https://121481.token6688.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -N \
  -d '{"model":"gt-5.6-sol","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

## 通用接口详情

### 对话

对话、看图、读文档。GT 兼容, 另有 Responses、Messages 两种原生协议。

#### 对话补全 (GT 兼容) — `POST /v1/chat/completions`

- 分组: 对话 · 需鉴权
- 所有语言模型的统一入口 (gpt / claude / gemini / qwen / doubao / deepseek / grok …)。请求体就是 GT Chat Completions, 换 model 字段即切换模型与厂商, 网关内部翻译到各家原生协议。stream:true 走 SSE; 视觉输入走 messages 里 content 数组的 image_url (公网 URL 或 data:image/…;base64,…), 纯文本模型带图会直接返回 400。⚠ 顶层 attachments 字段本端点不解析 (会被静默忽略) — 那是 /api/v1/model-runtime/invoke 的信封字段。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 模型 ID (GET /v1/skills/models?type=chat) |
| `messages` | body | array | 是 | GT 消息数组 (system / user / assistant) |
| `stream` | body | boolean | 否 | true = SSE 流式 (data: {...} 逐块, 末尾 data: [DONE]) |
| `temperature / max_tokens / tools …` | body | GT | 否 | 其余字段按 GT 原样透传, 各模型支持度见模型详情页 |
| `strategy` | body | string | 否 | 单次覆盖调度策略 (取值见概览「渠道与调度策略」), 写在请求体里 —— 本端点不读 X-Schedule-Strategy 请求头 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "gt-5.6-sol",
    "messages": [{ "role": "user", "content": "用一句话介绍你自己" }],
    "stream": true
  }'
```

响应示例:
```json
data: {"id":"chatcmpl-…","object":"chat.completion.chunk","model":"gt-5.6-sol","choices":[{"index":0,"delta":{"role":"assistant","content":"我是"},"finish_reason":null}]}

data: {"id":"chatcmpl-…","object":"chat.completion.chunk","model":"gt-5.6-sol","choices":[{"index":0,"delta":{"content":" …"},"finish_reason":"stop"}]}

data: {"object":"chat.completion.chunk","model":"gt-5.6-sol","choices":[],"usage":{"cost_rmb":0.0012,"cost_currency":"CNY","balance_rmb":98.76}}

data: [DONE]
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 示例默认流式 (stream: true)。生成时间可能较长时 (推理模型、长输出) 请使用流式: 非流式在整段生成完成前不返回任何内容, 你的客户端或中间代理的等待上限可能先到; 连接断开后本次生成仍会跑完并照常计费。需要一次性拿到完整 JSON 时, 去掉 stream (或设为 false) 即可。
> 去掉 stream 时一次性返回一个 JSON: object 为 chat.completion, 回复在 choices[0].message.content, usage 里是 token 用量。
> CL SDK / CL Code 想原生直连用 POST /v1/messages; GT Responses SDK / Codex 用 POST /v1/responses — 都是同一套密钥。
> 老 SDK 与工具链用的文本补全 POST /v1/completions (GT legacy) 也可调用, 同一套密钥。
> 思考类模型的推理内容在 reasoning_content (非流式) / delta.reasoning_content (流式) 里返回。
> 费用回执 (字段含义见公共说明「计费与估价」) 在本接口的位置: 非流式调用除 usage 外, 响应头另带 X-TokenGo-Cost-Micro-USD; 流式调用没有费用响应头, 改为在 data: [DONE] 之前多发一帧 chunk, 其 usage 里带 cost_rmb / cost_currency / balance_rmb; 流中途失败时不发这一帧。

相关说明: 认证与地址 · 计费与估价 · 错误码 · 速率限制

#### 响应式 API (GT Responses) — `POST /v1/responses`

- 分组: 对话 · 需鉴权
- GT Responses 原生入口, 给 Codex CLI / 新版官方 SDK / Agent 工具链用: input + instructions + tools, 支持流式与工具调用。跟 /v1/chat/completions 用同一批 chat 模型。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | chat 模型 ID |
| `input` | body | string | array | 是 | 用户输入 (字符串或 Responses 输入项数组) |
| `instructions / tools / stream …` | body | GT | 否 | 模型有原生 Responses 渠道时按规范原样透传; 没有时翻译成对话接口发出, 会保留 tools / tool_choice / text.format / reasoning.effort / prompt_cache_key / user, 不转发 store / truncation / service_tier。支持 previous_response_id: 网关保存每轮会话 2 小时, 过期或查不到时返回 400 previous_response_not_found, 请重发完整历史或开新会话 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/responses" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{ "model": "gt-5.6-sol", "input": "列出三个使用本 API 的理由", "stream": true }'
```

响应示例:
```json
event: response.created
data: {"type":"response.created","response":{"id":"resp_…","object":"response","model":"gt-5.6-sol","status":"in_progress"}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_…","output_index":0,"content_index":0,"delta":"1. …"}

event: response.completed
data: {"type":"response.completed","response":{"id":"resp_…","object":"response","model":"gt-5.6-sol","status":"completed","output":[…],"usage":{"input_tokens":15,"output_tokens":40,"total_tokens":55}}}
```

> 示例默认流式 (stream: true)。生成时间可能较长时 (推理模型、长输出) 请使用流式: 非流式在整段生成完成前不返回任何内容, 你的客户端或中间代理的等待上限可能先到; 连接断开后本次生成仍会跑完并照常计费。需要一次性拿到完整 JSON 时, 去掉 stream (或设为 false) 即可。
> 去掉 stream 时一次性返回一个 response 对象: status 为 completed, 回复在 output (output_text 是拼好的全文), usage 里是 token 用量。
> id 的前缀因路由而异 (翻译路沿用对话接口的 id), 只当不透明字符串使用。

相关说明: 认证与地址 · 错误码

#### CL Messages 原生入口 — `POST /v1/messages`

- 分组: 对话 · 需鉴权
- 给 CL 官方 SDK / CL Code 直连用: 把 base_url 换成本站、api key 换成本站密钥即可, 请求体保持 CL 原样 (system / messages / max_tokens / tools / stream)。鉴权同时接受 x-api-key 与 Authorization: Bearer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | claude 系列模型 ID (也可传其它 chat 模型, 网关会翻译) |
| `max_tokens` | body | integer | 是 | CL 规范必填 |
| `messages` | body | array | 是 | CL 消息数组 |
| `system / tools / stream / thinking …` | body | CL | 否 | 按 CL Messages 规范透传。thinking 生效: enabled / adaptive 开启、disabled 关闭; 思考内容以 type:"thinking" 内容块返回 (signature 为空, 不要回放给本站); 历史消息里的 thinking 块会被忽略 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/messages" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "cl-fable-5",
    "max_tokens": 1024,
    "messages": [{ "role": "user", "content": "Hello" }],
    "stream": true
  }'
```

响应示例:
```json
event: message_start
data: {"type":"message_start","message":{"id":"msg_…","type":"message","role":"assistant","model":"cl-fable-5","content":[],"stop_reason":null,"usage":{"input_tokens":8,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi! …"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":12}}

event: message_stop
data: {"type":"message_stop"}
```

> 示例默认流式 (stream: true)。生成时间可能较长时 (推理模型、长输出) 请使用流式: 非流式在整段生成完成前不返回任何内容, 你的客户端或中间代理的等待上限可能先到; 连接断开后本次生成仍会跑完并照常计费。需要一次性拿到完整 JSON 时, 去掉 stream (或设为 false) 即可。
> 去掉 stream 时一次性返回一个 message 对象: 回复在 content 数组 (type 为 text 的块), stop_reason 说明为何结束, usage 里是 token 用量。
> POST /v1/messages/count_tokens 可预估输入 token (估算值, 计费以实际用量为准)。

相关说明: 认证与地址 · 错误码

#### 预估输入 token (CL Messages) — `POST /v1/messages/count_tokens`

- 分组: 对话 · 需鉴权
- CL 官方 SDK 的 count_tokens 写法: 请求体与 POST /v1/messages 相同, 返回 input_tokens。这是平台的估算值 —— 文字 (含 system、工具定义与工具结果) 按 UTF-8 字节数除以 4, 每张图片按 1500 计, 最少为 1 —— 不是各模型分词器的精确值。本接口不调用模型、不扣费。鉴权同时接受 x-api-key 与 Authorization: Bearer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `messages` | body | array | 是 | CL 消息数组, 不能为空 |
| `system / tools` | body | CL | 否 | 与 /v1/messages 相同, 一并计入估算 |
| `model` | body | string | 否 | 可照 /v1/messages 原样传; 估算不按模型区分 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/messages/count_tokens" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cl-fable-5",
    "system": "You are a helpful assistant.",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'
```

响应示例:
```json
{
  "input_tokens": 8
}
```

> 请求体不是合法 JSON 或 messages 为空时返回 400, 错误体是 CL 格式: {"type": "error", "error": {"type": "invalid_request_error", "message": "…"}}。

相关说明: 认证与地址 · 错误码

### 图片

生成或编辑图片, 等结果直接返回。

#### 图片生成 (同步, GT 兼容) — `POST /v1/images/generations`

- 分组: 图片 · 需鉴权
- GT Images 兼容, 阻塞到出图后同步返回。出图常要 1 分钟左右; 请求超过约 5 秒后网关会持续发送空白字节保活, 此后 HTTP 状态码固定为 200 —— 判成败要看 body: 有 error 字段就是失败, 没有 error 且 data[].url 非空才是成功。要状态码严格对应成败、或不想让连接挂着, 请走 POST /api/v1/model-runtime/invoke 拿 task_id 再轮询。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | image 模型 ID (gt-image-2 / gm-3.1-flash-image / doubao-seedream-5-0 …) |
| `prompt` | body | string | 是 | 图片描述 |
| `n / size / quality / style` | body | GT | 否 | GT Images 字段 (数量 n 也可写作 count); 模型专属参数与取值见模型详情页 |
| `aspect_ratio / resolution` | body | string | 否 | 画幅与清晰度两个轴, 与 size 二选一, 规则同统一调用入口 |
| `reference_images` | body | array | 否 | 参考图公网 URL 数组 (别名 images / image / attachments), 张数上限见模型 param_schema 的 images.max_items |
| `response_format` | body | string | 否 | 接受但**不改变返回形态**: 出图一律落我方 CDN 后回 url。该参数只影响我们向上游取图的方式, 不要依赖它拿 base64 (要字节请自行 GET url) |
| `lane_id` | body | string | 否 | 只用这一条渠道; 取值与规则见「钉渠道」 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "model": "gt-image-2", "prompt": "a shiba inu wearing a hat", "n": 1, "size": "1024x1024" }'
```

响应示例:
```json
{
  "created": 1788401531,
  "data": [
    {
      "creation_task_id": "6a18c59e-60eb-4333-bd43-7be4ffe3d591#0",
      "url": "https://cdn.example.com/sha256/9f/1a8b….png.q95.jpg",
      "original_url": "https://cdn.example.com/sha256/9f/1a8b….png",
      "thumbnail_url": "https://cdn.example.com/sha256/9f/1a8b….png.q95.jpg.g768.jpg"
    }
  ],
  "usage": { "cost_rmb": 0.065002, "cost_currency": "CNY", "balance_rmb": 5468.599253 }
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> `url` 是唯一恒定字段, 也是你该用的那个 —— 但它可能是**压缩图** (`.q95.jpg`)。要无损原字节请用 `original_url`。
> `original_url` / `thumbnail_url` 是**条件字段**: 只有走边缘派生的出图才有, 老路 (厂商直出 JPEG, 原图已丢) 不返回 —— 不返回时不要回填 `url` 当原图, 那不是原图。按 `data[i].original_url ?? data[i].url` 取即可。
> `creation_task_id` 是该图在平台侧的权威落库键 (形如 `<uuid>#<下标>`), 用它对账 / 去重, 别自己拼。
> `revised_prompt` 只有上游厂商回传时才出现, 多数模型没有; `b64_json` 只是**镜像失败时的降级兜底**, 不是可选的输出格式 —— 两者都不要当必有字段解析。
> 失败时 body 为 `{"error": {"code", "message", "type", "class"}}`, `class` 可能缺省; 保活开始后的失败同样是这个形状, 只是状态码为 200。

相关说明: 计费与估价 · 钉渠道 · 参数取值 · 参数调整回执 · 错误码

#### 图片编辑 (同步, GT 兼容) — `POST /v1/images/edits`

- 分组: 图片 · 需鉴权
- GT Images edits 兼容: 上传一张或多张源图 (可选 mask) + 描述, 阻塞到出图后同步返回, 返回形状与 POST /v1/images/generations 完全相同。支持 multipart/form-data (文件直传) 与 application/json (源图给公网 URL 或 data URI) 两种写法; JSON 写法与在 /v1/images/generations 里带参考图等价。请求超过约 5 秒后网关持续发送空白字节保活, 此后 HTTP 状态码固定为 200 —— 判成败要看 body 里有没有 error。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | form | string | 是 | 图片模型 ID (gt-image-2 / gm-3.1-flash-image …); 本网关是多模型入口, 必须显式指定 |
| `prompt` | form | string | 是 | 描述你想要的编辑结果 |
| `image / image[]` | form | file | 是 | 源图文件, 可重复多份做多图融合; 张数上限 = max(16, 该模型参数表里 images 的 max_items), 单张 ≤ 50MB |
| `mask` | form | file | 否 | 蒙版图 (透明区域 = 要编辑的区域), ≤ 50MB, 只取第一份; 是否生效取决于模型 |
| `n` | form | integer | 否 | 生成张数, 正整数 |
| `size / quality / response_format / background / output_format / output_compression / input_fidelity / style / user` | form | string | 否 | GT Images edits 的同名字段, 原样转交 (output_compression 须为整数); response_format 同 /v1/images/generations, 不改变返回形态 |
| `aspect_ratio / resolution …` | form | per-model | 否 | 模型参数表里声明的其它参数, 按声明类型读取 (multipart 下与 JSON 写法同样生效) |

请求示例:
```bash
curl "https://121481.token6688.com/v1/images/edits" \
  -H "Authorization: Bearer $API_KEY" \
  -F model=gt-image-2 \
  -F prompt="replace the background with a sunny beach" \
  -F image=@source.png \
  -F mask=@mask.png \
  -F n=1 \
  -F size=1024x1024
```

响应示例:
```json
{
  "created": 1788401531,
  "data": [
    {
      "creation_task_id": "6a18c59e-60eb-4333-bd43-7be4ffe3d591#0",
      "url": "https://cdn.example.com/sha256/9f/1a8b….png.q95.jpg",
      "original_url": "https://cdn.example.com/sha256/9f/1a8b….png",
      "thumbnail_url": "https://cdn.example.com/sha256/9f/1a8b….png.q95.jpg.g768.jpg"
    }
  ],
  "usage": { "cost_rmb": 0.065002, "cost_currency": "CNY", "balance_rmb": 5468.599253 }
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 返回字段、计费、失败形状与参数调整回执的含义与 POST /v1/images/generations 完全相同 (同一条处理链), 请参照那一条; 换渠道与重试报价的规则见「计费与估价」。
> 缺 model / prompt / image、张数或单张大小超限、n 或 output_compression 不是整数时, 立即返回 400 invalid_request (此时还没开始保活, 状态码就是真实的 400); 整个 multipart 请求体约 200MB 封顶, 超出同样 400。
> 用 JSON 写法时把源图放在 image (字符串或数组, 公网 URL 或 data URI) 里, mask 同样给 URL 或 data URI; 其余字段与 /v1/images/generations 相同。
> 没有原生「编辑」能力的模型也可以用本接口: 源图会作为参考图参与生成。

相关说明: 计费与估价 · 钉渠道 · 参数取值 · 参数调整回执 · 错误码

### 视频与音频

视频、音乐和语音都是异步任务: 提交后马上拿到任务号, 再用任务查询接口取结果。

#### 提交媒体生成任务 (统一入口, 视频 / 音频异步) — `POST /v1/media/generate`

- 分组: 视频与音频 · 需鉴权
- 视频 / 音频 (音乐、语音) 的统一异步入口: model + prompt + params 信封, 立即返回 task_id, 再轮询 GET /v1/tasks/{task_id}。注意: 图片模型走本路径是同步的 (内部转 /v1/images/generations, 阻塞到上游出图才返回; 返回的任务通常已完成 (is_final=true, 结果在 data.result_url), 若成片仍在转存则为处理中, 按 task_id 继续轮询即可) — 图片要真异步请用 POST /api/v1/model-runtime/invoke。params 里每个字段的合法值以该模型的参数表为准。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 模型 ID |
| `prompt` | body | string | 是 | 生成描述 (所有模型必填, 空 prompt 返回 400; TTS 模型这里填要朗读的文字) |
| `params` | body | object | 否 | 模型专属参数 (duration / resolution / aspect_ratio / images …), 字段与取值见模型详情。必须放在 params 里: 本端点只读 model / prompt / params / count / client_request_id, 放在顶层的其它字段会被忽略 |
| `client_request_id` | body | string | 否 | 防重复提交 (仅视频, ≤128 字符), 见「防重复提交」 |
| `params.lane_id` | body | string | 否 | 只用这一条渠道; 本接口要放在 params 里, 取值与规则见「钉渠道」 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/media/generate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vo-3.1",
    "prompt": "a corgi surfing at sunset, cinematic",
    "params": { "duration": "8", "aspect_ratio": "16:9", "quality": "\u5feb\u901f" }
  }'
```

响应示例:
```json
{
  "code": 200,
  "msg": "任务创建成功",
  "data": {
    "task_id": "task-1788487332631-3",
    "status": "pending",
    "is_final": false
  }
}
```

> 示例里 vo-3.1 的 quality 为必填, 取值是中文: 经济 / 快速 / 高质量。命令行里不直接写中文, 所以示例用 JSON 的 \u 转义 ("\u5feb\u901f" = 快速)。
> 必填参数没传时, 网关按模型的默认值补上并按它计价 (例如 vo-3.1 不传 quality 就按「快速」); 本端点的提交回执不回传这类补值。想在响应里看到补了什么, 用 POST /api/v1/model-runtime/invoke —— 它的响应带 param_adjustments (reason=card_default)。

相关说明: 异步任务流程 · 请求与返回的形状 · 参考素材 · 计费与估价 · 钉渠道 · 防重复提交 · 参数取值 · 参数调整回执

#### 上传声纹 (我的声纹库) — `POST /v1/audio/voices`

- 分组: 视频与音频 · 需鉴权
- 上传一段参考音频, 克隆成自己的音色, 目前只用于 speech-2.8。请求是 multipart/form-data, 返回 202: id 是以后合成时 voice 要填的值; task_id 用 GET /v1/tasks/{task_id} 查克隆进度 (status 为 pending / processing / completed / failed), completed 后这个音色可用。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `file` | form | binary | 是 | 参考音频文件: MP3 / M4A / WAV, 扩展名要与内容一致, 小于 20 MiB, 时长 10–300 秒 (时长在克隆任务里检查, 不符时任务失败, error.code 为 invalid_audio_duration) |
| `model` | form | string | 是 | 只能是 speech-2.8 |
| `name` | form | string | 是 | 声纹名称, 去掉首尾空格后 1–50 个字符 |
| `preview_text` | form | string | 否 | 试听文字, 最多 300 个字符 |
| `Idempotency-Key` | header | string | 否 | 防重复提交 (最长 255 个字符): 同一个值重放相同请求返回同一个声纹与任务; 参数不同返回 409 idempotency_conflict |

请求示例:
```bash
curl "https://121481.token6688.com/v1/audio/voices" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: voice-upload-001" \
  -F "file=@./voice-sample.mp3" \
  -F "model=speech-2.8" \
  -F "name=我的声音" \
  -F "preview_text=欢迎使用我的专属声音。"
```

响应示例:
```json
{
  "id": "omfvc_your_voice_id",
  "status": "processing",
  "task_id": "0b6f7c2e-5d41-4b8e-9c2a-3f1e8d7a6b50"
}
```

> 只收本地文件上传, 不接受 JSON 请求体或外部音频地址 (返回 400)。查询克隆任务需要密钥带语音权限。

相关说明: 异步任务流程 · 错误码

#### 我的声纹列表 — `GET /v1/audio/voices`

- 分组: 视频与音频 · 需鉴权
- 列出当前密钥用户克隆完成的声纹, 新的在前, 用 next_cursor 翻页。status 为 ready 可直接用于合成; expired 表示上游已失效, 需要重新上传样本。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | query | string | 否 | 只能是 speech-2.8 或不传 |
| `limit` | query | integer | 否 | 每页条数 1–100, 默认 20 |
| `after` | query | string | 否 | 翻页游标: 填上一页返回的 next_cursor |

请求示例:
```bash
curl "https://121481.token6688.com/v1/audio/voices?model=speech-2.8&limit=20" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "object": "list",
  "data": [
    {
      "id": "omfvc_your_voice_id",
      "name": "我的声音",
      "model": "speech-2.8",
      "status": "ready",
      "preview_url": "https://cdn.example.com/voices/preview.mp3",
      "created_at": "2026-07-30T12:00:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

相关说明: 错误码

#### 查询单个声纹 — `GET /v1/audio/voices/{voice_id}`

- 分组: 视频与音频 · 需鉴权
- 按 id 查询自己的一个声纹, 字段与列表里的一项相同; 不存在或不属于当前用户返回 404 voice_not_found。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `voice_id` | path | string | 是 | 上传时返回的 id |

请求示例:
```bash
curl "https://121481.token6688.com/v1/audio/voices/omfvc_your_voice_id" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "id": "omfvc_your_voice_id",
  "name": "我的声音",
  "model": "speech-2.8",
  "status": "ready",
  "preview_url": "https://cdn.example.com/voices/preview.mp3",
  "created_at": "2026-07-30T12:00:00Z"
}
```

相关说明: 错误码

#### 上传素材到素材库 — `POST /v1/api/assets/upload`

- 分组: 视频与音频 · 需鉴权
- 把参考图或参考音频的公网地址存进素材库, 返回素材 ID 与状态; 生成时在请求里写 `asset://<素材ID>` 引用。字段名与方舟官方一致 (Id / Name / AssetType / Status / CreateTime), 成功体 `{code: 0, message, data}`。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `url` | body | string | 是 | 素材的公网 http(s) 地址 (本地文件先用 /v1/files 换成地址) |
| `asset_type` | body | string | 是 | `Image` / `Video` / `Audio` (不区分大小写); 视频上传时会测出时长并按它计费 |
| `name` | body | string | 否 | 自定义名称, 最长 64 个字符 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/api/assets/upload" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/person-front.jpg", "asset_type": "Image", "name": "person-front"}'
```

响应示例:
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "Id": "asset-20261002175358-hmw2h",
    "Name": "person-front",
    "AssetType": "Image",
    "Status": "Active",
    "URL": "https://example.com/person-front.jpg",
    "CreateTime": "2026-10-02T09:53:58Z",
    "UpdateTime": "2026-10-02T09:53:58Z"
  }
}
```

> 返回的 `URL` 是你提交的地址, 不是素材库里的副本。上传失败的错误码: `asset_source_unreachable` (地址下载不到) / `asset_rejected` (未通过内容安全审核) / `asset_invalid` (格式、大小或时长不合规) / `asset_service_unavailable` (稍后重试)。

相关说明: 素材库

#### 查询素材 — `GET /v1/api/assets/{Id}`

- 分组: 视频与音频 · 需鉴权
- 查询自己的一条素材, 每次都会刷新它的最新状态; 别人的或已删除的素材返回 404 `asset_not_found`。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `Id` | path | string | 是 | 上传时返回的素材 ID |

请求示例:
```bash
curl "https://121481.token6688.com/v1/api/assets/asset-20261002175358-hmw2h" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "Id": "asset-20261002175358-hmw2h",
    "Name": "person-front",
    "AssetType": "Image",
    "Status": "Failed",
    "FailReason": "素材已失效，请重新上传",
    "URL": "https://example.com/person-front.jpg",
    "CreateTime": "2026-10-02T09:53:58Z",
    "UpdateTime": "2026-10-03T10:02:11Z"
  }
}
```

相关说明: 素材库

#### 列出我的素材 — `GET /v1/api/assets`

- 分组: 视频与音频 · 需鉴权
- 按上传时间倒序列出自己未删除的素材。列表里的状态是最近一次已知状态, 要最新状态请逐条查询。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `PageNumber` | query | integer | 否 | 页码, 从 1 开始, 默认 1 |
| `PageSize` | query | integer | 否 | 每页条数, 默认 20, 最大 100 |
| `Status` | query | string | 否 | 按状态筛选: Processing / Active / Failed |
| `AssetType` | query | string | 否 | 按类型筛选: Image / Video / Audio |

请求示例:
```bash
curl "https://121481.token6688.com/v1/api/assets?PageSize=20&Status=Active" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "Items": [
      {
        "Id": "asset-20261002175358-hmw2h",
        "Name": "person-front",
        "AssetType": "Image",
        "Status": "Active",
        "URL": "https://example.com/person-front.jpg",
        "CreateTime": "2026-10-02T09:53:58Z",
        "UpdateTime": "2026-10-02T09:53:58Z"
      }
    ],
    "TotalCount": 1,
    "PageNumber": 1,
    "PageSize": 20
  }
}
```

相关说明: 素材库

#### 删除素材 — `DELETE /v1/api/assets/{Id}`

- 分组: 视频与音频 · 需鉴权
- 删除自己的一条素材记录; 删除后不能再查询或在生成里引用。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `Id` | path | string | 是 | 要删除的素材 ID |

请求示例:
```bash
curl -X DELETE "https://121481.token6688.com/v1/api/assets/asset-20261002175358-hmw2h" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "code": 0,
  "message": "ok",
  "data": { "Id": "asset-20261002175358-hmw2h", "Deleted": true }
}
```

相关说明: 素材库

> 其它写法: 需要任务结束时回调通知你的服务器时用它 (主入口不支持回调)。参数直接放在请求体顶层, 不用 params 信封。

#### 视频生成 (扁平参数写法, 参数放顶层) — `POST /v1/videos/generations`

- 分组: 视频与音频 · 其它写法 · 需鉴权
- 视频的扁平参数写法入口, 能力与 /v1/media/generate 等价, 但请求体形状不同: 所有参数放顶层 (model / prompt / duration / resolution / aspect_ratio / images …)。误发 /v1/media/generate 的 params 信封时, 网关会把信封里的字段抬到顶层 (顶层同名字段优先), 但顶层扁平仍是本端点的标准写法。始终异步: 返回 task_id 后轮询 GET /v1/tasks/{task_id}。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `callback_url` | body | string | 否 | 任务结束时回调这个地址, 见「完成回调」 |
| `callback_secret` | body | string | 否 | 回调验签密钥, 见「完成回调」 |
| `model` | body | string | 是 | video 模型 ID |
| `prompt` | body | string | 是 | 视频描述 (必填, 只传参考图会被拒) |
| `duration / resolution / aspect_ratio / mode / images / video …` | body | per-model | 否 | 顶层扁平字段, 每个模型的可选值见模型详情页参数表 |
| `client_request_id` | body | string | 否 | 防重复提交 (≤128 字符, 每单唯一), 见「防重复提交」 |
| `lane_id` | body | string | 否 | 只用这一条渠道; 取值与规则见「钉渠道」 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/videos/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance-2-5",
    "prompt": "一只猫在阳光下的草地上奔跑, 电影感慢镜头",
    "mode": "text-to-video",
    "duration": 15,
    "resolution": "720p",
    "aspect_ratio": "16:9",
    "client_request_id": "order-20260818-0001"
  }'
```

响应示例:
```json
{
  "id": "task-1788487332613-2",
  "object": "video",
  "task_id": "task-1788487332613-2",
  "status": "pending"
}
```

> 本端点也能接受 {"params": {…}} 信封 (自动摊平到顶层, 顶层同名字段优先); 但反过来, 把顶层扁平字段发到 /v1/media/generate 会被忽略 (它只读 model / prompt / params / count / client_request_id) —— 两个端点的示例不要互相照抄。

相关说明: 异步任务流程 · 请求与返回的形状 · 参考素材 · 计费与估价 · 钉渠道 · 防重复提交 · 完成回调 · 参数调整回执

> 其它写法: 习惯参数放顶层的扁平参数写法音乐生成, 与主入口能力相同; 不支持完成回调。

#### 音乐生成 (扁平参数写法, 异步) — `POST /v1/audio/generations`

- 分组: 视频与音频 · 其它写法 · 需鉴权
- 音乐类模型 (如 music) 的扁平入口: 参数放顶层, 本端点固定按音乐生成处理 (operation 恒为 music), 立即返回 task_id, 再轮询 GET /v1/tasks/{task_id}, 完成后 output_url 是音频文件。语音合成 (TTS) 走 POST /v1/audio/speech (同步二进制) 或 /v1/audio/speech/async; 统一入口 /api/v1/model-runtime/invoke 对 audio 不带 operation 时按卡片推出 (语音转写卡 whisper-1 按 transcribe, 其余按 TTS speech), 所以音乐卡在 invoke 要写 operation=generate — 两个入口缺省不同, 别混用。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 音乐模型 ID (如 music) |
| `prompt` | body | string | 是 | 音乐描述 / 歌词提示 |
| `其余参数` | body | per-model | 否 | 顶层扁平, 见模型详情页参数表; 本端点不会摊平 {"params": {…}} 信封, 放进信封的参数不生效 |
| `lane_id` | body | string | 否 | 只用这一条渠道; 取值与规则见「钉渠道」 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/audio/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "model": "music", "prompt": "轻快的城市流行, 女声, 副歌朗朗上口" }'
```

响应示例:
```json
{
  "object": "model_runtime.invoke",
  "mode": "async",
  "status": "pending",
  "task_id": "task-1788487964502-9",
  "model": { "public_model": "music", "category": "audio" },
  "result": { "status": "pending", "task_id": "task-1788487964502-9" }
}
```

相关说明: 异步任务流程 · 请求与返回的形状 · 钉渠道 · 完成回调 · 参数调整回执

> 其它写法: 所有类型都按任务方式提交: 图片也想先拿任务号就用它; 图片和视频支持完成回调。注意 prompt 写在 params 里。

#### 统一调用入口 (图片/视频/音频异步, 图片真异步在这) — `POST /api/v1/model-runtime/invoke`

- 分组: 视频与音频 · 其它写法 · 需鉴权
- 平台的统一模型调用信封: {model_id, modality, operation, params}。图片、视频、音频提交后立即返回 task_id (图片走这里也是真异步, 首字节毫秒级), 这正是同步图片端点描述里推荐的那条路; chat 默认同步返回, 传 async:true 改为返回 task_id, 传 stream:true 走流式。⚠ 与扁平端点最大的差别: prompt 写在 params 里 (params.prompt), 不在顶层。operation 按模态与模型填写: 图片 generate (缺省) 或 edit; 视频不填; 音频按卡片 —— 语音合成卡 (如 speech-2.8) 用 speech (缺省, 需要 params.input 与 voice); 音乐卡 music 用 generate; 语音转写卡 whisper-1 用 transcribe (不写也按转写处理, 需要 params.audios 与 params.audio_duration_sec)。克隆自己的音色请用声纹库接口 POST /v1/audio/voices (上传参考音频, 完成后在 speech-2.8 的 voice 里使用); voice-clone 卡不能合成、作曲或转写, 这样调用会在扣费前返回 400 invalid_request。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model_id` | body | string | 是 | 模型 ID (目录里的 public_id; 旧 id 也能调) |
| `modality` | body | string | 是 | chat / image / video / audio (给了 operation 可推断时可省, 建议总是显式给) |
| `operation` | body | string | 否 | 图片: generate (缺省) / edit; 视频不填; 音频按卡片: speech (语音合成, 缺省) / generate (音乐) / transcribe (语音转写, whisper-1 不写也按它)。音乐卡另支持 extend / cover / lyrics / stems / stems_all / mp4 / concat。克隆音色走 POST /v1/audio/voices |
| `params` | body | object | 是 | 模型参数信封, prompt 也在这里 (params.prompt); 其余字段与取值见模型详情页参数表 |
| `lane_ids` | body | array | 否 | 只在这批渠道里选, 规则见「钉渠道」; 别名 pinned_lane_ids 等价 |
| `lane_id` | body | string | 否 | lane_ids 的单值形态; 别名 pinned_lane_id 等价 |
| `attachments` | body | array | 否 | 参考图公网 URL 数组 |
| `async` | body | boolean | 否 | 仅 chat: true 时立即返回 task_id |
| `client_request_id` | body | string | 否 | 防重复提交 (≤128 字符), 见「防重复提交」 |
| `callback_url / callback_secret` | body | string | 否 | 完成回调地址与验签密钥 (图片、视频、异步对话), 见「完成回调」; 地址不合法时返回 400 invalid_callback_url |

请求示例:
```bash
curl "https://121481.token6688.com/api/v1/model-runtime/invoke" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "gt-image-2.5-flare",
    "modality": "image",
    "params": {
      "prompt": "a shiba inu wearing a hat",
      "aspect_ratio": "16:9",
      "resolution": "2K",
      "quality": "high"
    }
  }'
```

响应示例:
```json
{
  "object": "model_runtime.invoke",
  "request_id": "",
  "mode": "async",
  "status": "pending",
  "task_id": "task-1788487164928-1",
  "model": { "public_model": "gpt-image-2.5-flare", "upstream_model": "", "provider": "", "category": "image" },
  "lane": { "requested_strategy": "balanced" },
  "billing": {},
  "result": { "task_id": "task-1788487164928-1", "status": "pending" }
}
```

> 轮询统一走 GET /v1/tasks/{task_id} (跟其它异步端点同一形状); 也可用 GET /api/v1/model-runtime/tasks/{task_id}, 返回同一份任务视图。
> 图片的画幅与清晰度是 aspect_ratio + resolution 两个轴, 我方按「比例 × 档位」合成像素后发给上游 (例: 16:9 + 2K → 2048x1152); 老 API 的 size 像素串仍原样支持, 与两个轴二选一, 同时传时 size 赢、两个轴被忽略, 新对接建议用两个轴。⚠ 两个值各自在枚举里**不代表这个组合一定有渠道能做** —— 合成出的像素要落在某条渠道的能力表内, 冷门组合可能没有可用渠道。提交前用 POST /api/v1/model-runtime/dry-run (同一个信封, ¥0, 不打厂商不冻结) 验一次: 它会告诉你会走哪条渠道、真正发出去的 body 长什么样。
> 提交前想零成本验证参数: POST /api/v1/model-runtime/dry-run (同样的信封) 只做校验与路由决策, 不打厂商、不冻结、不计费。它和正式调用用同一套密钥权限: 需要对应模态的权限, 密钥的可用模型限制同样生效。

相关说明: 异步任务流程 · 请求与返回的形状 · 参数取值 · 计费与估价 · 钉渠道 · 防重复提交 · 完成回调 · 参数调整回执

> 其它写法: 已按 GT 官方 SDK 语音接口写好的代码直接用; 要拿可长期保存的公网地址时用异步写法。

#### 语音合成 (同步, 返回音频) — `POST /v1/audio/speech`

- 分组: 视频与音频 · 其它写法 · 需鉴权
- GT 语音合成写法: 参数放请求体顶层, 合成完成时直接返回音频二进制 (Content-Type 按 response_format, 默认 audio/mpeg), 不产生任务。本次费用与余额在响应头 X-TokenGo-Cost-RMB / X-TokenGo-Balance-RMB。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 语音模型 ID, 如 tts-1; 可用模型见模型目录里的语音卡 |
| `input` | body | string | 是 | 要合成的文字, 不能为空 |
| `voice` | body | string | 否 | 音色。不传时用该模型的默认音色 (没有默认音色的模型必填); 传了不属于该模型的音色名: 音色表固定的模型 (OpenAI / Gemini) 换成默认音色, doubao-tts-2.0 返回 400 preset_voice_unsupported 且不扣费 (可选音色见该模型页); 自定义音色 (我的声纹库) 只有 speech-2.8 能用, 其它模型返回 400 custom_voice_unsupported 且不扣费 |
| `response_format` | body | string | 否 | 音频格式: mp3 (默认) / opus / aac / flac / wav, 各模型支持哪些见模型参数表 |
| `speed` | body | number | 否 | 语速, 是否支持与取值范围见模型参数表 |
| `其余参数` | body | per-model | 否 | 顶层扁平, 见模型详情页参数表 |
| `lane_id` | body | string | 否 | 只用这一条渠道; 取值与规则见「钉渠道」 |
| `X-Schedule-Strategy` | header | string | 否 | 单次覆盖调度策略, 取值见「钉渠道」里的策略表 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/audio/speech" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "欢迎使用语音合成。",
    "voice": "alloy",
    "response_format": "mp3"
  }' \
  --output speech.mp3
```

响应示例:
```json
200 OK
Content-Type: audio/mpeg

<音频二进制>
```

> 合成失败不扣费, 冻结的金额自动退回。请求发出后客户端断开不会取消合成, 合成成功仍按完成计费。

相关说明: 计费与估价 · 钉渠道 · 错误码

> 其它写法: 需要可长期保存的公网音频地址, 或文字较长、不想一直等同步响应时用它。

#### 语音合成 (异步, 返回公网地址) — `POST /v1/audio/speech/async`

- 分组: 视频与音频 · 其它写法 · 需鉴权
- 参数与同步写法相同, 立即返回 202 与 task_id; 用 GET /v1/tasks/{task_id} 查询, 音频转存到平台 CDN 后才报 completed, 结果地址在 output_url (audio_url 同值), 可长期使用。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 语音模型 ID, 如 tts-1 |
| `input` | body | string | 是 | 要合成的文字, 不能为空 |
| `voice` | body | string | 是 | 音色, 本写法必须传 (不会自动补默认音色); 传了不属于该模型的音色名: 音色表固定的模型 (OpenAI / Gemini) 换成默认音色, doubao-tts-2.0 返回 400 preset_voice_unsupported 且不扣费 (可选音色见该模型页); 自定义音色只有 speech-2.8 能用 |
| `response_format / speed` | body | per-field | 否 | 与同步写法相同 |
| `其余参数` | body | per-model | 否 | 顶层扁平, 见模型详情页参数表 |
| `lane_id` | body | string | 否 | 只用这一条渠道; 取值与规则见「钉渠道」 |
| `X-Schedule-Strategy` | header | string | 否 | 单次覆盖调度策略, 取值见「钉渠道」里的策略表 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/audio/speech/async" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "欢迎使用语音合成。",
    "voice": "alloy",
    "response_format": "mp3"
  }'
```

响应示例:
```json
{
  "id": "task-1789400000000-7",
  "object": "audio.speech",
  "status": "pending",
  "task_id": "task-1789400000000-7"
}
```

> 本写法不支持完成回调与防重复提交键 (callback_url / client_request_id 不生效); 需要它们请用 POST /api/v1/model-runtime/invoke。

相关说明: 异步任务流程 · 计费与估价 · 钉渠道 · 错误码

### 任务查询

查询异步任务的状态与结果, 以及每种状态的含义。

#### 查询任务状态 — `GET /v1/tasks/{task_id}`

- 分组: 任务查询 · 需鉴权
- 查询当前密钥用户提交的异步任务。status 常规为 pending / processing / completed / failed 四值 (极少数人工审核路径会短暂出现第五值 needs_review, 非终态 — 判终态永远用 is_final, 别枚举 status); completed 后读 output_url (权威结果字段), failed 时 error 给失败原因。旧的 skills 写法 GET /v1/skills/task-status 见本组「其它写法」。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 提交任务时返回的 task_id |

请求示例:
```bash
curl "https://121481.token6688.com/v1/tasks/task_abc123" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "id": "task_abc123",
  "type": "video",
  "model": "vo-3.1",
  "status": "completed",
  "is_final": true,
  "progress": 100,
  "progress_available": true,
  "stage": "delivered",
  "result_url": "https://cdn.example.com/…/result.mp4",
  "output_url": "https://cdn.example.com/…/result.mp4",
  "data": [{ "url": "https://cdn.example.com/…/result.mp4", "type": "video" }],
  "cdn_pending": false,
  "result": { "videos": [{ "url": "https://cdn.example.com/…/result.mp4" }] },
  "duration_seconds": 84,
  "created_at": "2026-08-18T10:00:00Z"
}
```

| status | skills 别名 state | 终态 | 说明 |
|---|---|---|---|
| `pending` | `pending` | — | 任务已受理 (费用已按整单预冻结), 排队等待上游开始执行 |
| `processing` | `processing` | — | 上游正在生成; progress_available=true 时 progress 有真实进度 |
| `completed` | `success` | 是 (is_final) | 生成成功, 结果在 output_url (及 result.*); 已按实际用量结算 |
| `failed` | `failed` | 是 (is_final) | 生成失败, error / error_class 给原因; 预冻结金额已自动解冻; 带 retry_offer 时可钉其 lane_id 按新价重做 |

> 轮询不计费, 也不占用密钥的每分钟请求额度; 拿到 is_final=true 就停。
> 请把提交时返回的 task_id 和响应头 X-Request-Id (req_…) 记进你的日志: 控制台「调用日志」可以直接按它们搜到这次调用, 排查时最快。
> is_final=true 对成功和失败都成立 —— 判成败要看 status (completed / failed) 或 error 字段, 别只判 is_final。
> duration_seconds 是任务耗时 (提交 → 结束), 不是生成媒体的时长。
> cdn_pending=true 表示结果暂时还是厂商地址、正在转存, 稍后再查同一接口会换成 CDN 地址。
> 只要结果字段时可以用 GET /v1/tasks/{task_id}/result (精简视图, 见「查询任务结果」); 它不带失败原因。
> 404 not_found = 查不到; 410 task_expired = 记录已过保留期 (请停止轮询, 结果可在作品库查看); 503 task_status_unavailable = 状态暂不可读, 稍后再查, 不要重新提交。

相关说明: 异步任务流程 · 错误码 · 计费与估价 · 完成回调 · 速率限制

#### 查询任务结果 (精简视图) — `GET /v1/tasks/{task_id}/result`

- 分组: 任务查询 · 需鉴权
- 只返回任务的结果字段, 给按「先查状态、再单独取结果」习惯写的 SDK 用。与 GET /v1/tasks/{task_id} 读的是同一份任务记录: is_final 与 status 判定完全一致, 结果地址与别名字段同名同义。任务未完成时只有 task_id / status / is_final=false; 完成后多出 result_url 等结果字段。失败原因不在本接口里, 需要时请查 GET /v1/tasks/{task_id}。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 提交任务时返回的 task_id |

请求示例:
```bash
curl "https://121481.token6688.com/v1/tasks/task_abc123/result" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "task_id": "task_abc123",
  "status": "completed",
  "is_final": true,
  "result_url": "https://cdn.example.com/…/result.mp4",
  "result_type": "video",
  "url": "https://cdn.example.com/…/result.mp4",
  "output_url": "https://cdn.example.com/…/result.mp4",
  "video_url": "https://cdn.example.com/…/result.mp4",
  "output": { "url": "https://cdn.example.com/…/result.mp4", "type": "video" },
  "data": [{ "url": "https://cdn.example.com/…/result.mp4", "type": "video" }],
  "cdn_pending": false
}
```

> 未完成时响应只有 task_id、status、is_final=false 三个字段; status 取值与主接口相同 (pending / processing / completed / failed, 极少数情况下短暂出现 needs_review)。判终态用 is_final。
> 失败任务返回 status=failed、is_final=true, 不带失败原因 (error / error_class) 与重试报价 —— 要这些请查 GET /v1/tasks/{task_id}。
> data[] 列出全部结果 (多张图 / 多段视频), result_url、url、output_url 与 video_url / image_url / audio_url 都指向第一个结果。cdn_pending=true 表示结果暂时还是外部地址、正在转存, 稍后再查同一接口会换成平台 CDN 地址。
> 轮询不计费, 不占用密钥的每分钟生成额度; 建议 5~10 秒一次, 拿到 is_final=true 就停。
> 错误码与主接口相同: 404 not_found = 查不到; 410 task_expired = 记录已过保留期 (停止轮询, 结果可在作品库查看); 503 task_status_unavailable = 状态暂不可读, 稍后再查, 不要重新提交。

> 其它写法: 按 skills 接口 (SKILL.md) 接入的代码用它; 新接入请用 GET /v1/tasks/{task_id}。

#### 查询任务状态 (skills 写法) — `GET /v1/skills/task-status`

- 分组: 任务查询 · 其它写法 · 需鉴权
- 与 GET /v1/tasks/{task_id} 查同一个任务, task_id 放在查询参数里。status 同样是 pending / processing / completed / failed 四值, 判终态用 is_final; 另带旧字段 state (pending / processing / success / failed)、status_zh 与 status_group (中文标签) —— 判断请用 is_final 或 status, 不要比对这三个旧字段。结果地址在 result_url (output_url、url 同值, 全部结果在 data[]); progress 是百分比字符串; cost 是本次实际费用 (美元)。主端点可能短暂返回 needs_review, 本写法会显示为 processing。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | query | string | 是 | 提交任务时返回的 task_id |

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/task-status?task_id=task_abc123" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "task_id": "task_abc123",
  "model": "vo-3.1",
  "status": "completed",
  "state": "success",
  "status_zh": "生成完成",
  "status_group": "已完成",
  "is_final": true,
  "progress": "100%",
  "progress_available": true,
  "result_type": "video",
  "result_url": "https://cdn.example.com/…/result.mp4",
  "output_url": "https://cdn.example.com/…/result.mp4",
  "url": "https://cdn.example.com/…/result.mp4",
  "video_url": "https://cdn.example.com/…/result.mp4",
  "output": { "url": "https://cdn.example.com/…/result.mp4", "type": "video" },
  "data": [{ "url": "https://cdn.example.com/…/result.mp4", "type": "video" }],
  "input_files": [],
  "created_at": "2026-08-18T10:00:00Z",
  "completed_at": "2026-08-18T10:01:24Z",
  "duration_seconds": 84,
  "cost": 0.42,
  "channel_group": "V3",
  "error": null,
  "error_code": null
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 失败时 error 是给人看的原因, error_code 是机器可读的失败分类。偶尔出现 status=failed 却带 result_url 时会额外返回 result_inconsistent=true, 说明结果其实已生成, 不要按失败重新提交。
> 密钥需要 tasks、audio、video、image 中任一权限; 任务过了保留期返回 410 task_expired。

相关说明: 异步任务流程 · 错误码

### 模型与价格

模型目录 · 单模型参数 · 价格 · 估价

#### 实时估价 (按参数组合) — `POST /v1/pricing-estimate`

- 分组: 模型与价格 · 需鉴权
- 按 (模型 + 参数组合) 算这一单的价 — 价格随分辨率 / 时长 / 档位 / 参考素材数量变, 所以必须带上真实参数才准。默认只返当前调度策略下会走的那条渠道; 传 include_all_channels=true 则一次返回**全部候选渠道**各自的价 (服务端本来就算好了全部候选, 不传只是丢掉)。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 模型 ID |
| `params` | body | object | 否 | 该模型的参数 (取值见模型详情页; 影响价格的维度必须给真实值) |
| `params.videos / params.images / params.audios` | body | array | 否 | 参考素材, 跟提交时同名同形 (URL 数组; 估价只数数量, 不下载)。带上它们价格才会包含该渠道的参考附加费 (参考图倍率 / 参考视频输入秒); 不带 = 估的是无参考素材的价 |
| `params.video_total_duration_sec` | body | number | 否 | 参考视频各段时长之和 (秒)。带 videos 时必传 —— 按秒模型把它计入输入费 (输出秒 + 参考视频秒)。不传时: 按秒计参考视频的模型返回 422 reference_video_duration_pending; 其余模型按保守固定秒数估 (price_basis.reference_video_sec_source=assumed)。实扣一律以服务端探测的真实时长为准 |
| `include_all_channels` | body | boolean | 否 | true = 额外返回 channels[]: 该组合下全部渠道各自的价, 免得按渠道逐个重打 |
| `pinned_lane_id` | body | string | 否 | 只算指定渠道 (值用 channels[].lane 或 /lanes 的 lane id) |
| `pinned_lane_ids` | body | array | 否 | 只算这批渠道 (数组形态, 给了则优先于 pinned_lane_id) |
| `modality` | body | string | 否 | 显式声明模态 (chat / image / video / audio), 缺省按模型目录推断 |
| `strategy` | body | string | 否 | 调度策略, 取值 balanced (智能调度) / cost_first (价格优先) / reliability_first (稳定优先) / latency_first (速度优先); 其它值 (含旧取值 sla_first) 按智能调度处理; 不传 strategy 时按 balanced 估价 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/pricing-estimate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance-2-5",
    "params": {
      "duration": 15, "resolution": "720p", "aspect_ratio": "9:16",
      "videos": ["https://your-host.com/ref-a.mp4", "https://your-host.com/ref-b.mp4"],
      "video_total_duration_sec": 21.2
    },
    "include_all_channels": true
  }'
```

响应示例:
```json
{
  "vendor": "NTC",
  "lane": "official5",
  "group": "official5",
  "unit": "call",
  "effective_total_rmb": 25.34,
  "max_effective_total_rmb": 49.77,
  "required_freeze_rmb": 25.34,
  "billing_mode": "fixed_amount",
  "price_basis": {
    "billing_unit": "per_second",
    "output_duration_sec": 15,
    "reference_videos": 2,
    "reference_video_sec": 21.2,
    "reference_video_sec_source": "client",
    "output_rmb": 17.5,
    "reference_media_rmb": 7.84
  },
  "candidate_count": 5,
  "strategy": "balanced",
  "channels": [
    { "vendor": "NTC", "group": "official5", "lane": "seedance-2-5@NTC:official5",
      "effective_total_rmb": 25.34, "is_delivery_head": true },
    { "vendor": "TOA", "group": "default", "lane": "seedance-2-5@TOA:default",
      "effective_total_rmb": 44.32, "is_delivery_head": false }
  ]
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 三个价各是什么: effective_total_rmb = 当前策略下会走的那条渠道的实付价 (已含代理档位, 你通常被扣的就是它); max_effective_total_rmb = 该渠道故障、智能调度自动切到备用渠道时的最高实付 (钉单条渠道时两者相等); required_freeze_rmb = 提交时冻结的上界, 完成后按实际用量退差。对话模型按用量后付, 不返回 required_freeze_rmb。
> billing_mode 说明这个价怎么读: fixed_amount = 这次就收这么多; token_metered = 按代表用量估的, 实扣随厂商真实用量走 (图片高档位常明显低于估价), 冻结仍按估价上界。
> price_basis 把这一单拆开: output_rmb (不含参考素材) + reference_media_rmb (参考视频按合计秒 / 参考图倍率 / 参考音频) == effective_total_rmb。带参考视频时 params 必须传 video_total_duration_sec (各段秒数之和), 否则估价不含这部分。reference_video_sec_source=assumed 表示时长未传、按保守固定秒估; asset_library 表示参考视频全是素材库素材、秒数取上传时测得的时长 (地址与素材混用时为 client_and_asset_library); 实扣一律以服务端探测的真实时长为准。
> unit 是历史字段 (按次型 SKU 一律 call, 哪怕它按秒计价): 这一格到底按秒还是按次, 以 price_basis.billing_unit 为准。
> 注意响应顶层的 lane / group 只是分组名 (如 official5), 钉渠道要用 channels[].lane 的完整值。钉的渠道已下架或不适用当前模型 (或误传了 channel_id) 时, 估价返回 422 pinned_channel_unavailable。
> 要同步全量价格请用 POST /v1/pricing-estimate/batch, 别按渠道逐个打 — 那会打满额度且拿到的是同一份数据。
> 示例为节选: 实际响应还含 alternatives[] (各策略的选路) / strategy / channels[].param_schema 等字段。本端点专属限流触发时错误码是 rate_limit_exceeded (跟全局限流的 rate_limit_error 不同), 按 429 状态码处理即可。
> 估价响应同样带 `param_adjustments` (没有调整时省略): 用户没传的视频计价参数按交付头渠道 (is_delivery_head) 的生效值给出, 与本次 effective_total_rmb 用的是同一组值。

相关说明: 计费与估价 · 钉渠道 · 参数调整回执 · 速率限制

#### 批量估价 (全量价格同步用) — `POST /v1/pricing-estimate/batch`

- 分组: 模型与价格 · 需鉴权
- 一次提交最多 100 个 (模型 + 参数组合), 一次返回全部结果 —— 给「同步全量价格表」这类场景用。配合 include_all_channels, 一轮全量同步从上万次请求降到几十次。逐项独立: 某一项失败 (未知模型 / 暂不可路由) 只写该项 error, 整体仍 200, 不会让一条坏组合逼你重打整轮。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `items` | body | array | 是 | 1~100 个估价请求, 每项字段同 /v1/pricing-estimate |
| `include_all_channels` | body | boolean | 否 | 批量级默认值, 对每个 item 生效 (省得逐项写) |

请求示例:
```bash
curl "https://121481.token6688.com/v1/pricing-estimate/batch"   -H "Authorization: Bearer $API_KEY"   -H "Content-Type: application/json"   -d '{
    "include_all_channels": true,
    "items": [
      { "model": "vo-3.1", "params": { "duration": 8, "resolution": "1080p" } },
      { "model": "vo-3.1", "params": { "duration": 8, "resolution": "720p" } }
    ]
  }'
```

响应示例:
```json
{
  "count": 2,
  "ok_count": 2,
  "max_items": 100,
  "results": [
    { "index": 0, "model": "vo-3.1", "estimate": { "effective_total_rmb": 2.345, "channels": [ "…" ] } },
    { "index": 1, "model": "vo-3.1", "estimate": { "effective_total_rmb": 1.234, "channels": [ "…" ] } }
  ]
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 额度按**条目数**计, 不按请求数 — 100 条的批量消耗 100 条额度 (跟单条端点共用同一份额度)。429 的响应体会告诉你这批消耗多少、上限多少。
> 超过 100 条返回 400 too_many_items 并带上上限数字; 响应里的 max_items 也可直接用来分页。
> 结果顺序与请求一致, 且每项带 index — 按 index 回填即可, 不必依赖顺序。
> 失败项没有 estimate, 只有 error, 形如 { "index": 2, "model": "<你发的名字>", "error": { "status": 422, "code": "model_unknown", "message": "…" } }; ok_count < count 就说明有失败项。

相关说明: 速率限制

#### 模型列表 (GT 标准, 需鉴权) — `GET /v1/models`

- 分组: 模型与价格 · 需鉴权
- GT 兼容的模型列表 —— 官方 SDK 的 client.models.list() 打的就是这个。每条返回 id (调用时填的主键); 有公开别名的模型另带 public_id (没有别名的模型不出这个字段, 直接用 id), **两个名字在 model / model_id 字段都能用**, 响应里我们按你发的那个原样回显。本接口不含参数表, 也不含逐渠道价格: 参数看 GET /v1/logical-models 的 param_schema, 价格看 GET /v1/skills/models/{model_name}/pricing。要免鉴权的目录用公开的 GET /v1/skills/models。

请求示例:
```bash
curl "https://121481.token6688.com/v1/models" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-5.4",
      "public_id": "gt-5.4",
      "object": "model",
      "created": 0,
      "owned_by": "openai",
      "category": "chat",
      "capabilities": ["text"],
      "health_score": 100,
      "billing_mode": "token_metered"
    },
    {
      "id": "gpt-image-2.5-flare",
      "public_id": "gt-image-2.5-flare",
      "object": "model",
      "created": 0,
      "owned_by": "openai",
      "category": "image",
      "capabilities": ["image"],
      "health_score": 83,
      "billing_mode": "fixed_amount",
      "billing_unit": "per_request"
    }
  ]
}
```

> 任何有效的 API Key 都能调本接口 (不要求特定权限, chat / image / billing 任一权限的 Key 都可以)。只有被暂停、没有任何权限的 Key 会得到 403 insufficient_permissions。
> 三份列表是层层收窄的包含关系: /v1/models (路由层全量可调) ⊇ /v1/logical-models (模型卡全量, 含已退役并标 deprecated) ⊇ /v1/skills/models (公开目录, 已剔除退役)。本接口多出来的那部分是**变体 SKU** (如 -thinking 深度思考、-search 联网、语音的 -hd / -turbo 档) —— 它们能直接当 model 名调用, 但没有独立模型卡, 所以在另外两份列表里查不到。⇒「出现在这里」不等于「推荐使用 / 未退役」: 做目录展示与按类型筛选用 /v1/skills/models, 判断退役状态用 /v1/logical-models (带 deprecated 与 deprecation_note)。
> 本接口不接受任何查询参数 (发了会被忽略), 一次返回全部; 要按 chat / image / video / audio 筛选用 GET /v1/skills/models?type=。created 恒为 0 (我们不记录上架时间), 不要拿它排序或判断新旧。

相关说明: 认证与地址

#### 获取模型列表 — `GET /v1/skills/models`

- 分组: 模型与价格 · 公开接口
- 按类型查询未退役模型, 含 display_name / type / tags / supported_vendors 等；列入目录不保证当前渠道可用。api_endpoint / api_format 两字段只在 chat 模型上返回且恒为 /v1/chat/completions + openai (媒体模型没有这两字段, 端点见各模型详情页)。公开接口, 无需鉴权。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | query | string | 否 | 按模型类型筛选: chat / image / video / audio (小写); 不传返回全部 |
| `vendor` | query | string | 否 | 按 supported_vendors 里的 vendor 代号筛选 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/models?type=video"
```

响应示例:
```json
{
  "type": "video",
  "total": 41,
  "models": [
    {
      "name": "seedance-2-0-official",
      "display_name": "Seedance 2.0 · 官方直连",
      "type": "video",
      "tags": ["video", "seedance", "官方直连", "official"],
      "supported_vendors": ["VOL", "AII", "MTK", "NTC", "TOA"],
      "capabilities": ["文生视频", "图生视频", "视频参考", "首尾帧", "480p", "720p", "1080p", "按秒"],
      "description": "...",
      "description_zh": "..."
    }
  ]
}
```

> name 就是调用时可填的 model 值 (注意连字符 / 点号, 例 seedance-2-5 / kling-v3)。本接口的 name 是内部主键, 不返回公开别名; 有公开别名的模型两个名字都能调, 别名见 GET /v1/logical-models 的 public_id。
> GET /v1/logical-models 返回同源完整目录与 param_schema 对象，保留 deprecated 及可选 deprecation_note；本列表排除退役模型，历史身份查找不要依赖列表。

#### 获取模型功能与参数 — `GET /v1/skills/models/{model_name}`

- 分组: 模型与价格 · 公开接口
- 单个模型的功能信息 + params 数组 (每个参数的 label / type / required / options[].value / options[].is_default, 上传类参数另带 max_items / max_bytes 等上限), 不含价格。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model_name` | path | string | 是 | 模型 ID (来自 /v1/skills/models 的 name) |

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/models/seedance-2-5"
```

响应示例:
```json
{
  "name": "seedance-2-5",
  "display_name": "Seedance 2.5 · 官方直连",
  "type": "video",
  "input_hint": "描述要生成的视频内容",
  "max_prompt_chars": 30000,
  "capabilities": ["文生视频", "图生视频", "多模态参考", "参考视频", "480p", "720p", "按秒"],
  "tags": ["video", "seedance", "官方直连", "official"],
  "supported_vendors": ["…"],
  "description": "...",
  "params": [
    {
      "name": "resolution",
      "label": "清晰度",
      "type": "select",
      "required": false,
      "description": "480P / 720P / 1080P 可选，清晰度越高价越高（480P 最省）。",
      "options": [
        { "value": "480p", "label": "480P 经济", "is_default": true },
        { "value": "720p", "label": "720P 高清", "is_default": false },
        { "value": "1080p", "label": "1080P 全高清", "is_default": false }
      ]
    },
    {
      "name": "images",
      "label": "参考图片",
      "type": "upload",
      "required": false,
      "max_items": 30,
      "max_items_by_mode": { "text-to-video": 0, "first-frame": 30, "reference": 30 },
      "max_bytes": 5242880,
      "max_edge_px": 6000,
      "min_edge_px": 300,
      "description": "图生视频 / 多模态参考用 (≤30 张)。纯文生留空。"
    }
  ]
}
```

> params[].type 是界面控件类型: select (枚举, 值在 options[]) / number (含 min / max) / switch (布尔) / string / textarea / upload (公网 URL, 单个传字符串, 多个传数组)。
> 上传类参数的上限直接在该参数里: max_items (最多几个)、max_items_by_mode (按 mode 分别的上限, 0 = 该模式不收)、max_bytes (单个文件字节上限), 部分模型另有 max_edge_px / min_edge_px 等。部分模型还带 linkages, 描述参数联动 (某参数取某值时隐藏 / 必填另一参数)。
> 退役模型的旧 ID 仍可查询，返回 deprecated=true 和可选 deprecation_note。退役不自动替换型号；旧 API 执行仍受原有供给和禁用规则约束。

相关说明: 参数取值 · 参考素材

#### 获取模型价格 (跨渠道, 你的实付价) — `GET /v1/skills/models/{model_name}/pricing`

- 分组: 模型与价格 · 需鉴权
- 返回该模型在每个渠道组的**你的实付价** (¥, 已含你所属代理的加价) + 计费单位 / 24h 成功率 / 平均耗时。需要带密钥: 价格按调用密钥所属账号计算。智能调度会跨渠道自动选最优, 无需指定渠道; 出口 vendor 是脱敏代号。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model_name` | path | string | 是 | 模型 ID |
| `status` | query | string | 否 | active = 只返回当前启用的渠道组; 默认全部 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/models/gt-5.4/pricing?status=active" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "name": "gpt-5.4",
  "display_name": "GT-5.4",
  "type": "chat",
  "filter": "active",
  "pricing_note": "价格为你的账号**实际支付价** (¥, 已含你所属代理的加价), 不是渠道成本。…",
  "channel_groups": [
    {
      "lane_no": 1,
      "vendor": "MXH",
      "billing_method": "按token",
      "billing_unit": "token",
      "user_price_per_million_input_rmb": 3.625,
      "user_price_per_million_output_rmb": 21.75,
      "success_rate_24h": 95,
      "avg_response_seconds": 0,
      "stats_source": "estimate",
      "is_active": true
    }
  ]
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 按次 / 按秒计费的模型返回 `user_price_rmb`: 本接口不带任何参数, 所以这是按该模型默认参数 (默认时长 / 分辨率等) 跑一单的总价, 按秒模型也不是每秒价 (按秒卡另带 `billed_seconds` 即该默认参数下的计费秒数, 总价 ÷ 它 = 每秒价); 要某个时长、分辨率下的准确价请用 POST /v1/pricing-estimate。按 token 的返回 `user_price_per_million_{input,output}_rmb`。
> stats_source=live 时成功率与耗时是近 24 小时实测; =estimate 时尚无足够样本, success_rate_24h 是默认值 95、avg_response_seconds 为 0, 不要拿来比较渠道。
> 价格已含你所属代理的加价, 与「模型价格」页 / 实际扣费同源; 余额、套餐等实时因素仍以控制台为准。

相关说明: 计费与估价

### 账户与文件

余额 · 用量 · 上传文件换公网地址

#### 查询余额 — `GET /v1/skills/balance`

- 分组: 账户与文件 · 需鉴权
- 当前密钥所属账户的钱包余额: balance (总额) / frozen (进行中异步任务的预冻结) / available_balance (可用 = 总额 − 冻结)。调用付费接口前先查; 可用余额不够整单预冻结额时提交会返回 402。

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/balance" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "balance": "$12.345678",
  "frozen": "$0.500000",
  "available_balance": "$11.845678",
  "currency": "USD",
  "unit": "USD",
  "credits": {
    "balance": 88.888882,
    "frozen": 3.6,
    "available": 85.288882,
    "unit": "CREDIT",
    "per_usd": 7.2
  }
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> 两套口径同时给: 顶层 balance / frozen / available_balance 是账本的**美元**串 (带 $ 前缀、6 位小数, 解析时去掉前缀); credits 块是**站内展示的 ⚡ 算力**数值 (⚡ = 人民币口径 = 美元 × credits.per_usd)。要跟网页/账单上的数字对上, 用 credits 块。
> 余额有约 5 秒的缓存: 同一把密钥 5 秒内重复查, 拿到的是同一份数据 (命中时响应带 Age 头, 表示已过去的秒数)。
> 第三方格式兼容 (同一可用余额): new-api 类中转站可用 GET /v1/dashboard/billing/subscription 与 /v1/dashboard/billing/usage (美元); 按「硅基流动」渠道接入的程序可用 GET /v1/user/info, data.totalBalance 为可用 ⚡。

相关说明: 计费与估价 · 速率限制

#### 消费明细 (按次成本) — `GET /v1/skills/usage`

- 分组: 账户与文件 · 需鉴权
- 当前密钥所属账户的账户流水, 按时间倒序分页。每条含 type、request_id、模型、渠道代号、花费 (⚡ 与美元双口径), 部分文字调用另带 token 数 —— 用于按次核算成本、对账、给下游定价。口径与网页端「消费记录」完全一致: 除模型扣费与退款外, 还会出现失败退回、进行中的预扣、签到奖励、存储月卡购买等记录, 只算模型花费时请按 type 过滤 (见下方说明)。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `size` | query | integer | 否 | 每页条数 1–100, 默认 20; 超出范围按 20 处理 |
| `cursor` | query | string | 否 | 上一页返回的 next_cursor; 不传 = 第一页 |
| `start` | query | string | 否 | 起始日期 YYYY-MM-DD (含当天, 按北京时间 UTC+8 自然日); 格式不对时忽略此条件 |
| `end` | query | string | 否 | 结束日期 YYYY-MM-DD (含当天, 按北京时间 UTC+8 自然日); 格式不对时忽略此条件 |
| `type` | query | string | 否 | 按记录类型精确过滤, 如 usage (扣费) / refund (退款) / unfreeze (失败退回) / freeze (进行中的预扣) / checkin_bonus (签到奖励) / subscription (存储月卡购买); 不传 = 网页端消费明细同一口径, 以上各类都会出现; 传不存在的类型返回空列表 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/usage?size=20&start=2026-09-01" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "data": [
    {
      "request_id": "58c24fe6-6564-495b-b80a-db0950e403f6",
      "created_at": "2026-09-29T08:59:39Z",
      "type": "usage",
      "model": "seedance-2-0-promo",
      "channel": "ZQI",
      "cost": {
        "credits": -3.000298,
        "usd": -0.416708,
        "unit": "CREDIT",
        "per_usd": 7.2
      }
    },
    {
      "request_id": "a45207ea-659f-4345-8fa3-727ec080fc0d",
      "created_at": "2026-09-24T03:55:20Z",
      "type": "subscription",
      "feature": "storage_subscription",
      "cost": { "credits": -9.9, "usd": -1.375, "unit": "CREDIT", "per_usd": 7.2 }
    },
    {
      "created_at": "2026-09-23T02:34:53Z",
      "type": "checkin_bonus",
      "cost": { "credits": 1.000001, "usd": 0.138889, "unit": "CREDIT", "per_usd": 7.2 }
    }
  ],
  "next_cursor": "MTc5MTQyODkyOTM4Njc4MzAwMHw…"
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> **金额带符号**: 负 = 扣费 (钱离开账户: 模型扣费、进行中的预扣、存储月卡购买), 正 = 退款 (钱回到账户: 退款、失败退回, 也包括签到奖励这类赠送)。不要取绝对值。只算模型净花费时, 只对 type 为 usage / refund / unfreeze 的行求和 (或分别用 type 参数查); 不加过滤直接求和得到的是账户净流水, 会把签到奖励算成少花、把月卡购买算进消费。
> 功能类消费 (如存储月卡) 没有 model / channel, 改带 feature 字段标明是哪项功能; 签到奖励等赠送记录没有 request_id。
> model 返回的是平台内部模型名, 写法可能与模型广场展示的名称不同。
> 两套口径同时给: cost.credits 是站内展示的 ⚡ 算力 (⚡ = 人民币口径), cost.usd 是账本美元, per_usd 是两者的换算率。要跟网页/账单对上用 credits。
> channel 是**渠道代号**, 与账单页「模型名 · 代号」中的代号一致, 不是上游厂商名称。
> 翻页: 响应里有 next_cursor 就带着它请求下一页, 字段消失即到底。异步任务进行中时先显示为一条 type=freeze 的预扣行, 结算后换成实际扣费 (usage) 或退回 (unfreeze)。
> tokens 字段有则返回: 只有按 token 结算的文字调用才带, 目前多数记录 (包括多数文字模型调用) 都没有 —— 核算成本请以 cost 为准, 不要依赖 tokens。

相关说明: 计费与估价 · 速率限制

#### 查询余额 (cc-switch 兼容) — `GET /v1/user/balance`

- 分组: 账户与文件 · 需鉴权
- 给 cc-switch 等客户端查余额用的精简格式: balance 是当前密钥所属账户的**可用余额**, 单位 ⚡ 算力 (= 总额 − 进行中异步任务的预冻结), 与「查询余额」接口 credits.available 是同一个数。只要一个数字时用它; 要总额、冻结额或美元口径请用 GET /v1/skills/balance。

请求示例:
```bash
curl "https://121481.token6688.com/v1/user/balance" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例:
```json
{
  "is_active": true,
  "balance": 85.288882,
  "currency": "CNY",
  "unit": "CREDIT"
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

> balance 是 JSON 数字 (⚡ 算力, 人民币口径); currency / unit 是说明字段, 固定为 CNY / CREDIT。is_active 恒为 true: 密钥无效、已停用或账号被封时直接返回 401, 不会返回 is_active=false; 余额暂时查不到时返回 502 balance_unavailable, 不会返回 0。
> cc-switch 用法: 供应商的用量查询选「通用」模板, 它请求 {{baseUrl}}/user/balance 并读取 balance。① 模板脚本把单位写死成 "USD", 请把脚本里的 unit: "USD" 改成 unit: "CNY", 否则 ⚡ 余额会被标成美元; ② 供应商地址没带 /v1 时 (Claude Code 类供应商常见), 把脚本里的 url 改成 {{baseUrl}}/v1/user/balance。
> 与「查询余额」共用账户类限流与约 5 秒缓存。

相关说明: 计费与估价 · 速率限制

#### 上传文件换公网 URL — `POST /v1/files`

- 分组: 账户与文件 · 需鉴权
- 把本地图片 / 视频 / 音频 / 文档上传成公网可访问的 URL, 再作为参考素材或附件传给模型。multipart/form-data, 字段名 file, 单文件 ≤ 50MB。按显式白名单收: 图 jpg/png/webp/gif/heic · 视频 mp4/webm/mov · 音频 mp3/wav/m4a · 文档 PDF / Word (doc、docx) / Excel (仅 xlsx) / txt / md / csv / json; 名单外类型 (如 bmp/svg/xls) 返回 400 并在错误信息里列出允许清单。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `file` | form | binary | 是 | 文件本体 (白名单见上方描述)。类型识别顺序: 文件段的 Content-Type → 文件名后缀 → 文件内容特征; 不设 Content-Type 也能识别 |
| `purpose` | form | string | 否 | 用途标记, 可省略 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/files" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@./reference.png"
```

响应示例:
```json
{
  "id": "file-1759893159123-42",
  "object": "file",
  "filename": "reference.png",
  "content_type": "image/png",
  "bytes": 482113,
  "created_at": 1755511200,
  "url": "https://cdn.example.com/uploads/…/reference.png"
}
```

> `url` 指向平台存储 (不是本站 /v1/files 路径), 可直接放进 images / videos / audios / attachments 这类参数; 需要长期可达请自行托管。存储失败时返回体照常回来, 只是没有 `url` —— 此时重传一次。
> 成功返回 HTTP 201。超过 50MB 返回 413 (file_too_large); 缺少 file 字段返回 400; 密钥没有开通「文件」权限返回 403。

相关说明: 参考素材

### 兼容写法

已按其它平台接口写好的代码, 换成本站地址和你的 API 密钥就能调用。按来源分 OpenAI 兼容、Anthropic 兼容、new-api 兼容、火山方舟兼容; 新接入建议用各分组的主入口。

> 其它写法: 老 SDK / 工具链只会调旧版文本补全时用它; 新代码请用 POST /v1/chat/completions。

#### 文本补全 (GT 旧版写法) — `POST /v1/completions`

- 分组: 兼容写法 · 其它写法 · 需鉴权
- 旧版文本补全接口, 给还在用它的老 SDK 与工具链: 平台把 prompt 作为一条用户消息转给对话接口, 鉴权与计费与 POST /v1/chat/completions 相同, 返回旧版形状 (choices[].text)。stream=true 时按 SSE 逐段返回, 每段的 choices[].text 是新增文字, 以 data: [DONE] 结束; 中途出错时先发一段带 error 的数据再结束。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 对话模型 ID |
| `prompt` | body | string | array | 是 | 输入文字; 也可传只含一条字符串的数组, 多于一条返回 400 (不支持一次提交多条) |
| `max_tokens / temperature / top_p / stop / presence_penalty / frequency_penalty / user` | body | number / string / array | 否 | 原样转给对话接口。类型: max_tokens 整数; temperature、top_p、presence_penalty、frequency_penalty 数字; stop 字符串或字符串数组; user 字符串 |
| `stream` | body | boolean | 否 | true 时按 SSE 流式返回 |
| `stream_options.include_usage` | body | boolean | 否 | 流式时在结束前多发一段只带 usage 的数据 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gt-5.6-sol",
    "prompt": "写一句中秋祝福:",
    "max_tokens": 64
  }'
```

响应示例:
```json
{
  "id": "chatcmpl-…",
  "object": "text_completion",
  "created": 1789342093,
  "model": "gt-5.6-sol",
  "choices": [
    { "index": 0, "text": "月圆人团圆, 中秋快乐!", "logprobs": null, "finish_reason": "stop" }
  ],
  "usage": { "prompt_tokens": 12, "completion_tokens": 14, "total_tokens": 26 }
}
```

> suffix、n、echo、logprobs、best_of 不生效: 收到不报错, 但不会转给模型。
> 本写法不转发调度策略请求头 X-Schedule-Strategy, 也不收 lane_id; 要指定调度策略或渠道请用 POST /v1/chat/completions。

相关说明: 认证与地址 · 计费与估价 · 错误码

### Skill 机读接口

给 AI 编程工具读的接口目录与调用说明

#### 平台接口路由表 (自描述) — `GET /v1/skills`

- 分组: Skill 机读接口 · 公开接口
- 平台主要接口的分类目录: 6 类 (模型查询 / 调用说明 / 任务管理 / 账户信息 / 语言模型 / 媒体生成) 共 18 个接口, 每个带 id / name / method / path / description, 部分带参数说明 (params)、使用场景 (when_to_use) 或是否需要密钥 (auth_required)。它覆盖常用入口但不是完整清单 (例如不含图片编辑、查询任务结果), 完整列表以本文档为准; 名称与说明目前只有中文 (不随 Accept-Language 切换)。SKILL.md 每次新对话第一步就是它。公开接口。

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills"
```

响应示例:
```json
{
  "platform": "TokenGo",
  "version": "2026-10-08",
  "auth": { "method": "bearer", "header": "Authorization", "format": "Bearer {api_key}" },
  "base_url": "https://121481.token6688.com",
  "categories": [
    {
      "id": "models",
      "name": "模型查询",
      "endpoints": [
        {
          "id": "list_models",
          "method": "GET",
          "path": "/v1/skills/models",
          "name": "获取模型列表",
          "description": "按类型查询所有可用模型, 含 display_name / type / tags / supported_vendors.",
          "params": [
            {"name": "type", "type": "string", "required": false, "enum": ["chat", "image", "video", "audio", "embed", "rerank"], "description": "按模型类型筛选, 不传返回全部"},
            {"name": "vendor", "type": "string", "required": false, "description": "按 supported_vendors 返回的 vendor 代号筛选, 不传返回全部"}
          ],
          "when_to_use": "用户想知道有哪些模型可用, 或选择模型时"
        },
        {"id": "model_detail", "method": "GET", "path": "/v1/skills/models/{model_name}"},
        {"id": "model_pricing", "method": "GET", "path": "/v1/skills/models/{model_name}/pricing"},
        {"id": "pricing_estimate", "method": "POST", "path": "/v1/pricing-estimate"}
      ]
    },
    {
      "id": "calling",
      "name": "调用说明",
      "endpoints": [
        {"id": "guide", "method": "GET", "path": "/v1/skills/guide"}
      ]
    },
    {
      "id": "task",
      "name": "任务管理",
      "endpoints": [
        {"id": "task_status", "method": "GET", "path": "/v1/skills/task-status"},
        {"id": "task_detail", "method": "GET", "path": "/v1/tasks/{task_id}"},
        {"id": "runtime_task", "method": "GET", "path": "/api/v1/model-runtime/tasks/{task_id}"}
      ]
    },
    {
      "id": "account",
      "name": "账户信息",
      "endpoints": [
        {"id": "balance", "method": "GET", "path": "/v1/skills/balance"},
        {"id": "usage", "method": "GET", "path": "/v1/skills/usage"},
        {"id": "upload_file", "method": "POST", "path": "/v1/files"}
      ]
    },
    {
      "id": "chat_api",
      "name": "语言模型调用",
      "endpoints": [
        {"id": "openai_chat", "method": "POST", "path": "/v1/chat/completions"},
        {"id": "responses", "method": "POST", "path": "/v1/responses"},
        {"id": "messages", "method": "POST", "path": "/v1/messages"}
      ]
    },
    {
      "id": "media_api",
      "name": "媒体生成",
      "endpoints": [
        {"id": "media_generate", "method": "POST", "path": "/v1/media/generate"},
        {"id": "image_sync", "method": "POST", "path": "/v1/images/generations"},
        {"id": "video_sync", "method": "POST", "path": "/v1/videos/generations"},
        {"id": "unified_invoke", "method": "POST", "path": "/api/v1/model-runtime/invoke"}
      ]
    }
  ]
}
```

> 示例只把第一个接口 (list_models) 的字段全部展开; 其余 17 个接口实际同样带 name 与 description, 部分带 params / when_to_use / auth_required。

#### 通用调用说明 — `GET /v1/skills/guide`

- 分组: Skill 机读接口 · 公开接口
- 机器可读的调用手册: 鉴权方式、3 步接入、7 种调用模式 (对话 chat / Responses responses / Messages messages / 统一媒体 media / 扁平视频 video_flat / 同步图片 image_sync / 异步图片 image_async) 各自的端点 + 请求示例 + 轮询流程 + tips。SKILL.md 启动时会拉这份。中英文按 Accept-Language 头返回。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `Accept-Language` | header | string | 否 | 首选语言为 zh* (或不传) 返回中文; 其它 (如 en-US) 返回英文 |

请求示例:
```bash
curl "https://121481.token6688.com/v1/skills/guide" \
  -H "Accept-Language: zh-CN"
```

响应示例:
```json
{
  "platform": "TokenGo",
  "version": "2026-10-08",
  "base_url": "https://121481.token6688.com",
  "auth": { "method": "bearer", "header": "Authorization", "format": "Bearer {api_key}" },
  "quick_start": {
    "title": "3 步接入 (GT 兼容, 换 base_url 即可)",
    "steps": [
      "1. 把你现有 GT 兼容 SDK 的 base_url 改成 https://121481.token6688.com/v1",
      "2. 把 api_key 换成本平台创建的 sk- 密钥",
      "3. model 字段填目标模型 ID (用 /v1/skills/models 查), 其余请求体保持 GT 兼容格式原样"
    ],
    "note": "…"
  },
  "call_modes": [
    {"id": "chat", "format": "openai", "method": "POST", "endpoint": "https://121481.token6688.com/v1/chat/completions", "request_example": {"body": {"messages": [{"content": "你好", "role": "user"}], "model": "gt-5.4"}}},
    {"id": "responses", "format": "responses", "method": "POST", "endpoint": "https://121481.token6688.com/v1/responses", "request_example": {"body": {"input": "你好", "model": "gt-5.4"}}},
    {"id": "messages", "format": "messages", "method": "POST", "endpoint": "https://121481.token6688.com/v1/messages", "request_example": {"body": {"max_tokens": 1024, "messages": [{"content": "你好", "role": "user"}], "model": "cl-fable-5"}}},
    {
      "id": "media",
      "format": "async-task",
      "method": "POST",
      "endpoint": "https://121481.token6688.com/v1/media/generate",
      "poll": {
        "endpoint": "https://121481.token6688.com/v1/skills/task-status?task_id={task_id}",
        "alt_endpoint": "https://121481.token6688.com/v1/tasks/{task_id}",
        "interval_sec": 3,
        "max_wait_min": 60,
        "terminal_flag": "is_final"
      }
    },
    {"id": "video_flat", "format": "async-task", "method": "POST", "endpoint": "https://121481.token6688.com/v1/videos/generations"},
    {"id": "image_sync", "format": "openai", "method": "POST", "endpoint": "https://121481.token6688.com/v1/images/generations"},
    {"id": "image_async", "format": "openai", "method": "POST", "endpoint": "https://121481.token6688.com/api/v1/model-runtime/invoke"}
  ],
  "tips": [{ "title": "…", "description": "…" }]
}
```

## 模型专属调用写法

### 火山方舟官方写法

- 已经按火山方舟官方 SDK 或文档写好的代码, 只需换地址和密钥。参数放在请求体顶层, 提示词和素材放在 content 里。
- 结果地址字段: `content.video_url`

#### Seedance 官方直连 (火山方舟官方写法) — `POST /api/v3/contents/generations/tasks`

- 分组: 火山方舟官方写法
- 按火山方舟官方 SDK / 文档对接的代码可直接使用官方路径与字段: 参数与 content 素材放在请求体顶层, 模型名与档位同「Seedance 官方直连 (new-api 写法)」。/v1/contents/generations/tasks 与本路径等价。查询走 GET /api/v3/contents/generations/tasks/{id}, 响应为官方格式。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 官方型号, 见本页「官方型号」对照表 (与 new-api 写法相同) |
| `content` | body | array | 是 | 官方 content 数组: type=text 为提示词, 其余素材规则同 new-api 写法的 metadata.content |
| `resolution / ratio / duration / generate_audio / return_last_frame / execution_expires_after / safety_identifier / priority / tools` | body | per-field | 否 | 放在顶层, 取值与默认值同 new-api 写法的 metadata 字段 (含 duration=-1 自动时长) |

请求示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```bash
curl "https://121481.token6688.com/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "content": [
      { "type": "text", "text": "海边日落, 镜头缓缓推近" },
      { "type": "image_url", "image_url": { "url": "https://your-host.com/first.jpg" }, "role": "first_frame" }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "generate_audio": true
  }'
```

响应示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```json
{
  "id": "task-1789396658482-2",
  "task_id": "task-1789396658482-2",
  "object": "video",
  "status": "pending"
}
```

请求示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```bash
curl "https://121481.token6688.com/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-5-260628",
    "content": [
      { "type": "text", "text": "海边日落, 镜头缓缓推近" },
      { "type": "image_url", "image_url": { "url": "https://your-host.com/first.jpg" }, "role": "first_frame" }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "generate_audio": true
  }'
```

响应示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```json
{
  "id": "task-1789396658482-2",
  "task_id": "task-1789396658482-2",
  "object": "video",
  "status": "pending"
}
```

> 读响应里的 id 作为任务 ID 即可 (官方 SDK 正是读它); 计费、素材限制与不支持参数同 new-api 写法。

相关说明: 异步任务流程 · 参考素材 · 计费与估价 · 防重复提交 · 完成回调

#### 查询 Seedance 官方直连任务 (火山方舟官方写法) — `GET /api/v3/contents/generations/tasks/{id}`

- 分组: 火山方舟官方写法
- 火山方舟官方格式的任务查询, 字段与官方「查询视频生成任务」同名同义: status 为 queued / running / succeeded / failed; 成功后视频地址在 content.video_url, 尾帧图在 content.last_frame_url (请求开了 return_last_frame 且该线路提供时), 顶层 video_url 是平台 CDN 地址; 失败原因在 error。成片转存到平台 CDN 后才会报 succeeded。/v1/contents/generations/tasks/{id} 与本路径等价。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | string | 是 | 提交时返回的 id |

请求示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```bash
curl "https://121481.token6688.com/api/v3/contents/generations/tasks/task-1789396658482-2" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```json
{
  "id": "task-1789396658482-2",
  "model": "doubao-seedance-2-0-260128",
  "status": "succeeded",
  "content": {
    "video_url": "https://ark-origin.example.com/…/result.mp4",
    "last_frame_url": "https://cdn.example.com/…/last.jpg"
  },
  "video_url": "https://cdn.example.com/…/result.mp4",
  "duration": 5,
  "usage": { "completion_tokens": 87300, "total_tokens": 87300 },
  "created_at": 1789396658,
  "updated_at": 1789396902,
  "error": null
}
```

请求示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```bash
curl "https://121481.token6688.com/api/v3/contents/generations/tasks/task-1789396658482-2" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```json
{
  "id": "task-1789396658482-2",
  "model": "doubao-seedance-2-5-260628",
  "status": "succeeded",
  "content": {
    "video_url": "https://ark-origin.example.com/…/result.mp4",
    "last_frame_url": "https://cdn.example.com/…/last.jpg"
  },
  "video_url": "https://cdn.example.com/…/result.mp4",
  "duration": 5,
  "usage": { "completion_tokens": 87300, "total_tokens": 87300 },
  "created_at": 1789396658,
  "updated_at": 1789396902,
  "error": null
}
```

> content.video_url 有火山方舟官方原链时给原链, 与官方一样 24 小时内有效 (Seedance 2.5 每条限下载 100 次), 没有原链或已过期时给平台地址; 长期保存请用顶层 video_url (平台 CDN 地址)。
> 只返回平台有来源的字段: model 回显提交时填的型号, duration 在线路报了成片时长时才有, usage (token 用量 completion_tokens / total_tokens) 在线路返回时才有。官方的 seed / resolution / ratio / framespersecond / generate_audio / service_tier / execution_expires_after 等字段目前不返回, 读取前请判断字段是否存在。
> 失败时 status=failed, error 为 {code, message}, code 是平台的错误分类 (不是火山方舟的错误码); 其余状态 error 为 null。失败不扣费, 提交时冻结的金额自动退回。

相关说明: 异步任务流程 · 错误码

### new-api 写法

- 已经按 new-api 视频接口写好的代码, 只需换地址和密钥。扩展参数和素材放在 metadata 里, 字段名与火山方舟官方相同。
- 结果地址字段: `metadata.url`

#### Seedance 官方直连 (new-api 写法) — `POST /v1/video/generations`

- 分组: new-api 写法
- 按 new-api 视频接口写法调用 Seedance 官方直连: 档位由模型名决定 (官方型号见「官方型号」对照表), 扩展参数与素材放在 metadata 里, 字段与火山方舟官方同名同义。已按这种写法对接的代码只需替换域名和密钥。始终异步: 返回 task_id 后轮询 GET /v1/video/generations/{task_id}。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | body | string | 是 | 官方型号, 见本页「官方型号」对照表 |
| `prompt` | body | string | 否 | 视频描述; 可用「图片1 / 视频1 / 音频1」按同类素材出现顺序指代 metadata.content 里的素材 |
| `image` | body | string | 否 | 图生视频的首帧图 (公网 URL), 等价于 content 里一张 role=first_frame 的图 |
| `seconds` | body | string / number | 否 | 时长 (秒); 与 metadata.duration 同时传时以 metadata.duration 为准 |
| `metadata.content` | body | array | 否 | 素材数组, 每项 {type, <type>: {url}, role}: image_url (role = first_frame / last_frame / reference_image)、video_url (role = reference_video)、audio_url (role = reference_audio); 每种最多几个见模型文档页的「参考素材上限」表; type=text 的项并入 prompt。地址用公网 URL (也支持 data: base64 内联) |
| `metadata.resolution` | body | string | 否 | 清晰度, 每个官方型号能选哪几档见「官方型号」对照表; 默认 720p |
| `metadata.ratio` | body | string | 否 | 16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 21:9 / adaptive (跟随参考图比例, 需传参考图), 默认 16:9 |
| `metadata.duration` | body | integer | 否 | 时长 (秒), 可选范围见模型文档页参数表的 duration; 默认 5。传 -1 = 让模型自选时长: 先按所选模型卡的最长时长冻结 (2.0 为 15 秒、2.5 为 30 秒), 只派给会回报实际时长的方舟原生线路, 出片后按线路回报的实际秒数结算 |
| `metadata.execution_expires_after / safety_identifier / priority / tools` | body | integer / string / integer / array | 否 | 火山方舟官方同名字段 (任务超时秒数 / 终端用户标识 / 执行优先级 / 工具配置, 如 tools=[{"type":"web_search"}] 联网搜索): 传了就只派给支持该字段的线路并原样转交; 等于官方默认值 (execution_expires_after=172800、priority=0) 或空数组视为没传 |
| `metadata.generate_audio` | body | boolean | 否 | 是否生成同步音频 (人声 / 音效 / 背景音乐), 默认 true |
| `metadata.return_last_frame` | body | boolean | 否 | 额外返回成片最后一帧图片 (接镜续拍用), 不额外收费; 部分线路不提供 |
| `callback_url / client_request_id` | body | string | 否 | 完成回调地址 / 防重复提交键, 见「完成回调」「防重复提交」 |

请求示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```bash
curl "https://121481.token6688.com/v1/video/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "第一人称视角果茶宣传广告, 全程使用音频1作为背景音乐",
    "metadata": {
      "resolution": "480p",
      "ratio": "16:9",
      "duration": 6,
      "generate_audio": true,
      "content": [
        { "type": "video_url", "video_url": { "url": "https://your-host.com/ref.mp4" }, "role": "reference_video" },
        { "type": "image_url", "image_url": { "url": "https://your-host.com/ref.jpg" }, "role": "reference_image" },
        { "type": "audio_url", "audio_url": { "url": "https://your-host.com/bgm.mp3" }, "role": "reference_audio" }
      ]
    }
  }'
```

响应示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```json
{
  "id": "task-1789342093065-23090",
  "task_id": "task-1789342093065-23090",
  "object": "video",
  "model": "doubao-seedance-2-0-260128",
  "status": "queued",
  "progress": 0,
  "created_at": 1789342093
}
```

请求示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```bash
curl "https://121481.token6688.com/v1/video/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-5-260628",
    "prompt": "第一人称视角果茶宣传广告, 全程使用音频1作为背景音乐",
    "metadata": {
      "resolution": "480p",
      "ratio": "16:9",
      "duration": 6,
      "generate_audio": true,
      "content": [
        { "type": "video_url", "video_url": { "url": "https://your-host.com/ref.mp4" }, "role": "reference_video" },
        { "type": "image_url", "image_url": { "url": "https://your-host.com/ref.jpg" }, "role": "reference_image" },
        { "type": "audio_url", "audio_url": { "url": "https://your-host.com/bgm.mp3" }, "role": "reference_audio" }
      ]
    }
  }'
```

响应示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```json
{
  "id": "task-1789342093065-23090",
  "task_id": "task-1789342093065-23090",
  "object": "video",
  "model": "doubao-seedance-2-5-260628",
  "status": "queued",
  "progress": 0,
  "created_at": 1789342093
}
```

> 首帧 / 尾帧不能与参考素材混用: 带了 first_frame / last_frame 时不要再传参考图、参考视频或参考音频 (官方模型限制)。素材数量与参考视频、参考音频的时长上限见模型文档页的「参考素材上限」表。
> 2.x 不支持、传了会被忽略 (不报错) 的官方字段: camera_fixed=true、frames、service_tier=flex (火山方舟只对 1.0 系列开放); output_format (含 mov) 暂不支持, 同样忽略, 成片统一以 mp4 交付。tools (联网搜索) 转发给支持的线路, 搜索是否生效由上游决定, 按普通价计费; 上游回传搜索用量时随 usage 返回 (usage.tool_usage)。等于官方默认值的参数 (camera_fixed=false、service_tier=default、priority=0、output_format=mp4、execution_expires_after=172800) 视为没传。draft (先出样片) 是否生效以模型文档页的参数表为准, 不支持的卡会忽略它; watermark 统一按不加水印处理; seed 会转交给支持该字段的线路, 但不保证同一 seed 出相同画面。
> 写实人物参考图直接传 URL 即可, 平台内置素材库会自动处理, 无需提前上传。
> 参考视频每段不足 3 秒按 3 秒计。估价时 `model` 填模型卡 ID (不是官方型号), 档位等参数放在 `params` 里, 其余与提交时相同。
> 若密钥设置了可用模型白名单, 需把所用的官方直连模型卡加入白名单, 否则返回 403。

相关说明: 异步任务流程 · 参考素材 · 计费与估价 · 防重复提交 · 完成回调

#### 查询 Seedance 官方直连任务 (new-api 写法) — `GET /v1/video/generations/{task_id}`

- 分组: new-api 写法
- 查询用「Seedance 官方直连 (new-api 写法)」提交的任务, 响应为 new-api 形状: status 为 queued / in_progress / completed / failed, 完成后视频地址在 metadata.url。成片转存到平台 CDN 后才会报 completed, 所以拿到 completed 时 metadata.url 一定可以直接下载。完成时 metadata 里还带一份火山方舟官方格式的任务对象, 字段与「查询 Seedance 官方直连任务 (火山方舟官方写法)」的响应相同。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 提交时返回的 id / task_id |

请求示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```bash
curl "https://121481.token6688.com/v1/video/generations/task-1789342093065-23090" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例 (模型卡 `seedance-2-0-official`, model 填 `doubao-seedance-2-0-260128`):
```json
{
  "id": "task-1789342093065-23090",
  "task_id": "task-1789342093065-23090",
  "object": "video",
  "model": "doubao-seedance-2-0-260128",
  "status": "completed",
  "progress": 100,
  "created_at": 1789342093,
  "completed_at": 1789342251,
  "metadata": {
    "url": "https://cdn.example.com/…/result.mp4",
    "last_frame_url": "https://cdn.example.com/…/last.jpg",
    "id": "task-1789342093065-23090",
    "model": "doubao-seedance-2-0-260128",
    "status": "succeeded",
    "content": {
      "video_url": "https://ark-origin.example.com/…/result.mp4",
      "last_frame_url": "https://cdn.example.com/…/last.jpg"
    },
    "video_url": "https://cdn.example.com/…/result.mp4",
    "duration": 6,
    "usage": { "completion_tokens": 93366, "total_tokens": 93366 },
    "created_at": 1789342093,
    "updated_at": 1789342251,
    "error": null
  }
}
```

请求示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```bash
curl "https://121481.token6688.com/v1/video/generations/task-1789342093065-23090" \
  -H "Authorization: Bearer $API_KEY"
```

响应示例 (模型卡 `seedance-2-5`, model 填 `doubao-seedance-2-5-260628`):
```json
{
  "id": "task-1789342093065-23090",
  "task_id": "task-1789342093065-23090",
  "object": "video",
  "model": "doubao-seedance-2-5-260628",
  "status": "completed",
  "progress": 100,
  "created_at": 1789342093,
  "completed_at": 1789342251,
  "metadata": {
    "url": "https://cdn.example.com/…/result.mp4",
    "last_frame_url": "https://cdn.example.com/…/last.jpg",
    "id": "task-1789342093065-23090",
    "model": "doubao-seedance-2-5-260628",
    "status": "succeeded",
    "content": {
      "video_url": "https://ark-origin.example.com/…/result.mp4",
      "last_frame_url": "https://cdn.example.com/…/last.jpg"
    },
    "video_url": "https://cdn.example.com/…/result.mp4",
    "duration": 6,
    "usage": { "completion_tokens": 93366, "total_tokens": 93366 },
    "created_at": 1789342093,
    "updated_at": 1789342251,
    "error": null
  }
}
```

> 失败时 status=failed, error 为 {code, message}; 失败不扣费, 提交时冻结的金额自动退回。metadata.last_frame_url 仅在请求开了 return_last_frame 且该线路提供时出现。
> metadata.url 与 metadata.video_url 都是平台 CDN 地址, 长期保存用它们。metadata.content.video_url 有火山方舟官方原链时给原链, 与官方一样 24 小时内有效 (Seedance 2.5 每条限下载 100 次), 没有原链或已过期时给平台地址。metadata.status 用的是方舟的状态词 (succeeded), 判断任务状态请读顶层 status。
> metadata 里的方舟任务对象只带平台有来源的字段: usage (token 用量) 在线路返回时才有; 官方的 seed / resolution / ratio / framespersecond / generate_audio / service_tier / execution_expires_after 等字段目前不返回, 读取前请判断字段是否存在。
> 本页形状只适用于用 new-api 写法提交的任务; 其它任务在同一路径上仍返回平台默认形状 (见 GET /v1/tasks/{task_id})。

相关说明: 异步任务流程 · 错误码

官方型号对照:

| 模型卡 | 档位 | model 填 | 清晰度 |
|---|---|---|---|
| `seedance-2-0-official` | 标准 | `doubao-seedance-2-0-260128` | 480P – 4K |
| `seedance-2-0-official` | Fast | `doubao-seedance-2-0-fast-260128` | 480P / 720P |
| `seedance-2-0-official` | Mini | `doubao-seedance-2-0-mini-260615` | 480P / 720P |
| `seedance-2-5` | 标准 | `doubao-seedance-2-5-260628` | 480P / 720P / 1080P |

点号、横杠写法与官方带日期的型号都可以, 不区分大小写。

## speech-2.8 · 我的声纹库

`speech-2.8` 是公开逻辑模型名。先上传参考音频并等待声纹就绪，再把声纹对象用于语音生成；音质、速度继续使用该模型已有的 `version`、`tier` 等参数。

同步 `POST /v1/audio/speech` 直接返回音频二进制；异步 `POST /v1/audio/speech/async` 返回任务，完成后通过 `GET /v1/tasks/{task_id}` 返回平台 CDN 公网 URL。两种方式使用相同的 `model`、`voice`、`input` 和 `response_format`。

**参数映射**: `speech.model = voice.model`，`speech.voice = voice.id`。

### 上传字段与限制

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | MP3 / M4A / WAV；时长 10–300 秒（含边界）；文件必须严格小于 20 MiB |
| `model` | 是 | 当前只接受 `speech-2.8` |
| `name` | 是 | 去除首尾空格后 1–50 字符 |
| `preview_text` | 否 | 最多 300 字符 |

上传接口只接受 `multipart/form-data` 和本地文件内容，不接受 JSON 或外部 URL；可用 `Idempotency-Key` 安全重放同一请求。

### 1. 上传参考音频

`POST /v1/audio/voices` — 使用 multipart/form-data 上传音频，接口返回可轮询的 task_id。

```bash
curl -X POST "https://121481.token6688.com/v1/audio/voices" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Idempotency-Key: voice-upload-001" \
  -F "file=@./voice-sample.mp3" \
  -F "model=speech-2.8" \
  -F "name=我的声音" \
  -F "preview_text=欢迎使用我的专属声音。"
```

响应示例：

```text
{
  "id": "omfvc0f3a9c2e7b1d4a6c8e5b",
  "status": "processing",
  "task_id": "task_your_clone_task_id"
}
```

### 2. 查询我的声纹列表

`GET /v1/audio/voices` — 只返回当前 API Key 用户已完成的自定义声纹，支持模型筛选和游标分页。

```bash
curl "https://121481.token6688.com/v1/audio/voices?model=speech-2.8&limit=20" \
  -H "Authorization: Bearer sk-xxx"
```

响应示例：

```text
{
  "object": "list",
  "data": [
    {
      "id": "omfvc0f3a9c2e7b1d4a6c8e5b",
      "name": "我的声音",
      "model": "speech-2.8",
      "status": "ready",
      "preview_url": "https://cdn.example.com/voices/preview.mp3",
      "created_at": "2026-07-30T12:00:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### 3. 查询单一声纹

`GET /v1/audio/voices/{voice_id}` — 用列表或任务结果中的 voice.id 查询同一个声纹对象。

```bash
curl "https://121481.token6688.com/v1/audio/voices/omfvc0f3a9c2e7b1d4a6c8e5b" \
  -H "Authorization: Bearer sk-xxx"
```

响应示例：

```text
{
  "id": "omfvc0f3a9c2e7b1d4a6c8e5b",
  "name": "我的声音",
  "model": "speech-2.8",
  "status": "ready",
  "preview_url": "https://cdn.example.com/voices/preview.mp3",
  "created_at": "2026-07-30T12:00:00Z"
}
```

### 4. 使用声纹生成音频（异步） · 推荐

`POST /v1/audio/speech/async` — 立即返回 task_id；任务完成后返回平台 CDN 公网 URL。

```bash
curl -X POST "https://121481.token6688.com/v1/audio/speech/async" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{
  "model": "speech-2.8",
  "voice": "omfvc0f3a9c2e7b1d4a6c8e5b",
  "input": "欢迎使用我的专属声音。",
  "response_format": "mp3"
}'
```

响应示例：

```text
{
  "id": "task_your_speech_task_id",
  "object": "audio.speech",
  "status": "pending",
  "task_id": "task_your_speech_task_id"
}
```

### 5. 使用声纹生成音频 · 不推荐

`POST /v1/audio/speech` — 同步方式：model 传 voice.model，voice 传 voice.id；成功时直接返回音频二进制。

```bash
curl -X POST "https://121481.token6688.com/v1/audio/speech" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{
  "model": "speech-2.8",
  "voice": "omfvc0f3a9c2e7b1d4a6c8e5b",
  "input": "欢迎使用我的专属声音。",
  "response_format": "mp3"
}' \
  --output speech.mp3
```

响应示例：

```text
200 OK
Content-Type: audio/mpeg

<binary audio>
```

### 6. 查询生成结果

`GET /v1/tasks/{task_id}` — 使用 audio 权限轮询；只有产物已落到平台 CDN 才会进入 completed（此前 status 保持 processing、stage=downloading 表示正在转存），completed 时可从 url、output_url、result_url、audio_url、output.url、data[0].url 或 result.audios[0].url 读取同一个平台 CDN 绝对 https 地址；未开通存储月卡时结果默认保留约 15 天, 开通后长期保留; 请及时下载或自行转存。

```bash
curl "https://121481.token6688.com/v1/tasks/task_your_speech_task_id" \
  -H "Authorization: Bearer sk-xxx"
```

响应示例：

```text
{
  "audio_url": "https://cdn.example.com/audio/speech.mp3",
  "billing": {
    "actual_cost_micro_usd": 15448
  },
  "created_at": "2026-07-31T01:37:34.9682207-05:00",
  "data": [
    {
      "type": "audio",
      "url": "https://cdn.example.com/audio/speech.mp3"
    }
  ],
  "duration_seconds": 4,
  "freeze_id": "00000000-0000-4000-8000-000000000001",
  "id": "task_your_speech_task_id",
  "is_final": true,
  "model": "speech-2.8",
  "output": {
    "type": "audio",
    "url": "https://cdn.example.com/audio/speech.mp3"
  },
  "output_url": "https://cdn.example.com/audio/speech.mp3",
  "progress": 100,
  "progress_available": true,
  "result": {
    "audios": [
      {
        "format": "mp3",
        "size": 41460,
        "url": "https://cdn.example.com/audio/speech.mp3"
      }
    ]
  },
  "result_type": "audio",
  "result_url": "https://cdn.example.com/audio/speech.mp3",
  "stage": "delivered",
  "stage_message": "已完成",
  "status": "completed",
  "type": "audio",
  "updated_at": "2026-07-31T01:37:39.5735704-05:00",
  "url": "https://cdn.example.com/audio/speech.mp3",
  "user_id": "00000000-0000-4000-8000-000000000002"
}
```

> 示例金额仅为格式演示，以价格表或估价接口为准。

### 任务失败示例

```json
{
  "id": "task_your_clone_task_id",
  "status": "failed",
  "error": {
    "code": "invalid_audio_duration",
    "message": "Audio duration must be between 10 and 300 seconds"
  }
}
```

### 稳定错误码

- `invalid_model`、`invalid_audio_format`、`file_too_large`、`invalid_name`、`invalid_preview_text`：请求校验失败（400）。
- `idempotency_conflict`：同一用户用相同幂等键提交了不同请求（409）。
- `voice_not_found`：声纹不存在、未就绪、属于其他用户或模型不兼容（404）。
- `voice_validation_unavailable`：声纹归属校验暂不可用（503）。
- `voice_clone_unavailable`：持久任务队列暂不可用（503）。
- `audio_async_unavailable`、`audio_delivery_unavailable`：异步任务或公网存储服务暂不可用（503）。
- `audio_delivery_failed`：上游音频已生成，但写入平台 CDN 失败；任务以 failed 结束且不返回空 URL。
- `invalid_audio_duration`、`invalid_audio`：音频时长越界或文件损坏；通过任务的 `failed` 状态返回。
- `insufficient_funds`：账户余额不足（克隆开始前要先预留费用）；通过任务的 `failed` 状态返回，充值后重新提交。

## 认证与限流

一把密钥调用全部接口, 以及每把密钥的请求频率上限

**要点**

- 所有接口用同一把密钥: `Authorization: Bearer <API_KEY>`。
- 接口地址就是你正在访问的站点的域名。
- 拿到 401 先确认请求头真的发出去了。
- 超频返回 429, 按 `Retry-After` 退避后重试。

### 认证与地址

- 所有接口用同一把 API 密钥。
- 密钥在「API 密钥」页创建, 只显示一次。
- 接口地址就是你正在访问的这个站点的域名, 代理商的站点显示它自己的域名。
- 文档里的示例已经替换成当前地址。

```http
Authorization: Bearer <API_KEY>
```

**密钥放在哪**

| 接口 | 请求头 |
|---|---|
| 所有接口 | `Authorization: Bearer <API_KEY>` |
| `/v1/messages` | 另外接受 `x-api-key` 请求头 |

**三种鉴权失败, 别混**

| 状态码 | code | 原因 | 先检查什么 |
|---|---|---|---|
| 401 | `missing_api_key` | 没带 Authorization | 请求头有没有真的发出去 (代理和部分 SDK 会吞掉自定义头), 再怀疑模型 |
| 401 | `invalid_api_key` | 密钥格式不对或查无此密钥 | 同上: 先确认请求头真的发出去, 再怀疑模型 |
| 403 | `insufficient_permissions` | 密钥有效但权限不含这个接口 | 这把密钥的权限是否包含这个接口 |

### 速率限制

- 每个 API 密钥有独立的每分钟请求上限。
- 上限可在「API 密钥」页查看与调整。
- 超出上限返回 429 `rate_limit_error`, 带 `Retry-After` 响应头, 按它退避后重试。
- 钉渠道时, 上游的限频会原样返回。
- 查询任务不消耗生成额度, 但计入请求频率。
- 余额、消费明细等账户查询接口 (含兼容端点) 另有独立上限: 每把密钥合计每分钟 60 次, 不占生成额度; 响应缓存约 5 秒, 数据最多滞后 5 秒。

## 异步任务

提交、查询、取结果, 以及安全重试与完成回调

**要点**

- 提交拿 `task_id`, 每 3 秒查 `GET /v1/tasks/{task_id}`。
- 以 `is_final` 判结束, 结果在 `output_url`。
- 至少查 60 分钟, 别用 2~3 分钟的超时判失败。
- 超时重试带同一个 `client_request_id`, 不会重复扣费。
- 失败不收费, 冻结的金额自动退回。

### 异步任务流程

- 视频、音乐、语音, 以及走 `/api/v1/model-runtime/invoke` 的图片, 都是异步任务。
- 提交后立即拿到任务号 `task_id`, 再用 `GET /v1/tasks/{task_id}` 查询, 直到 `is_final` 为 true。
- 判断结束用 `is_final` (或 `status` 为 `completed` / `failed`), 不要比对其它字段的文字。
- 建议每 3 秒查一次, 查询总时长设为 60 分钟以上。
- 不要用 2~3 分钟的超时判失败: 停止查询不会让任务失败, 但你会拿不到已经生成的结果。
- `status` 的全部取值见「任务查询」页。

**每种状态怎么处理**

| 状态 | 含义 | 你该怎么做 |
|---|---|---|
| `pending` / `processing` | 长时间停留多半是上游排队, 任务不会丢 | 继续查; 不要重新提交同一个任务 (会重复扣费) |
| `processing` + `stage=downloading` | 结果还在转存到平台 CDN | 继续查, 不要把中间态当结果 |
| `completed` | `output_url` 就是结果地址 (`url` / `result_url` / `data[0].url` 是同一个值), 一定是平台 CDN 上的 https 绝对地址 | 取走结果 |
| `failed` | `error` 是失败原因, `error_class` 是机器可读的分类 | 看原因; 失败不收费, 提交时冻结的金额自动退回, 不用申请退款 |
| 410 `task_expired` | 任务记录过了保留期 | 任务结束后请及时取走结果 |

**真实耗时 (2026-08 线上 48 小时实测, 提交到结束)**

| 类型 | 中位 | p90 |
|---|---|---|
| 图片 | 1~3 分钟 | 高峰可到 60 分钟 |
| 视频 | 4~40 分钟 | 55~75 分钟 |

- 网络超时想安全重试, 用「防重复提交」。

### 防重复提交

- 提交时带 `client_request_id` (不超过 128 个字符, 每单唯一)。
- 网络超时后用同一个值重试, 拿回的是同一个任务号, 不会重新冻结或扣费。
- 重放的响应带响应头 `X-Idempotent-Replay: true`。

```json
{ …, "client_request_id": "order-20261002-0001" }
```

**哪些入口支持**

| 入口 | 是否支持 |
|---|---|
| `POST /v1/videos/generations` | 支持 |
| `POST /v1/media/generate` | 支持 (视频) |
| `POST /api/v1/model-runtime/invoke` | 支持 (图片、视频、音频) |
| `POST /v1/audio/generations` | 不支持 |

### 完成回调

- 提交时带 `callback_url` (http / https 公网地址); 不接受内网和 localhost 地址。
- 任务结束 (`completed` 或 `failed`) 后, 我方向它 POST 一次任务快照, 内容与 `GET /v1/tasks/{task_id}` 的返回相同。
- 回调是尽力而为: 网关重启时还没发出的回调会丢失, 请保留低频查询兜底。

**字段与请求头**

| 字段 / 请求头 | 说明 |
|---|---|
| `callback_url` | 回调地址, http / https 公网地址 |
| `callback_secret` | 可选, 不超过 256 个字符; 不会出现在任何查询结果里 |
| `X-TokenGo-Event` | 回调请求头: `task.completed` 或 `task.failed` |
| `X-TokenGo-Signature` | 带了 `callback_secret` 才有: `sha256=<HMAC_SHA256(secret, body)>`, 用于验签 |
| 送达 | 你的服务返回 2xx 即算送达 |
| 重试 | 否则最多再重试 2 次 (5 秒、30 秒后各一次), 仍失败就放弃 |

**哪些入口支持**

| 入口 | 是否支持 |
|---|---|
| `POST /v1/videos/generations` | 支持 |
| `POST /api/v1/model-runtime/invoke` | 支持 (图片、视频、异步对话) |
| `POST /v1/media/generate` | 不解析, 发了会被忽略 |
| `POST /v1/audio/generations` | 不解析, 发了会被忽略 |
| `POST /v1/audio/speech/async` | 不解析, 发了会被忽略 |

### 账户级事件通知 (Webhook)

- 在开放平台控制台的「事件通知」页 (或网站「API 密钥」弹窗下方) 登记接收网址; 只接受 https 公网地址, 每个账户最多 10 个。登记、恢复、删除都在网页上做, API 密钥 (`sk-…`) 不能管理事件通知。
- 与上面的完成回调的区别: 完成回调只管提交时带了 `callback_url` 的那一个任务; 事件通知登记一次, 账户下所有图片 / 视频 / 音频任务都会通知, 还能通知余额不足。
- 创建时只返回一次签名密钥, 之后无法再查看, 请当场保存。
- 通知只带任务 ID 与状态, 不带结果地址; 拿结果请用 `GET /v1/tasks/{task_id}`。
- 至少送达一次: 同一事件可能收到多次, 请按 `X-TokenGo-Delivery` 去重。通知是尽力而为, 请保留低频查询兜底。

**事件**

| 事件 | 何时发送 | `data` 字段 |
|---|---|---|
| `task.completed` | 任务完成且作品已保存 | `task_id` · `type` · `model` · `status` |
| `task.failed` | 任务最终失败 (失败不收费) | `task_id` · `type` · `model` · `status` · `error_class` |
| `balance.low` | 可用余额降到你设的阈值以下; 只通知一次, 充值回到阈值以上后重新生效; 每分钟检查一次 | `available_balance` · `threshold` · `unit` |

**请求头与送达**

| 项目 | 说明 |
|---|---|
| `X-TokenGo-Event` | 事件名 |
| `X-TokenGo-Delivery` | 事件 ID, 重投时不变; 与请求体 `event_id` 相同 |
| `X-TokenGo-Signature` | `sha256=<HMAC_SHA256(secret, body)>`, 用于验签 (与完成回调同一种算法) |
| 请求体 | `{ event, event_id, occurred_at, data }` |
| 送达与重试 | 返回 2xx 即算送达, 5 秒内没响应算失败; 失败后最多再试 2 次 (间隔递增) |
| 自动暂停 | 连续 20 次最终失败自动暂停, 修好接收地址后在网页点「恢复」 |

## 计费与渠道

按实际渠道结算, 提交前先估价, 要价格确定就钉渠道

**要点**

- 按实际走的渠道结算, 失败不收费。
- 估价参数要与提交完全相同, 包括参考视频的总时长。
- 异步提交先按整单上限冻结, 完成后退回差额。
- 要价格确定就只钉一条渠道 (`lane_id`)。

### 计费与估价

- 按实际路由到的渠道结算; 失败不收费。
- 按秒渠道 = 单价 × (输出秒数 + 参考视频合计秒数); 按次渠道是固定价。
- 参考图、参考音频在部分渠道有倍率。
- 每个模型页的「计费方式」写明了哪些参数影响价格。

**提交前估价**

- 用 `POST /v1/pricing-estimate` 估价, 参数必须和提交时完全相同 (包括 `videos` / `images` / `audios` 和 `video_total_duration_sec`)。
- 带参考视频却不传各段时长之和, 估出来的价就不含参考视频。
- 例如真实客诉: 估价 ⚡4.5, 实扣 ⚡7.3 (2 段共 21 秒参考视频)。
- 实扣以服务端探测到的真实时长为准。

**估价与扣费字段**

| 字段 | 是什么 |
|---|---|
| `effective_total_rmb` | 估价响应里: 会走的那条渠道的实付价 |
| `max_effective_total_rmb` | 估价响应里: 它故障、换到备用渠道时的最高实付 |
| `price_basis` | 估价响应里: 价格构成拆分 |
| `required_freeze_rmb` | 提交异步任务时按整单上限预冻结的金额 |
| `actual_cost_micro_usd` | `GET /v1/tasks/{task_id}` 里的实扣 |

**冻结与结算**

- 提交异步任务时按整单上限预冻结 (`required_freeze_rmb`), 完成后按实际用量结算并退回差额。
- 可用余额不够整单冻结额时提交返回 402; 请保持至少一单完整费用的余额。

**API 内联素材传输费**

- API 调用在请求体里内联 base64 素材 (data URI / `input_audio` / 文件内联) 时, 按实际转发给模型厂商的素材字节另计传输费, 并在同一笔扣费里。
- 基础价 **⚡0.002/MB** (1MB = 1,048,576 字节), 实付以账单为准; 例: 一张 300KB 的截图约 ⚡0.0006。
- 素材经平台压缩后再转发的, 按压缩后的字节算; 失败不收, 网关自己的重试不重复收。
- 传公网链接, 或本地文件先 `POST /v1/files` 上传再传 url, 不收传输费; 网页端调用不收。
- 使用日志的扣费行会显示「含传输费 ⚡x (内联素材 y MB)」。

**同步接口的费用回执**

| 位置 | 字段 | 说明 |
|---|---|---|
| 响应的 `usage` | `cost_rmb` / `cost_currency` / `balance_rmb` | 本次费用和结算后余额; 各模态字段名相同 |
| 响应头 | `X-TokenGo-Cost-RMB` / `X-TokenGo-Balance-RMB` | 同样的值; HTTP 头名不区分大小写 |
| 响应头 (图片) | `X-TokenGo-Cost-Micro-USD` | 图片接口另带 |

- 以上字段只在结算成功时出现; 结算不可用时整体省略, 不会写 0 —— 写 0 会被误读成「这次免费」。

**换渠道与 retry_offer**

- 首选渠道失败 (或报价时的渠道已不可用) 时, 会换到其它能做的渠道并按其实际价结算, **可能高于本次报价**。
- 价格达到本次报价 **2 倍及以上且多出 ¥0.5 以上**的渠道不会自动换过去。
- 剩下能做的渠道都过了这条线时, 本次失败且不收费, 失败响应带 `retry_offer: { lane_id, price_rmb }`: 另一条可用渠道, 以及按它重做的价格 (⚡, 1⚡ = ¥1)。
- 同步接口在 `error.retry_offer`, 异步任务在任务的 `retry_offer`。
- 要按新价重做: 参数不变, 加上 `lane_id` = `retry_offer.lane_id` 重新提交。
- 不带 lane_id 重提会重新报价, 可能再次落到刚失败的渠道。
- 没有 `retry_offer` 的失败按原样处理。

### 钉渠道

- 同一个模型可能有多个上游渠道。
- 默认「智能调度」自动选最优, 并在失败时自动切换。
- 可以在「API 密钥」页为密钥指定调度策略, 或加请求头 `X-Schedule-Strategy` 覆盖单次请求 (取值见下方策略表)。

**钉渠道用哪个字段**

| 字段 | 用在哪 |
|---|---|
| `lane_id` | 下单时钉一条 |
| `lane_ids` | 下单时钉多条 |
| `pinned_lane_id` / `pinned_lane_ids` | 估价时对应的字段 |
| `X-Schedule-Strategy` | 请求头, 覆盖单次请求的调度策略 |
| 放在哪 | `/v1/media/generate` 放在 `params` 里, 其它入口放在请求体顶层 |

- 渠道号用估价响应的 `channels[].lane` 或 `/lanes` 列出的渠道号; 价格超过报价时失败响应给出的渠道号也可以 (见「计费与估价」)。
- 这些字段只用于选渠道, 不会转发给厂商。
- `channel_id` 是单向标识, 不能用来钉渠道。
- 钉多条只保证「只在这些渠道里选」, 不保证「只用第一条」: 按价格排序依次尝试, 前一条失败会切下一条。
- 不同渠道单价可能差好几倍 —— 要价格确定就只钉一条。
- 钉住的渠道是严格路由: 它限频、故障或审核拒绝时错误原样返回, 不会换到其它渠道。
- 需要自动容灾就用调度策略, 不要钉渠道。

**调度策略**

| 策略 | 说明 | X-Schedule-Strategy |
|---|---|---|
| 智能调度 | 综合价格、成功率、延迟自动选最优 (默认) | `balanced` |
| 价格优先 | 优先选择最便宜的渠道 | `cost_first` |
| 稳定优先 | 优先成功率高、最稳定的渠道 | `reliability_first` |
| 速度优先 | 只按响应速度排序、不设价格上限 (chat 比等首字, 生图/视频/音频比生成总时长) | `latency_first` |

## 参数与素材

参数怎么填、素材怎么传, 以及网关改了什么

**要点**

- 各入口的请求体和返回形状不同, 别共用解析代码。
- 枚举发 `value`, 不发界面显示名。
- 参数与上限以该模型的 `param_schema` 为准, 别照搬别的模型。
- 参考素材用公网直链, 本地文件先 `POST /v1/files`。
- 看响应里的 `param_adjustments` 核对网关改了什么。

### 请求与返回的形状

- 视频与音频有三种请求体, 提交返回也各不相同 —— 别用同一段解析代码处理所有入口。
- 照抄另一个入口的示例, 参数会静默落到默认值, 而且照常计费。

| 入口 | 请求体 | 提交返回 |
|---|---|---|
| `/v1/media/generate` | `{model, prompt, params: {…}}` 信封 | `{code, msg, data: {task_id, status, is_final}}` 信封 (data 里可能还有兼容用的中文键, 忽略即可) |
| `/v1/videos/generations` | 参数直接放在顶层, 不收 `params` 信封 | 顶层 `{id, task_id, status}` |
| `/v1/audio/generations` | 参数直接放在顶层, 不收 `params` 信封 | `model_runtime.invoke` 信封, `task_id` 在顶层 |
| `/api/v1/model-runtime/invoke` | `{model_id, modality, operation, params}`, `prompt` 写在 `params` 里 | `model_runtime.invoke` 信封, `task_id` 在顶层 |
| 查询 `GET /v1/tasks/{task_id}` | — | 字段放在根上 (`id` / `status` / `is_final` / `output_url`) |

### 参数取值

- 枚举参数发选项的 `value`, 不是界面上的显示名。
- 合法值以 `param_schema` 里每个选项的 `value` 为准, 它可能是中文 (例如某档位 value 是「标准」, 界面显示「Mini」)。
- 网关认得出的写法 (显示名、大小写、常见同义词) 会换成合法值。
- 认不出的按没传处理、落到默认值 —— 表现为「参数没生效」, 且照常计费。
- 两种情况都会写进响应的 `param_adjustments`, 按它核对最省事。

**以模型自己的参数表为准**

- 每个模型能用哪些参数、取值与上限都不同。
- 唯一真值是 `GET /v1/logical-models` 里该模型的 `param_schema` (模型页的参数表就是它)。
- 上限还会随实际路由到的渠道变。
- 别把数字写死在代码里, 也别把一个模型的参数照搬到另一个 (同系列的两张卡也可能不同)。

### 参数调整回执

- 请求里的计价参数 (时长 / 分辨率 / 质量档 / 开关等) 被网关换了写法、改了值或补了值时, 响应多带一个 `param_adjustments` 数组。
- 没有任何调整时不出现这个字段。
- 每项 `{param, requested, applied, reason}`: `requested` 是你传的值 (没传为 null), `applied` 是实际按它发送并计价的值。

**reason 取值**

| reason | 含义 |
|---|---|
| `spelling` / `option_label` / `synonym` / `field_alias` | 写法换成规范写法 (如 seconds → duration、显示名 Mini → 取值「标准」) |
| `nearest_supported` | 没有渠道能做原值, 取最接近的可交付值 |
| `pixel_size` / `derived_from_pixel_size` / `tier_in_shape_param` | 按像素尺寸或档位写法换算 (如视频只传 size=720x1280: 按短边取 resolution 720p 并据此计价, size 原样发送) |
| `card_default` / `vendor_default` | 你没传, 按默认值补 |
| `nearest_vendor_supported` | 承接渠道做不了原值 / 默认值, 取它能做的最接近值 |
| `unrecognized` / `auto_as_unspecified` | 认不出, 按没传处理 |

**视频没传的参数**

- 视频请求没传时长 / 分辨率 / 质量档时, 回执按预估首选渠道给出补的值。
- 实际若换到别的渠道, 按那条渠道能做的、离默认值最近的值发送并计价。
- 发送的值与计价的值始终是同一个。

### 参考素材

- 参考图、参考视频、参考音频要用公网能直接下载的 http(s) 地址。
- 不支持相对路径、需要登录、防盗链或会过期的签名链接。
- 只有本地文件时先用 `POST /v1/files` 上传: 返回体里的 `url` 可以直接放进参考素材参数 (`images` / `videos` / `audios`) 或对话的 `attachments`, 它不是临时链接。
- 上传接口自己的 50 MB 上限只约束上传这一步。
- 每个模型能收几个素材、单个文件多大, 写在它的模型页参数表; 机器可读的是 `GET /v1/logical-models` 里该模型 `param_schema` 的 `max_items` / `max_bytes`。
- 不同模型差别很大, 别照搬别的模型的上限。
- 视频必须写提示词: 只传参考素材、不写 `prompt` 的请求会被拒绝。

### 素材库

- 先把参考图、参考视频、参考音频存成素材拿到素材 ID, 生成时写 `asset://<素材ID>` 引用。
- 素材只能用于 Seedance 官方直连模型 (`seedance-2-0-official` / `seedance-2-5`)。
- 写实真人脸的参考图建议走素材库: 直接传地址可能被模型方的真人风控拒绝, 经素材库上传后可以正常使用。
- 图片 (`Image`)、视频 (`Video`)、音频 (`Audio`) 都能存成素材。
- 视频素材按上传时测得的时长计费: 查询返回 `Duration` (秒), 生成时计入参考视频的计费秒数, 与直接传视频地址相同。
- 视频时长测不出, 或不在模型允许的参考视频时长范围内, 上传会被拒绝。
- 估价 (`/v1/pricing-estimate`) 同样只算支持素材库的线路, 并按素材时长算价。
- 参考视频全是素材时不用传 `video_total_duration_sec`; 与地址混用时, 它只填地址形式参考视频的合计时长。
- 上传只收公网 http(s) 地址, 本地文件先用 `POST /v1/files` 换成地址。
- 每个账号每分钟最多上传 20 个、最多保留 1000 个未删除的素材, 超出返回 429。
- 上传和保存素材不收费, 生成照常按模型价格计费。

**asset:// 写在哪**

| 写法 | 放在哪 |
|---|---|
| 扁平写法 | `images` / `videos` / `audios` 等参考素材参数 |
| 方舟写法 | `content[].image_url.url` / `content[].video_url.url` / `content[].audio_url.url` |

**素材状态**

| Status | 怎么做 |
|---|---|
| `Active` | 可以马上用 (上传返回体多数时候已是 Active) |
| `Processing` | 每隔几秒查一次 `GET /v1/api/assets/{Id}`, 变成 `Active` 再提交生成 |
| `Failed` | 看 `FailReason`; 素材可能被上游清理, 原因是已失效时重新上传 |

**路由与归属**

- 带 `asset://` 的请求只派给支持素材库的线路; 这些线路不可用时直接报错, 不会换到别的线路 (别的线路认不出素材 ID)。
- 素材只属于上传它的账号: 只能查询、引用、删除自己的。
- 删除只删除本平台的素材记录 (上游不提供删除), 删除后不能再查询或引用。

**错误码**

| 状态码 | code | 原因 |
|---|---|---|
| 400 | `asset_model_unsupported` | 素材用在了 Seedance 官方直连以外的模型 |
| 400 | `asset_lane_conflict` | 请求或密钥指定的线路里没有支持素材库的线路 |
| 400 | `asset_type_mismatch` | 素材类型与所在字段不符 (例如图片素材放进了参考视频字段) |
| 400 | `asset_duration_missing` | 视频素材没有记录时长, 无法计费; 重新上传该视频 |
| 403 | `asset_not_owned` | 引用了别人的、已删除的或不存在的素材; 本次不提交、不扣费 |
| 429 | — | 每分钟上传超过 20 个, 或未删除的素材超过 1000 个 |

## 错误码

请求报错与任务失败的原因和处理

**要点**

- 请求报错看 HTTP 状态码加 `error.code` / `error.type`。
- 任务失败不报 HTTP 错误, 看 `status=failed` 与 `error_class`。
- 报障附上 `X-Request-Id`。

- 请求报错时响应体统一为 `{"error":{"message":"..."}}`。
- 参数类错误看 `error.code`, 鉴权、计费、内容审核类看 `error.type` —— 两个字段和 HTTP 状态码一起判断。
- 每个响应都带 `X-Request-Id`, 报障时附上它能直接定位到这次调用。

**请求错误**

| 状态码 | code | 含义 |
|---|---|---|
| 400 | `invalid_request` | 参数缺失或取值非法 |
| 400 | `reference_image_unreachable` | 参考素材链接返回 403: 改用公网直链, 或先 POST /v1/files 上传 |
| 401 | `missing_api_key / invalid_api_key` | API key 缺失或无效 |
| 402 | `insufficient_funds` | 余额不够整单预冻结额 (不是零头), 结算后退差 |
| 402 | `api_key_quota_exceeded` | 这把 Key 总额度用完, 未提交未扣费 (钱包可能仍有余额); 额度在调用前检查, 单次可略超, 下一次被拦; 提高额度或换 Key |
| 403 | `insufficient_permissions / content_policy_violation` | 权限不足, 或内容被安全策略拦截 |
| 403 | `api_key_inactive` | Key 已停用 / 删除 / 撤销, 未提交未扣费: 在 API 密钥页恢复或换 Key; CLI 派生的 Key 需重连 Agent |
| 403 | `model_not_allowed` | Key 的模型范围不含该模型: 编辑这把 Key 的可用模型, 或换 Key |
| 403 | `model_not_available_for_api_key` | voice-clone / voice-design 不对 API 密钥开放: 改用 POST /v1/audio/voices 上传参考音频 |
| 404 | `not_found` | 任务或资源不存在 |
| 404 | `model_not_found` | 模型 ID 不存在或已下线: 用 GET /v1/skills/models 查当前 ID |
| 405 | `method_not_allowed` | 不支持该 HTTP 方法 |
| 413 | `file_too_large / image_reference_too_large / video_reference_too_large / audio_reference_too_large / payload_too_large` | 超上限: /v1/files 单文件 50MB; 参考图 / 视频 / 音频超该模型 param_schema 的 max_bytes; 对话附件或上下文过大 |
| 422 | `unsupported_param_combo` | 模型 / 渠道不支持这组参数 (如某分辨率与时长组合), 未扣费: 按 error.message 调整 |
| 422 | `reference_video_duration_pending` | 估价带了参考视频却没给 video_total_duration_sec: 补上各段合计秒数 |
| 422 | `pinned_channel_unavailable` | 锁定渠道不可用, 不换别的渠道报价: 稍后重试, 或解锁改用调度策略 |
| 422 | `voice_pinned_lane_mismatch` | 自定义音色 (克隆 / 设计) 只能在创建它的渠道合成, 而本次锁定的渠道 (lane_id / lane_ids / 密钥的模型渠道锁定) 都不是它; 请求未提交厂商、未扣费: 去掉渠道锁定或锁定可用的渠道, 无需重新克隆 |
| 429 | `rate_limit_error / over_capacity / ip_rate_limited` | 超这把 Key 的每分钟上限, 或触发平台整体保护: 按 Retry-After 退避; 固定渠道时上游限频原样透出 |
| 503 | `all_vendors_failed` | 可用渠道全部失败: 原因看 error.code 与 error.class, 稍后重试或换模型 |
| 503 | `speed_budget_exhausted` | 速度优先下暂无够快的渠道, 已提前返回、未扣费: 稍后重试或换策略 / 模型 |
| 502 / 503 / 504 | `billing_unavailable / billing_unreachable / billing_timeout` | 计费服务不可用或超时, 未提交未扣费: 稍后重试 |

**异步任务失败**

- 异步任务提交成功后再失败, 不会再有 HTTP 错误码: 失败体现在查询结果的 `status=failed`, 原因在 `error`, 分类在 `error_class` (常见分类见下表)。

- `status=failed`: 生成失败, error / error_class 给原因; 预冻结金额已自动解冻; 带 retry_offer 时可钉其 lane_id 按新价重做

| 任务状态 | error_class | 含义与处理 |
|---|---|---|
| failed | `content_blocked` | 审核未通过 (提示词或参考图): 调整后重提, 未产出不计费 |
| failed | `rate_limit` | 上游限频: 等待后重试 (锁定渠道时不自动切换) |
| failed | `vendor_model_unavailable` | 上游模型临时不可用: 稍后重试或换模型 / 渠道 |
| failed | `upstream_error / upstream_outage` | 上游失败或渠道故障: 冻结额自动退回 (看 refunded), 可直接重试 |
| failed | `video_task_failed / image_task_failed / audio_task_failed` | 上游受理后失败: 读 error 看原因, 金额同样自动退回 |

## 常见坑 (接入前必读)

| 症状 | 原因 | 做法 |
|---|---|---|
| 参数不生效, 落到默认档 | 发了界面显示名, 不是参数值 | 取 GET /v1/skills/models/{model} 的 params[].options[].value (可能是中文, 如 value="标准" 显示 "Mini"); 影响价格的参数网关会纠正 (认不出的按没传), 结果写进 param_adjustments (提交 / 估价 / 生图都返回) |
| 视频返回 400, 或参考素材取不到 | 没写 prompt; 素材链接需登录 / 防盗链 / 会过期 | prompt 必填 (超分这类以素材为主的模型除外); 用公网可直接下载的 http(s) 直链, 参考图也可传 base64 data URI; 本地文件先 POST /v1/files (≤50MB) |
| 拿到中间态或空结果 | 任务还没到 completed | 轮询 GET /v1/tasks/{task_id} 到 completed 再读 output_url (url / result_url / data[0].url 同值, 平台 CDN 绝对 https 地址, 未开通存储月卡时结果默认保留约 15 天, 开通后长期保留; 请及时下载或自行转存); processing + stage=downloading 继续轮询; failed 读 error / error_class |
| 推理模型断连: other side closed / ECONNRESET | 非流式时思考期无输出 (实测首字节 81 秒, 线上最长 163 秒), 代理把连接当死连接断开 | 对话用 stream:true: 思考内容以 reasoning_content 逐块推送 (同题首字节 3.5 秒) |
| 同步接口返回 200 却没有结果 | /v1/images/generations、/v1/audio/generations 约 5 秒后发保活字节, 状态码已固定为 200 | 检查 body.error (error.message 可展示, error.class 机读); 无 error 且 data[].url 非空才算成功; 要状态码对应成败改用异步 POST /api/v1/model-runtime/invoke |
| 参数全落默认值 (要 15 秒成片 5 秒) | 请求体形状用错了端点 | 信封 (参数在 params 里): invoke、/v1/media/generate; 扁平 (参数在顶层): /v1/videos/generations、/v1/images/generations、/v1/audio/speech、/v1/audio/generations。/v1/audio/generations 收到信封照常 200 计费但参数不生效; 其余三个会摊平 params (顶层优先), model 只认顶层 (model_id 不算) |
| 拿响应里的 id 去调用日志搜不到 | 响应体里 chatcmpl- / resp_ / msg_ 这类 id 平台不作检索键 | 按响应头 X-Request-Id (req_…) 搜, 每个接口都返回; 异步任务也可按提交时返回的 task_id 搜。接入时就把它们记进自己的日志 |

## 模型清单与参数约束

> 以上取值、默认值和上限是模型卡级目录声明，不代表每条渠道均支持；需同时满足参数条件和所有已声明上限，并核对所选渠道的参数组合与实时估价。
> 枚举请发送 value，括号内的 label 仅为显示名；available_when 的同字段值集表示 OR，不同字段之间表示 AND。

### Seedance 2.5 · 官方直连

- **模型 ID**: `seedance-2-5`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 21:9 (超宽 21:9) / 3:4 (3:4 竖) / 1:1 (方形 1:1) / 4:3 (横屏 4:3), available_when: mode in ["text-to-video", "reference"], 默认 16:9 |
| `audios` | upload | 否 | 上传文件, 最多 10 个, max_items_by_mode: edit: 10; extend: 10; first-frame: 0; first-last: 0; reference: 10; text-to-video: 0, 单个 ≤ 50 MB, 合计时长 ≤ 30s, min_duration_sec: 1.8, accept_formats: mp3 / wav |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `draft` | bool | 否 | true / false, available_when: mode in ["text-to-video", "reference"] |
| `duration` | enum | 否 | 4 (4秒) / 5 (5秒) / 6 (6秒) / 8 (8秒) / 10 (10秒) / 12 (12秒) / 15 (15秒) / 20 (20秒) / 25 (25秒) / 29 (29秒) / 30 (30秒), 默认 5 |
| `images` | upload | 否 | 上传文件, 最多 30 个, max_items_by_mode: edit: 30; extend: 30; first-frame: 30; first-last: 30; reference: 30; text-to-video: 0, 单个 ≤ 5 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (图生视频) / reference (多模态参考) / first-last (首尾帧) / edit (视频编辑) / extend (视频延长), 默认 first-frame |
| `resolution` | enum | 否 | 480p (480P 经济) / 720p (720P 高清) / 1080p (1080P 全高清), 默认 480p<br>720p / 1080p: 「样片模式」为 true 时不可用 |
| `return_last_frame` | bool | 否 | true / false |
| `videos` | upload | 否 | 上传文件, 最多 10 个, max_items_by_mode: edit: 10; extend: 1; first-frame: 0; first-last: 0; reference: 10; text-to-video: 0, 单个 ≤ 200 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5, 总像素 ≥409600 ≤8295044, min_fps: 24, max_fps: 59.94, 合计时长 ≤ 30s, min_duration_sec: 1.8, min_duration_sec_by_mode: edit: 4, accept_formats: mp4 / mov |

### Seedance 2.5 · 特价按次

- **模型 ID**: `seedance-2-5-special`
- **类型**: video · **计费方式**: 按次计费
- max_prompt_chars: 15000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9) / 1:1 (方形 1:1) [available_when: mode in ["reference", "first-frame"]] / 4:3 (横屏 4:3) [available_when: mode in ["reference"]] / 3:4 (竖屏 3:4) [available_when: mode in ["reference"]] / 21:9 (宽幅 21:9) [available_when: mode in ["reference", "first-frame"]], 默认 9:16 |
| `audios` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; reference: 3; text-to-video: 0, 单个 ≤ 15 MB, 合计时长 ≤ 15s, min_duration_sec: 2, accept_formats: mp3 / wav |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 30 (30秒（特价一口价）), 默认 30 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; reference: 9; text-to-video: 0, 单个 ≤ 30 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | reference (参考生) / first-frame (首帧生视频) / text-to-video (文生视频), 默认 first-frame |
| `resolution` | enum | 否 | 480p (480P 经济) / 720p (720P 高清) / 1080p (1080P 超清), 默认 720p |

### Seedance 2.5 · 特价按秒

- **模型 ID**: `seedance-2-5-promo`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 25000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 21:9 (超宽 21:9) / 3:4 (3:4 竖) / 1:1 (方形 1:1) / 4:3 (4:3 横), 默认 16:9 |
| `audios` | upload | 否 | 上传文件, 最多 10 个, max_items_by_mode: first-frame: 0; reference: 10; text-to-video: 0, 单个 ≤ 50 MB, 合计时长 ≤ 15s, min_duration_sec: 2, accept_formats: mp3 / wav |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 4 (4秒) / 5 (5秒) / 6 (6秒) / 8 (8秒) / 10 (10秒) / 12 (12秒) / 15 (15秒) / 20 (20秒) / 25 (25秒) / 29 (29秒) / 30 (30秒), 默认 5 |
| `images` | upload | 否 | 上传文件, 最多 30 个, max_items_by_mode: first-frame: 30; reference: 30; text-to-video: 0, 单个 ≤ 20 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (图生视频) / reference (多模态参考), 默认 first-frame |
| `resolution` | enum | 否 | 480p (480P 经济) / 720p (720P 高清) / 1080p (1080P 超清) / 4k (4K 极清), 默认 480p |
| `videos` | upload | 否 | 上传文件, 最多 10 个, max_items_by_mode: first-frame: 0; reference: 10; text-to-video: 0, 单个 ≤ 50 MB, 长边 ≤ 6000px, 宽高比 (宽÷高) 0.4 ~ 2.5, 总像素 ≤8295044, min_fps: 24, max_fps: 59.94, 合计时长 ≤ 15s, min_duration_sec: 2, accept_formats: mp4 / mov |

### Seedance 2.0 · 官方直连

- **模型 ID**: `seedance-2-0-official`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 1:1 (方形 1:1) / 4:3 (横屏 4:3) / 3:4 (竖屏 3:4) / 21:9 (超宽 21:9) / adaptive (跟随参考图), 默认 16:9 |
| `audios` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: edit: 3; extend: 3; first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 50 MB, 合计时长 ≤ 15s, min_duration_sec: 1.8, combined_duration_budget: true, accept_formats: mp3 / wav |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 4 (4秒) / 5 (5秒) / 6 (6秒) / 7 (7秒) / 8 (8秒) / 9 (9秒) / 10 (10秒) / 11 (11秒) / 12 (12秒) / 13 (13秒) / 14 (14秒) / 15 (15秒), 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: edit: 9; extend: 9; first-frame: 9; first-last: 9; reference: 9; text-to-video: 0, 单个 ≤ 5 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | text-to-video (文生视频) / reference (参考生) / first-frame (首帧) / first-last (首尾帧) / edit (视频编辑) / extend (视频延续), 默认 first-frame |
| `quality` | enum | 否 | 标准 / fast (Fast) / mini (Mini), 默认 mini |
| `resolution` | enum | 否 | 480p (480P 经济) / 720p (720P 高清) / 1080p (1080P 全高清) / 4k (4K 极清), enum_values_by_quality: fast: ["480p", "720p"]; mini: ["480p", "720p"]; 标准: ["1080p", "480p", "4k", "720p"], 默认 480p |
| `return_last_frame` | bool | 否 | true / false |
| `videos` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: edit: 3; extend: 1; first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 50 MB, 长边 ≤ 1280px, 短边 ≥ 300px, 总像素 ≥409600 ≤2086876, min_fps: 24, max_fps: 59.94, 合计时长 ≤ 15s, min_duration_sec: 2, combined_duration_budget: true, accept_formats: mp4 / mov |

### Seedance 2.0 · 特价按秒

- **模型 ID**: `seedance-2-0-promo`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9) / 1:1 (方形 1:1) / 4:3 (横屏 4:3) / 3:4 (竖屏 3:4) / 21:9 (宽幅 21:9) / adaptive (跟随参考图), enum_values_by_quality: fast: ["16:9", "1:1", "21:9", "3:4", "4:3", "9:16", "adaptive"]; mini: ["16:9", "1:1", "21:9", "3:4", "4:3", "9:16", "adaptive"]; 标准: ["16:9", "1:1", "21:9", "3:4", "4:3", "9:16"], 默认 9:16 |
| `audios` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 合计时长 ≤ 15s, min_duration_sec: 1.8, combined_duration_budget: true |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 4 (4秒) / 5 (5秒) / 6 (6秒) / 7 (7秒) / 8 (8秒) / 9 (9秒) / 10 (10秒) / 12 (12秒) / 15 (15秒), 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; first-last: 9; reference: 9; text-to-video: 0, 单个 ≤ 5 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | reference (参考生) / first-last (首尾帧) / text-to-video (文生视频) / first-frame (图生视频), 默认 reference |
| `quality` | enum | 否 | 标准 / fast (Fast) / mini (Mini), 默认 mini |
| `resolution` | enum | 否 | 480p (480P 省费) / 720p (720P 高清) / 1080p (1080P 超清) / 4k (4K 极清), enum_values_by_quality: fast: ["1080p", "480p", "720p"]; mini: ["480p", "4k", "720p"]; 标准: ["1080p", "480p", "4k", "720p"], 默认 480p |
| `videos` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 50 MB, 长边 ≤ 1280px, 短边 ≥ 300px, 总像素 ≥409600, min_fps: 24, max_fps: 59.94, 合计时长 ≤ 15s, min_duration_sec: 2, combined_duration_budget: true, accept_formats: mp4 / mov |

### Seedance 2.0 · 特价按次

- **模型 ID**: `seedance-2-0-special`
- **类型**: video · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9) / 21:9 (宽幅 21:9) / 1:1 (方形 1:1) / 4:3 (横屏 4:3) / 3:4 (竖屏 3:4), enum_values_by_quality: 快速: ["16:9", "1:1", "21:9", "3:4", "4:3", "9:16"]; 标准: ["16:9", "1:1", "21:9", "3:4", "4:3", "9:16"]; 高清: ["16:9", "1:1", "21:9", "9:16"], 默认 9:16 |
| `audios` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 15 MB, 合计时长 ≤ 15s, min_duration_sec: 1.8, combined_duration_budget: true |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 15 (15秒（特价一口价）), 默认 15 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; first-last: 9; reference: 9; text-to-video: 0, 单个 ≤ 5 MB, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | reference (参考生) / first-frame (首帧生视频) / first-last (首尾帧) / text-to-video (文生视频), enum_values_by_quality: 快速: ["first-frame", "first-last", "reference", "text-to-video"]; 标准: ["first-frame", "first-last", "reference", "text-to-video"]; 高清: ["first-last", "reference", "text-to-video"], 默认 first-frame |
| `quality` | enum | 否 | 高清 (官方满血) [available_when: mode in ["reference", "first-last", "text-to-video"]] / 快速 (Fast) / 标准 (Mini), enum_values_by_quality: 快速: ["快速", "标准", "高清"]; 标准: ["快速", "标准"]; 高清: ["快速", "高清"], 默认 标准 |
| `resolution` | enum | 否 | 720p (720P 高清) / 480p (480P 省费), 默认 720p |
| `videos` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 50 MB, 长边 ≤ 1280px, 短边 ≥ 300px, 总像素 ≥409600, min_fps: 24, max_fps: 59.94, 合计时长 ≤ 15s, min_duration_sec: 2, combined_duration_budget: true |

### DeepSeek V4.1 Flash

- **模型 ID**: `deepseek-v4.1-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | none (不思考) / minimal (极简) / low (低) / medium (中) / high (高) / xhigh (极高), 默认 high |

### DeepSeek V4 Flash

- **模型 ID**: `deepseek-v4-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `thinking` | enum | 否 | true / false, 默认 false |

### GT-6 Sol

- **模型 ID**: `gpt-6-sol`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高) / max (最高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-5.6 Terra

- **模型 ID**: `gpt-5.6-terra`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### Seedance 2.0 · 漫剧特价

- **模型 ID**: `seedance-2-0-manju-special`
- **类型**: video · **计费方式**: 按次计费
- max_prompt_chars: 8000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 1:1 (方形 1:1) / 4:3 (横屏 4:3) / 3:4 (竖屏 3:4), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 5 (5秒) / 10 (10秒) / 15 (15秒), 默认 15 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; first-last: 9; reference: 9; text-to-video: 0, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧生视频) / first-last (首尾帧) / reference (参考生), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P), 默认 720p |

### GT-5.6 Luna

- **模型 ID**: `gpt-5.6-luna`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-5.6 Sol

- **模型 ID**: `gpt-5.6-sol`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-6 Astra

- **模型 ID**: `gpt-6-astra`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高) / max (最高), 默认 high |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Opus 5.5

- **模型 ID**: `claude-opus-5-5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高), 默认 low |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Fable 5.1

- **模型 ID**: `claude-fable-5-1`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高), 默认 low |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Fable 5

- **模型 ID**: `claude-fable-5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高), 默认 low |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Opus 4.7

- **模型 ID**: `claude-opus-4-7`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Opus 4.8

- **模型 ID**: `claude-opus-4-8`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Opus 4.6

- **模型 ID**: `claude-opus-4-6`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Sonnet 4.6

- **模型 ID**: `claude-sonnet-4-6`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-3.8 Flash

- **模型 ID**: `gemini-3.8-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-3 Pro

- **模型 ID**: `gemini-3-pro`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 14 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 true |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-3.5 Flash

- **模型 ID**: `gemini-3.5-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### Kimi K3

- **模型 ID**: `kimi-k3`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### DeepSeek V4 Pro (0813)

- **模型 ID**: `deepseek-v4-pro-0813`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `reasoning_effort` | enum | 否 | low (低) / high (高), 默认 low |

### DeepSeek V4 Pro

- **模型 ID**: `deepseek-v4-pro`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `reasoning_effort` | enum | 否 | low (低) / high (高), 默认 low |
| `thinking` | enum | 否 | true / false, 默认 false |

### GK-4.20 Non-Reasoning

- **模型 ID**: `grok-4-20-non-reasoning`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `web_search` | bool | 否 | true / false, 默认 false |

### Doubao Seed 2.0 Pro

- **模型 ID**: `doubao-seed-2-0-pro`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT Image 2.5 Sunb

- **模型 ID**: `gpt-image-2.5-sunburst`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 1:1 (1:1 正方形) / auto (自适应) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 5:4 (5:4 横版) / 4:5 (4:5 竖版) / 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 21:9 (21:9 超宽) / 9:21 (9:21 超长), 默认 1:1 |
| `background` | enum | 否 | opaque (实色底) / transparent (透明底), 默认 opaque |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 16 个, 单个 ≤ 25 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `moderation` | enum | 否 | low (宽松) / auto (标准), 默认 low |
| `output_compression` | int | 否 | 0 ~ 100, 默认 100 |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 jpeg |
| `quality` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (超高) / max (极致), 默认 medium |
| `resolution` | enum | 否 | 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 4K |

### GT Image 2.5 Flare

- **模型 ID**: `gpt-image-2.5-flare`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 1:1 (1:1 正方形) / auto (自适应) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 5:4 (5:4 横版) / 4:5 (4:5 竖版) / 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 21:9 (21:9 超宽) / 9:21 (9:21 超长), 默认 1:1 |
| `background` | enum | 否 | opaque (实色底) / transparent (透明底), 默认 opaque |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 17 个, 单个 ≤ 25 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `moderation` | enum | 否 | low (宽松) / auto (标准), 默认 low |
| `output_compression` | int | 否 | 0 ~ 100, 默认 100 |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 jpeg |
| `quality` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (超高) / max (极致), 默认 medium |
| `resolution` | enum | 否 | 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 4K |

### Doubao Seedream 5.0 Pro

- **模型 ID**: `doubao-seedream-5-0-pro`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 10 个, 单个 ≤ 10 MB, 宽高比 (宽÷高) 0.06 ~ 16 |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `resolution` | enum | 否 | 1k (1K 标准) / 2k (2K 高清), 默认 2k |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 4:3 (4:3 横屏) / 3:4 (3:4 竖屏) / 16:9 (16:9 宽屏) / 9:16 (9:16 手机竖屏) / 3:2 (3:2 横屏) / 2:3 (2:3 竖屏) / 21:9 (21:9 超宽屏) / auto (自动), 默认 1:1 |

### GT Image 2

- **模型 ID**: `gpt-image-2`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 50000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 1:1 (1:1 正方形) / auto (自适应) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 5:4 (5:4 横版) / 4:5 (4:5 竖版) / 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 21:9 (21:9 超宽) / 9:21 (9:21 超长), 默认 1:1 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 16 个, 单个 ≤ 25 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 jpeg |
| `quality` | enum | 否 | auto (自适应) / high (高) / medium (中) / low (低), 默认 high |
| `resolution` | enum | 否 | 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 4K |

### GM-3.1 Flash Image

- **模型 ID**: `gemini-3.1-flash-image`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 1:1 (1:1 正方形) / 2:3 (2:3 竖版) / 3:2 (3:2 横版) / 3:4 (3:4 竖版) / 4:3 (4:3 横版) / 4:5 (4:5 竖版) / 5:4 (5:4 横版) / 9:16 (9:16 竖屏) / 16:9 (16:9 横屏) / 21:9 (21:9 超宽屏) / auto (自动 (跟随参考图)) / 1:4 (1:4 超竖版) / 4:1 (4:1 超横版) / 1:8 (1:8 极竖版) / 8:1 (8:1 极横版), 默认 1:1 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 14 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 是 | 0.5K (0.5K 极速) / 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 2K |
| `thinking_level` | enum | 否 | minimal (快速) / high (深度), 默认 minimal |

### GM-3 Pro Image

- **模型 ID**: `gemini-3-pro-image`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 1:1 (1:1 正方形) / 2:3 (2:3 竖版) / 3:2 (3:2 横版) / 3:4 (3:4 竖版) / 4:3 (4:3 横版) / 4:5 (4:5 竖版) / 5:4 (5:4 横版) / 9:16 (9:16 竖屏) / 16:9 (16:9 横屏) / 21:9 (21:9 超宽屏) / auto (自动 (跟随参考图)), 默认 1:1 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 14 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 是 | 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 1K |

### CL Opus 5

- **模型 ID**: `claude-opus-5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### Doubao Seedream 5.0

- **模型 ID**: `doubao-seedream-5-0`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 10 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `resolution` | enum | 否 | 2k (2K) / 4k (4K), 默认 2k |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 4:3 (4:3 横屏) / 3:4 (3:4 竖屏) / 16:9 (16:9 宽屏) / 9:16 (9:16 手机竖屏) / 3:2 (3:2 横屏) / 2:3 (2:3 竖屏) / 21:9 (21:9 超宽屏) / 5:4 (5:4 横屏) / 4:5 (4:5 竖屏) / 2:1 (2:1 宽屏) / 1:2 (1:2 竖屏) / 9:21 (9:21 超长竖屏), 默认 1:1 |

### MJ

- **模型 ID**: `mj_imagine`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 1024 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 1:1 (1:1 正方形) / 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:5 (4:5 竖版) / 5:4 (5:4 横版) / 21:9 (21:9 超宽屏), 默认 1:1 |
| `bot_type` | enum | 是 | MID_JOURNEY (MJ 写实模式) / NIJI_JOURNEY (Niji 动漫模式), 默认 MID_JOURNEY |
| `chaos` | enum | 否 | 0 (0 稳定) / 25 (25 轻微变化) / 50 (50 中等变化) / 75 (75 大变化) / 100 (100 最大变化), 默认 0 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `cref` | string | 否 | available_when: version in ["6", "6.1", "7"] |
| `cw` | enum | 否 | 0 (0 只保留脸) / 50 (50 中等) / 100 (100 完整保留), available_when: version in ["6", "6.1", "7"], 默认 100 |
| `draft` | bool | 否 | true / false, available_when: version in ["7", "8.1"], 默认 false |
| `extra` | string | 否 | — |
| `hd` | bool | 否 | true / false, available_when: version in ["", "8.1", "8.2"], 默认 false |
| `images` | upload | 否 | 上传文件, 最多 4 个 |
| `iw` | enum | 否 | 0.5 (0.5 自由) / 1 (1 较弱) / 2 (2 贴近) / 3 (3 最贴近), 默认 2 |
| `mode` | enum | 否 | text-to-image (文生图) / multi-reference (多图融合), 默认 text-to-image |
| `negative_prompt` | string | 否 | — |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 jpeg |
| `quality` | enum | 否 | 0.25 (0.25 快速) / 0.5 (0.5 标准) / 1 (1 高清) / 2 (2 超清), 默认 1 |
| `seed` | int | 否 | 0 ~ 4294967295 |
| `sref` | string | 否 | — |
| `stop` | enum | 否 | 50 (50% 很朦胧) / 80 (80% 略柔化) / 100 (100% 不停止), available_when: version in ["5.1", "5.2", "6", "6.1"], 默认 100 |
| `style` | enum | 否 |  (默认) / raw (Raw 原始), 默认 "" |
| `stylize` | enum | 否 | 0 (0 写实) / 50 (50 轻微) / 100 (100 默认) / 250 (250 中等) / 500 (500 强烈) / 750 (750 极强) / 1000 (1000 极致), 默认 100 |
| `sw` | enum | 否 | 0 (0 几乎不用) / 100 (100 默认) / 500 (500 强烈) / 1000 (1000 最强), 默认 100 |
| `tile` | bool | 否 | true / false, 默认 false |
| `version` | enum | 否 |  (默认) / 8.2 (v8.2 最新) / 8.1 (v8.1) / 7 (v7 / Niji 7) / 6.1 (v6.1) / 6 (v6 / Niji 6) / 5.2 (v5.2) / 5.1 (v5.1), 默认 "" |
| `weird` | enum | 否 | 0 (0 正常) / 250 (250 轻微) / 1000 (1000 明显) / 3000 (3000 极致), 默认 0 |

### GK-4.5

- **模型 ID**: `grok-4.5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高), 默认 high |
| `web_search` | bool | 否 | true / false, 默认 false |

### GLM-5.2

- **模型 ID**: `glm-5.2`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | high (高) / max (最深), 默认 max |
| `web_search` | bool | 否 | true / false, 默认 false |

### Seedance 2.0 · 电商特价

- **模型 ID**: `seedance-2-0-ecom-special`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 24400 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9) / 1:1 (方屏 1:1), enum_values_by_quality: 标准: ["16:9", "1:1", "9:16"]; 满血9图: ["16:9", "9:16"]; 真人模特: ["16:9", "1:1", "9:16"], 默认 9:16 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 5 (5秒) / 10 (10秒) / 15 (15秒), enum_values_by_quality: 标准: ["10", "15", "5"]; 满血9图: ["10", "15"]; 真人模特: ["10", "15", "5"], 默认 5 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: reference: 9; text-to-video: 0, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | reference (参考生) / text-to-video (文生视频), 默认 reference |
| `quality` | enum | 否 | 标准 / 真人模特 / 满血9图, 默认 满血9图 |

### Kling 4.0

- **模型 ID**: `kling-v4`
- **类型**: video · **计费方式**: 按秒计费
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 1:1 (方形 1:1) / 21:9 (宽银幕 21:9), 默认 16:9 |
| `audios` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: reference: 1; text-to-video: 0 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 3 (3秒) / 4 (4秒) / 5 (5秒) / 6 (6秒) / 7 (7秒) / 8 (8秒) / 9 (9秒) / 10 (10秒) / 11 (11秒) / 12 (12秒) / 13 (13秒) / 14 (14秒) / 15 (15秒) / 16 (16秒) / 17 (17秒) / 18 (18秒) / 19 (19秒) / 20 (20秒) / 21 (21秒) / 22 (22秒) / 23 (23秒) / 24 (24秒) / 25 (25秒) / 26 (26秒) / 27 (27秒) / 28 (28秒) / 29 (29秒) / 30 (30秒), 默认 5 |
| `images` | upload | 否 | 上传文件, 最多 10 个, max_items_by_mode: reference: 10; text-to-video: 0 |
| `mode` | enum | 否 | text-to-video (文生视频) / reference (参考生), 默认 reference |
| `resolution` | enum | 否 | 720p (720P 高清) / 1080p (1080P 超清), 默认 720p |
| `videos` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: reference: 1; text-to-video: 0, 单个 ≤ 61.0 MB |

### Wan 3.0

- **模型 ID**: `wan-3-0`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 20000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 3:4 (竖屏 3:4) / 4:3 (横屏 4:3) / 1:1 (方形 1:1), 默认 16:9 |
| `audios` | upload | 否 | 上传文件, 最多 5 个, max_items_by_mode: first-frame: 0; reference: 5; text-to-video: 0, 单个 ≤ 15 MB, 合计时长 ≤ 15s, accept_formats: mp3 / wav |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 5 (5秒) / 6 (6秒) / 7 (7秒) / 8 (8秒) / 9 (9秒) / 10 (10秒) / 11 (11秒) / 12 (12秒) / 13 (13秒) / 14 (14秒) / 15 (15秒) / 20 (20秒) / 25 (25秒) / 30 (30秒) / 4 (4秒) / 16 (16秒) / 17 (17秒) / 18 (18秒) / 19 (19秒) / 21 (21秒) / 22 (22秒) / 23 (23秒) / 24 (24秒) / 26 (26秒) / 27 (27秒) / 28 (28秒) / 29 (29秒), 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 10 个, max_items_by_mode: first-frame: 10; reference: 10; text-to-video: 0, 单个 ≤ 20 MB, 短边 ≥ 240px |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (图生视频) / reference (参考生), 默认 text-to-video |
| `resolution` | enum | 否 | 480p (480P 省费) / 720p (720P 高清) / 1080p (1080P 超清), 默认 480p |
| `videos` | upload | 否 | 上传文件, 最多 5 个, max_items_by_mode: first-frame: 0; reference: 5; text-to-video: 0, 单个 ≤ 100 MB, 长边 ≤ 4096px, min_fps: 16, 合计时长 ≤ 15s, max_ref_plus_output_sec: 30s |

### Qwen3.8-Max

- **模型 ID**: `qwen3.8-max`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高), 默认 high |
| `web_search` | bool | 否 | true / false, 默认 false |

### MiniMax H3

- **模型 ID**: `minimax-h3`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 10000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 21:9 (21:9 超宽屏) / 4:3 (4:3 横版) / 1:1 (1:1 方形) / 3:4 (3:4 竖版), available_when: mode in ["text-to-video", "reference"], 默认 16:9 |
| `audios` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 15 MB, 合计时长 ≤ 15s, min_duration_sec: 2 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 是 | 4 (4秒) / 5 (5秒) / 6 (6秒) / 7 (7秒) / 8 (8秒) / 9 (9秒) / 10 (10秒) / 11 (11秒) / 12 (12秒) / 13 (13秒) / 14 (14秒) / 15 (15秒), 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; first-last: 9; reference: 9; text-to-video: 0, 单个 ≤ 30 MB, 长边 ≤ 5760px, 短边 ≥ 256px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧) / reference (多模态参考), 默认 first-frame |
| `resolution` | enum | 否 | 768p (768P 标准) / 2k (2K 超清), 默认 2k |
| `videos` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; first-last: 0; reference: 3; text-to-video: 0, 单个 ≤ 50 MB, 长边 ≤ 1536px, 短边 ≥ 256px, min_fps: 23.976, max_fps: 60, 合计时长 ≤ 15s, min_duration_sec: 2 |

### VO-3.1 · 漫剧特价

- **模型 ID**: `veo-3-1-manju-special`
- **类型**: video · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 8 (8秒), 默认 8 |
| `images` | upload | 否 | 上传文件, 最多 2 个, max_items_by_mode: first-frame: 2; first-last: 2; reference: 2; text-to-video: 0 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧生视频) / first-last (首尾帧) / reference (参考生), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P), 默认 720p |

### GK-4.7

- **模型 ID**: `grok-4.7`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 high |
| `web_search` | bool | 否 | true / false, 默认 false |

### GK-4.6

- **模型 ID**: `grok-4.6`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 high |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-6.1 Sol

- **模型 ID**: `gpt-6.1-sol`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-4 Argon

- **模型 ID**: `gemini-4-argon`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 14 个 |
| `thinking_budget` | enum | 否 | low (低) / medium (中) / high (高), 默认 medium |

### GM-3.5 Flash Lite

- **模型 ID**: `gemini-3.5-flash-lite`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### Qwen3.7-Max

- **模型 ID**: `qwen3.7-max`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `enable_thinking` | bool | 否 | true / false, 默认 false |

### GLM-5.3

- **模型 ID**: `glm-5.3`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `enable_thinking` | bool | 否 | true / false, 默认 false |

### GM-3.1 Pro

- **模型 ID**: `gemini-3.1-pro`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 14 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 true |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Sonnet 5.5

- **模型 ID**: `claude-sonnet-5-5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### Wan 3.0 · 特价按次

- **模型 ID**: `wan-3-0-special`
- **类型**: video · **计费方式**: 按次计费
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 30 (30秒（一口价 · 推荐）) / 25 (25秒（同价）) / 20 (20秒（同价）) / 15 (15秒（同价）) / 10 (10秒（同价）) / 5 (5秒（同价）), 默认 30 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; reference: 9; text-to-video: 0, 短边 ≥ 240px |
| `mode` | enum | 否 | reference (参考生) / first-frame (首帧生视频) / text-to-video (文生视频), 默认 reference |
| `resolution` | enum | 否 | 720p (720P 高清) / 1080p (1080P 全高清), 默认 1080p |
| `videos` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 0; reference: 3; text-to-video: 0, 长边 ≤ 4096px, min_fps: 16, 合计时长 ≤ 15s, max_ref_plus_output_sec: 30s |

### GM-3.7 Flash

- **模型 ID**: `gemini-3.7-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### Qwen3.6-Plus

- **模型 ID**: `qwen3.6-plus`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |

### GM-3.6 Flash

- **模型 ID**: `gemini-3.6-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### Qwen3.8-Flash

- **模型 ID**: `qwen3.8-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |

### MiniMax-M3

- **模型 ID**: `minimax-m3`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |

### GLM-5.3 Flash

- **模型 ID**: `glm-5.3-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |

### Qwen3.5-Omni-Flash

- **模型 ID**: `qwen3.5-omni-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reply_voice` | enum | 否 | Tina (甜甜) / Cindy (林欣宜) / Liora Mira (清欢) / Raymond (林川野) / Katerina (卡捷琳娜) / Ryan (甜茶) / Mia (舒然) / Theo Calm (予安) / Serena (苏瑶) / Maia (四月) / Evan (江晨) / Qiao (小乔妹) / Momo (茉兔) / Wil (伟伦) / Angel (安琪) / Li Cassian (李公公) / Joyner (阿逗) / Gold (金爷) / Jennifer (詹妮弗) / Aiden (艾登) / Mione (敏儿) / Sohee (素熙) / Lenn (莱恩) / Ono Anna (小野杏) / Sonrisa (索尼莎) / Bodega (博德加) / Emilien (埃米尔安) / Andre (安德雷) / Radio Gol (拉迪奥·戈尔) / Rizky (阿力) / Roya (萝雅) / Hana (阿幸) / Dolce (多尔切) / Jakub (雅克) / Griet (海娜) / Eliška (艾莉卡) / Marina (玛丽娜) / Siiri (西芮) / Ingrid (林恩) / Sigga (海娜（冰岛）) / Bea (雅娜) / Chloe (思怡) / Joseph Chen (阿樸伯) / Rocky (阿强) / Alek (阿列克) / Sunnybobi (知芝) / Harvey (厚), 默认 Jennifer |
| `voice_reply` | bool | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### PixVerse C1 · 过人脸

- **模型 ID**: `pixverse-c1`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 5000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9), 默认 9:16 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 5 (5秒) / 8 (8秒), 默认 5 |
| `images` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: first-frame: 1; text-to-video: 0 |
| `mode` | enum | 否 | first-frame (首帧生视频) / text-to-video (文生视频), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P) / 1080p (1080P), 默认 720p |

### Qwen3.7-Plus

- **模型 ID**: `qwen3.7-plus`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### Qwen3.7-Flash

- **模型 ID**: `qwen3.7-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### SR-2 官方无水印

- **模型 ID**: `sora-2-official`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_bytes: 16384 (UTF-8 bytes)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 16:9 / 9:16, 默认 9:16 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 4 / 8 / 12, 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 1 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-video / first-frame, 默认 text-to-video |

### Omni Flash 1.1

- **模型 ID**: `omni-flash-1-1`
- **类型**: video · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 10 (10秒), 默认 10 |
| `images` | upload | 否 | 上传文件, 最多 7 个, max_items_by_mode: first-frame: 7; first-last: 7; reference: 7; text-to-video: 0, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧) / reference (参考生), 默认 first-frame |
| `resolution` | enum | 否 | 720p / 1080p, 默认 720p |

### VO-4 Omni

- **模型 ID**: `veo-4-omni`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏), available_when: mode in ["text-to-video", "first-frame", "first-last", "reference"], 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 4 (4秒) [available_when: mode in ["text-to-video", "first-frame", "first-last", "reference"]] / 6 (6秒) [available_when: mode in ["text-to-video", "first-frame", "first-last", "reference"]] / 8 (8秒) [available_when: mode in ["text-to-video", "first-frame", "first-last", "reference"]] / 10 (10秒) / 3 (3秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]] / 5 (5秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]] / 7 (7秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]] / 9 (9秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]], available_when: mode in ["text-to-video", "first-frame", "first-last", "reference"], 默认 3 |
| `images` | upload | 否 | 上传文件, 最多 7 个, max_items_by_mode: extend: 0; first-frame: 7; first-last: 7; reference: 7; text-to-video: 0, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧) / reference (参考生) / extend (视频延长), 默认 first-frame |
| `resolution` | enum | 否 | 720p / 1080p [available_when: aspect_ratio in ["16:9"] AND mode in ["text-to-video", "first-frame", "first-last", "reference"]], available_when: mode in ["text-to-video", "first-frame", "first-last", "reference"], 默认 720p |
| `videos` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: extend: 1; first-frame: 0; first-last: 0; reference: 0; text-to-video: 0, 单个 ≤ 12 MB, 长边 ≤ 1920px, 合计时长 ≤ 12s, duration_tolerance_sec: 0 |

### VO-3.1

- **模型 ID**: `veo-3.1`
- **类型**: video · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 8 (8 秒), 默认 8 |
| `images` | upload | 否 | 上传文件, 最多 3 个, max_items_by_mode: first-frame: 3; first-last: 3; reference: 3; text-to-video: 0, 单个 ≤ 10 MB<br>「生成模式」为 文生视频 时不可用 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧) / reference (多图参考), 默认 first-frame |
| `quality` | enum | 是 | 经济 / 快速 / 高质量, enum_values_by_quality: 快速: ["快速", "经济", "高质量"]; 经济: ["快速", "经济"]; 高质量: ["快速", "高质量"], 默认 快速 |
| `resolution` | enum | 否 | 720p (720p 标清) / 1080p (1080p 高清), 默认 720p |

### Seedance 2.0 · 九图特价

- **模型 ID**: `seedance-2-0-9tu-special`
- **类型**: video · **计费方式**: 按次计费
- max_prompt_chars: 8000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9), 默认 9:16 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 15 (15秒) / 10 (10秒（超值）) [available_when: mode in ["text-to-video", "reference"]] / 5 (5秒), enum_values_by_quality: Fast: ["10", "15"]; 标准: ["10", "15", "5"], 默认 15 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 9; reference: 9; text-to-video: 0, 长边 ≤ 6000px, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5 |
| `mode` | enum | 否 | text-to-video (文生视频) / reference (参考生) / first-frame (首帧), enum_values_by_quality: Fast: ["first-frame", "reference", "text-to-video"]; 标准: ["reference", "text-to-video"], 默认 reference |
| `quality` | enum | 否 | Fast / 标准 [available_when: mode in ["text-to-video", "reference"]], enum_values_by_quality: Fast: ["Fast"]; 标准: ["标准"], 默认 Fast |
| `resolution` | enum | 否 | 720p (720P) / 480p (480P), enum_values_by_quality: Fast: ["720p"]; 标准: ["480p", "720p"], 默认 720p |

### GK Imagine 1.5 Pro

- **模型 ID**: `grok-imagine-1-5-7tu-special`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 4096 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 1:1 (方图 1:1) / 4:3 (横屏 4:3) / 3:4 (竖屏 3:4) / 3:2 (横屏 3:2) / 2:3 (竖屏 2:3), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 3 (3秒) / 5 (5秒) / 6 (6秒) / 8 (8秒) / 10 (10秒) / 12 (12秒) / 15 (15秒), 默认 3 |
| `images` | upload | 否 | 上传文件, 最多 14 个, max_items_by_mode: first-frame: 14; first-last: 2; reference: 14; text-to-video: 0, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧图生) / reference (参考图生成) / first-last (首尾帧), 默认 reference |
| `resolution` | enum | 否 | 480p (480P 标清) / 720p (720P 高清), 默认 480p |
| `voices` | multi_enum | 否 | — |

### GK Imagine 1.5

- **模型 ID**: `grok-imagine-1.5`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 4096 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16) / 1:1 (方形 1:1), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 6 (6秒) / 10 (10秒) / 15 (15秒) / 20 (20秒) [available_when: resolution in ["480p", "720p"]] / 30 (30秒) [available_when: resolution in ["480p", "720p"]] / 4 (4秒) / 8 (8秒) / 12 (12秒), 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 7 个, max_items_by_mode: first-frame: 7; first-last: 2; reference: 7; text-to-video: 0, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧图生) / reference (参考图生成) / first-last (首尾帧), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P 高清) / 480p (480P 标清) / 1080p (1080P 全高清) [available_when: mode in ["text-to-video", "first-frame"]], 默认 480p |
| `voices` | multi_enum | 否 | — |

### GK Imagine 1.0

- **模型 ID**: `grok-imagine-video`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 4096 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 1:1 (1:1 方形) / 4:3 (4:3 横版) / 3:4 (3:4 竖版), available_when: mode in ["text-to-video", "first-frame", "reference"], 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 6 (6秒) / 10 (10秒) / 15 (15秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]] / 20 (20秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]] / 30 (30秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]] / 3 (3秒) / 4 (4秒) / 5 (5秒) / 8 (8秒) / 12 (12秒) [available_when: mode in ["text-to-video", "first-frame", "reference"]], 默认 3 |
| `images` | upload | 否 | 上传文件, 最多 7 个, max_items_by_mode: extend: 0; first-frame: 7; reference: 7; text-to-video: 0, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / reference (参考生) / extend (视频延长), 默认 first-frame |
| `resolution` | enum | 否 | 720p / 480p, available_when: mode in ["text-to-video", "first-frame", "reference"], 默认 480p |
| `videos` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: extend: 1; first-frame: 0; reference: 0; text-to-video: 0, 合计时长 ≤ 15s, min_duration_sec: 2, accept_formats: mp4 |

### Kling V3

- **模型 ID**: `kling-v3`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 1:1 (1:1 方形), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 5 (5秒) / 10 (10秒) / 15 (15秒), 默认 5 |
| `generate_audio` | bool | 否 | true / false, 默认 true |
| `images` | upload | 否 | 上传文件, 最多 2 个, max_items_by_mode: first-frame: 2; first-last: 2; text-to-video: 0, 单个 ≤ 10 MB, 短边 ≥ 300px |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720p 标准) / 1080p (1080p 专业), 默认 720p |

### Kling V3 Motion Control

- **模型 ID**: `kling-v3-motion-control`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 1:1 (1:1 方形), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 10 MB, 短边 ≥ 300px |
| `resolution` | enum | 否 | 720p / 1080p, 默认 720p |
| `videos` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 100 MB, 长边 ≤ 3850px, 短边 ≥ 340px, 合计时长 ≤ 10s, min_duration_sec: 3, duration_tolerance_sec: 1 |

### Kling V3 Omni

- **模型 ID**: `kling-v3-omni-cankao`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 1:1 (1:1 正方形), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 是 | 5 (5秒) / 6 (6秒) / 10 (10秒) / 15 (15秒), 默认 5 |
| `generate_audio` | bool | 否 | true / false, 默认 true |
| `images` | upload | 否 | 上传文件, 最多 7 个, 单个 ≤ 10 MB, 短边 ≥ 300px |
| `mode` | enum | 是 | std (标准) / pro (高品质), 默认 std |
| `videos` | upload | 否 | 上传文件, 最多 1 个, 单个 ≤ 200 MB |

### Kling 3.0 Turbo

- **模型 ID**: `kling-3.0-turbo`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 3 (3秒) / 5 (5秒) / 8 (8秒) / 10 (10秒) / 15 (15秒), 默认 3 |
| `generate_audio` | bool | 否 | true / false, 默认 false |
| `images` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: first-frame: 1; text-to-video: 0, 单个 ≤ 50 MB, 短边 ≥ 300px |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P), 默认 720p |

### PixVerse V6

- **模型 ID**: `pixverse-v6`
- **类型**: video · **计费方式**: 按秒计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 1:1 (1:1 方形), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 5 (5秒) / 8 (8秒), 默认 5 |
| `images` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: first-frame: 1; text-to-video: 0, 单个 ≤ 50 MB, 短边 ≥ 300px |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P) / 1080p (1080P), 默认 720p |

### HappyHorse 1.1

- **模型 ID**: `happyhorse-1-1`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 4:5 / 5:4 / 9:21 / 21:9, 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 3 (3秒) / 5 (5秒) / 10 (10秒) / 15 (15秒), 默认 3 |
| `images` | upload | 否 | 上传文件, 最多 9 个, max_items_by_mode: first-frame: 5; reference: 5; text-to-video: 0, 单个 ≤ 20 MB, 短边 ≥ 300px |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (图生视频（首帧）) / reference (参考生), 默认 first-frame |
| `resolution` | enum | 否 | 1080p (1080P) / 720p (720P), 默认 720p |

### Omni 视频转视频

- **模型 ID**: `veo-4-omni-v2v`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 6000 (Unicode 码点，非字节)
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 2 个, 单个 ≤ 8 MB |
| `mode` | enum | 否 | reference (视频转视频), 默认 reference |
| `videos` | upload | 否 | 上传文件, 最多 2 个, 单个 ≤ 15 MB, 长边 ≤ 1920px |

### Vidu Q3

- **模型 ID**: `viduq3`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 5000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 16:9 / 9:16 / 4:3 / 3:4 / 1:1, 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 是 | 5 / 4 (4秒) / 8 (8秒) / 12 (12秒) / 16 (16秒), 默认 4 |
| `images` | upload | 否 | 上传文件, 最多 7 个, max_items_by_mode: first-frame: 7; first-last: 7; reference: 7; text-to-video: 0, 单个 ≤ 50 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧) / reference (参考生), 默认 first-frame |
| `model_variant` | enum | 否 | turbo (快速) / pro (高质量), 默认 turbo |
| `resolution` | enum | 是 | 540p (540P) / 720p (720P) / 1080p (1080P), 默认 540p |
| `tier` | enum | 否 | turbo (Turbo 快速) / pro (Pro 高质量) / mix (Mix 混合), 默认 pro |

### MiniMax Speech 2.8 (Voice Clone)

- **模型 ID**: `speech-2.8`
- **类型**: audio · **计费方式**: 按字符计费
- max_prompt_chars: 10000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `emotion` | enum | 否 | auto (自动) / happy (开心) / sad (悲伤) / angry (愤怒) / fearful (害怕) / surprised (惊讶) / calm (平静), 默认 auto |
| `pitch` | enum | 否 | -6 (低沉) / -3 (偏低) / 0 (原声) / 3 (偏高) / 6 (高亮), 默认 0 |
| `sound_effects` | enum | 否 | none (无) / spacious_echo (空旷回音) / auditorium_echo (礼堂广播) / lofi_telephone (电话失真) / robotic (电音), 默认 none |
| `speed` | enum | 否 | 0.5 (0.5x) / 0.75 (0.75x) / 1 (1.0x) / 1.25 (1.25x) / 1.5 (1.5x) / 2 (2.0x), 默认 1 |
| `tier` | enum | 否 | hd (HD 高音质) / turbo (Turbo 速度), 默认 hd |
| `version` | enum | 否 | 2.8 / 2.6, 默认 2.8 |
| `voice` | string | 是 | — |

### Suno Music

- **模型 ID**: `music`
- **类型**: audio · **计费方式**: 按次计费
- max_prompt_chars: 5000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `audio_url` | string | 否 | — |
| `audio_urls` | string | 否 | — |
| `bitrate` | enum | 否 | 128000 (128 kbps) / 192000 (192 kbps) / 256000 (256 kbps), 默认 256000 |
| `clip_id` | string | 否 | — |
| `continue_at` | string | 否 | — |
| `continue_clip_id` | string | 否 | — |
| `cover_audio_url` | string | 否 | — |
| `cover_clip_id` | string | 否 | — |
| `end_s` | string | 否 | — |
| `infill_lyrics` | string | 否 | — |
| `lyrics` | string | 否 | — |
| `mode` | enum | 否 | song (歌曲) / instrumental (纯音乐), 默认 song |
| `negative_tags` | string | 否 | — |
| `operation` | enum | 否 | generate (生成) / extend (续写) / cover (翻唱) / upload_cover (上传翻唱) / lyrics (AI 写词) / stems (人声伴奏分离) / stems_all (12轨分离) / mp4 (生成视频) / concat (整曲拼接) / persona (存为歌手音色) / import (导入音频) / upload_extend (上传续写) / inspo (参考音频生成) / sample (样本转歌) / add_vocals (加人声) / add_instrumental (加伴奏) / add_stem (加音轨) / replace_section (段落替换) / mashup (两首混搭), 默认 generate |
| `persona_id` | string | 否 | — |
| `persona_name` | string | 否 | — |
| `sample_rate` | enum | 否 | 44100 (44100 Hz) / 48000 (48000 Hz), 默认 44100 |
| `second_clip_id` | string | 否 | — |
| `source_audio_url` | string | 否 | — |
| `start_s` | string | 否 | — |
| `style` | string | 否 | — |
| `title` | string | 否 | — |
| `version` | enum | 否 | chirp-v6 (v6) / chirp-v6-mini (v6 Mini) / chirp-v5 (v5) / chirp-v4-5 (v4.5), 默认 chirp-v6 |
| `vocal_gender` | enum | 否 | auto (自动) / m (男声) / f (女声), available_when: mode in ["song"], 默认 auto |

### GM-3.1 Flash TTS

- **模型 ID**: `gemini-3.1-flash-tts`
- **类型**: audio · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `instructions` | string | 否 | — |
| `response_format` | enum | 否 | wav, 默认 wav |
| `voice` | enum | 是 | Zephyr / Puck / Charon / Kore / Fenrir / Leda / Orus / Aoede / Callirrhoe / Autonoe / Enceladus / Iapetus / Umbriel / Algieba / Despina / Erinome / Algenib / Rasalgethi / Laomedeia / Achernar / Alnilam / Schedar / Gacrux / Pulcherrima / Achird / Zubenelgenubi / Vindemiatrix / Sadachbia / Sadaltager / Sulafat, 默认 Zephyr |

### GT-5.5

- **模型 ID**: `gpt-5.5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-5.4

- **模型 ID**: `gpt-5.4`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高) / xhigh (极高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-5.3 Codex

- **模型 ID**: `gpt-5.3-codex`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-5.4 Mini

- **模型 ID**: `gpt-5.4-mini`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `web_search` | bool | 否 | true / false, 默认 false |

### GT-5.4 Nano

- **模型 ID**: `gpt-5.4-nano`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-3 Flash

- **模型 ID**: `gemini-3-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-3.1 Flash Lite

- **模型 ID**: `gemini-3.1-flash-lite`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个, 单个视频 ≤ 20 MB |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `thinking_budget` | enum | 否 | none (最省思考) / minimal (极简) / low (低) / medium (中) / high (高), 默认 medium |
| `web_search` | bool | 否 | true / false, 默认 false |

### CL Haiku 4.5

- **模型 ID**: `claude-haiku-4-5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### Qwen Image 3.0

- **模型 ID**: `qwen-image-3.0`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_bytes: 61440 (UTF-8 bytes)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 3 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `quality` | enum | 否 | 标准 / pro (Pro), 默认 标准 |
| `resolution` | enum | 否 | 1K (1K 标清) / 2K (2K 高清), 默认 2K |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 16:9 (16:9 宽屏) / 9:16 (9:16 手机竖屏) / 4:3 (4:3 横屏) / 3:4 (3:4 竖屏) / 3:2 (3:2 横屏) / 2:3 (2:3 竖屏), 默认 1:1 |

### GT Image 2 Official

- **模型 ID**: `gpt-image-2-official`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 32000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 16 个, 单个 ≤ 25 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 png |
| `quality` | enum | 否 | low (低) / medium (中) / high (高), 默认 low |
| `resolution` | enum | 否 | 1k (1K) / 2k (2K) / 4k (4K), 默认 1k |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 5:4 (5:4 横版) / 4:5 (4:5 竖版) / 16:9 (16:9 横版) / 9:16 (9:16 竖版) / 2:1 (2:1 宽屏) / 1:2 (1:2 长竖版) / 3:1 (3:1 超宽屏) / 1:3 (1:3 超竖版) / 21:9 (21:9 电影宽屏) / 9:21 (9:21 电影竖屏) / auto (自适应), 默认 1:1 |

### GT Image 1.5

- **模型 ID**: `gpt-image-1.5-all`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 32000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 10 个, 单个 ≤ 25 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 jpeg |
| `size` | enum | 是 | 1024x1024 (1:1 正方形) / 1536x1024 (3:2 横版) / 1024x1536 (2:3 竖版), 默认 1024x1024 |

### Doubao Seedream 4.5

- **模型 ID**: `doubao-seedream-4-5`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 4 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `resolution` | enum | 否 | 2k (2K) / 4k (4K) / 1k (1K), 默认 2k |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 16:9 (16:9 横版) / 9:16 (9:16 竖版) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 21:9 (21:9 电影宽屏) / 5:4 (5:4 横版) / 4:5 (4:5 竖版) / 2:1 (2:1 宽屏) / 1:2 (1:2 长竖版) / 3:1 (3:1 超宽屏) / 1:3 (1:3 超竖版) / 9:21 (9:21 电影竖屏), 默认 1:1 |

### Qwen Image 2.0

- **模型 ID**: `qwen-image-2.0`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 800 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 6 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `resolution` | enum | 否 | 1k (1K) / 2k (2K), 默认 2k |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 16:9 (16:9 横版) / 9:16 (9:16 竖版), 默认 1:1 |

### Wan 2.7 Image

- **模型 ID**: `wan2.7-image`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 5000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 3 个, 单个 ≤ 20 MB, 长边 ≤ 8000px, 短边 ≥ 240px |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `quality` | enum | 否 | standard (标准) / pro (专业), 默认 standard |
| `resolution` | enum | 否 | 1k (1K) / 2k (2K), 默认 1k |
| `seed` | int | 否 | 0 ~ 2147483647 |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 5:4 (5:4 横版) / 4:5 (4:5 竖版) / 16:9 (16:9 横版) / 9:16 (9:16 竖版) / 2:1 (2:1 宽屏) / 1:2 (1:2 长竖版) / 3:1 (3:1 超宽屏) / 1:3 (1:3 超竖版) / 21:9 (21:9 电影宽屏) / 9:21 (9:21 电影竖屏) / auto (自适应), 默认 1:1 |

### GK Imagine 1.0 Image

- **模型 ID**: `grok-imagine-image`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 16000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 7 个, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 16:9 (16:9 横版) / 9:16 (9:16 竖版) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版), 默认 1:1 |

### Aliyun Image Super-Resolution

- **模型 ID**: `aliyun-image-superres`
- **类型**: image · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `mode` | enum | 否 | base (标准) / enhancement (增强), 默认 base |
| `output_format` | enum | 否 | jpg (JPG) / png (PNG) / bmp (BMP), 默认 jpg |
| `output_quality` | int | 否 | 30 ~ 100, 默认 95 |
| `upscale_factor` | int | 否 | 1 ~ 4, 默认 2 |
| `url` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 5 MB, 长边 ≤ 1920px, 只接受公网 http(s) 地址, 不支持 data URL |

### MiniMax Hailuo 2.3

- **模型 ID**: `minimax-hailuo-2-3`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 6 (6秒) / 10 (10秒) [available_when: resolution in ["768p"]], 默认 6 |
| `images` | upload | 否 | 上传文件, 最多 1 个, max_items_by_mode: first-frame: 1; text-to-video: 0, 单个 ≤ 20 MB, 短边 ≥ 300px |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧), 默认 first-frame |
| `resolution` | enum | 否 | 768p / 1080p, 默认 768p |

### Wan 2.7 Video

- **模型 ID**: `wan2.7-video`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 5000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 否 | 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 1:1 (1:1 方形) / 4:3 (4:3 横版) / 3:4 (3:4 竖版), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 2 (2秒) / 3 (3秒) / 4 (4秒) / 5 (5秒) / 6 (6秒) / 8 (8秒) / 10 (10秒) / 12 (12秒) / 15 (15秒), 默认 2 |
| `images` | upload | 否 | 上传文件, 最多 2 个 |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧) / first-last (首尾帧) / continuation (视频续写), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P 标准) / 1080p (1080P 高清), 默认 720p |

### GM-2.5 Pro TTS

- **模型 ID**: `gemini-2.5-pro-tts`
- **类型**: audio · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `instructions` | string | 否 | — |
| `response_format` | enum | 否 | wav, 默认 wav |
| `voice` | enum | 是 | Zephyr / Puck / Charon / Kore / Fenrir / Leda / Orus / Aoede / Callirrhoe / Autonoe / Enceladus / Iapetus / Umbriel / Algieba / Despina / Erinome / Algenib / Rasalgethi / Laomedeia / Achernar / Alnilam / Schedar / Gacrux / Pulcherrima / Achird / Zubenelgenubi / Vindemiatrix / Sadachbia / Sadaltager / Sulafat, 默认 Zephyr |

### GK-1.0 多图 · 特价

- **模型 ID**: `grok-imagine-video-special`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 4096 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 6 (6秒) [available_when: mode in ["text-to-video", "first-frame"]] / 10 (10秒), 默认 6 |
| `images` | upload | 否 | 上传文件, 最多 7 个, max_items_by_mode: first-frame: 7; reference: 7; text-to-video: 0, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-video (文生视频) / first-frame (首帧生视频) / reference (多图参考), 默认 first-frame |
| `resolution` | enum | 否 | 720p (720P 高清), 默认 720p |

### GK-1.5 图生 · 特价

- **模型 ID**: `grok-imagine-1.5-special`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 4096 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 16:9 (横屏 16:9) / 9:16 (竖屏 9:16), 默认 16:9 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `duration` | enum | 否 | 6 (6秒) / 15 (15秒), 默认 15 |
| `images` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 5 MB |
| `resolution` | enum | 否 | 720p (720P 高清), 默认 720p |

### GT-4o Mini TTS

- **模型 ID**: `gpt-4o-mini-tts`
- **类型**: audio · **计费方式**: 按次计费
- max_prompt_chars: 2100 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `instructions` | string | 否 | — |
| `response_format` | enum | 否 | mp3 / opus / aac / flac / wav / pcm, 默认 mp3 |
| `speed` | string | 否 | 默认 1.0 |
| `voice` | enum | 是 | alloy (Alloy) / echo (Echo) / fable (Fable) / onyx (Onyx) / nova (Nova) / shimmer (Shimmer), 默认 alloy |

### CL Sonnet 5

- **模型 ID**: `claude-sonnet-5`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `reasoning_effort` | enum | 否 | none (不思考) / low (低) / medium (中) / high (高), 默认 none |
| `thinking` | enum | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### GM-3.1 Flash Lite Image

- **模型 ID**: `gemini-3.1-flash-lite-image`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 1:1 (1:1 正方形) / 2:3 (2:3 竖版) / 3:2 (3:2 横版) / 3:4 (3:4 竖版) / 4:3 (4:3 横版) / 4:5 (4:5 竖版) / 5:4 (5:4 横版) / 9:16 (9:16 竖屏) / 16:9 (16:9 横屏) / 21:9 (21:9 超宽屏), 默认 1:1 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 14 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 是 | 1K (1K 标清), 默认 1K |

### FX-2.0 Pro

- **模型 ID**: `flux-2`
- **类型**: image · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 8 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 16:9 (16:9 宽屏) / 9:16 (9:16 竖屏) / 4:3 (4:3 横屏) / 3:4 (3:4 竖屏) / 3:2 (3:2 横屏) / 2:3 (2:3 竖屏) / 21:9 (21:9 超宽), 默认 1:1 |

### FX Kontext

- **模型 ID**: `flux-kontext`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 30000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 4 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `quality` | enum | 否 | pro (Pro) / max (Max), 默认 pro |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 16:9 (16:9 宽屏) / 9:16 (9:16 竖屏) / 4:3 (4:3 横屏) / 3:4 (3:4 竖屏), 默认 1:1 |

### GT Image 2 C

- **模型 ID**: `gpt-image-2-c`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 32000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 1 个, 单个 ≤ 25 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑), 默认 text-to-image |
| `output_format` | enum | 否 | png (PNG) / jpeg (JPEG), 默认 jpeg |
| `quality` | enum | 否 | auto (自适应) / high (高) / medium (中) / low (低), 默认 high |
| `size` | enum | 是 | 1024x1024 (1:1 正方形 · 1K) / 1792x1024 (16:9 横版 · 1K) / 1024x1792 (9:16 竖版 · 1K), 默认 1024x1024 |

### FX-3

- **模型 ID**: `flux-3`
- **类型**: image · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 10 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `resolution` | enum | 否 | 1k (1K 标准) / 2k (2K 高清) / 4k (4K 超清), 默认 1k |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 16:9 (16:9 宽屏) / 9:16 (9:16 竖屏) / 4:3 (4:3 横屏) / 3:4 (3:4 竖屏) / 3:2 (3:2 横屏) / 2:3 (2:3 竖屏) / 21:9 (21:9 超宽屏) / 9:21 (9:21 超长竖屏) / auto (自动), 默认 1:1 |

### MiniMax Voice Design

- **模型 ID**: `voice-design`
- **类型**: audio · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `preview_text` | string | 是 | — |
| `prompt` | string | 是 | — |
| `voice_id` | string | 是 | — |

### Aliyun Video Super-Resolution

- **模型 ID**: `aliyun-video-superres`
- **类型**: video · **计费方式**: 按秒计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `bitrate` | int | 否 | 1 ~ 20, 默认 10 |
| `url` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 1024 MB, 短边 ≥ 360px, 总像素 ≤3584000, 只接受公网 http(s) 地址, 不支持 data URL |

### 人脸转绘

- **模型 ID**: `face-repaint`
- **类型**: image · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 9:16 (竖屏 9:16) / 16:9 (横屏 16:9) / 1:1 (方形 1:1), 默认 9:16 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 是 | 上传文件, 最多 1 个 |
| `prompt` | string | 否 | — |
| `style` | enum | 否 | 黑白素描1 (黑白素描 1) / 黑白素描2 (黑白素描 2) / 黑白素描3 (黑白素描 3) / 黑白白描 / 3D建模网 (3D 建模网) / 平铺网格, 默认 黑白素描1 |

### GT Codex Auto Review

- **模型 ID**: `codex-auto-review`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |
| `enable_thinking` | bool | 否 | true / false, 默认 false |
| `web_search` | bool | 否 | true / false, 默认 false |

### Kling Image O3

- **模型 ID**: `kling-image-o3`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 1:1 (1:1 正方形) / 9:16 (9:16 竖屏) / 16:9 (16:9 横屏) / 4:3 (4:3 横版) / 3:4 (3:4 竖版) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 21:9 (21:9 超宽屏), 默认 1:1 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 8 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / multi-reference (多图融合) / image-edit (图编辑), 默认 text-to-image |
| `size` | enum | 是 | 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 4K |

### MiniMax Voice Clone

- **模型 ID**: `voice-clone`
- **类型**: audio · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `preview_text` | string | 否 | — |
| `sample_url` | string | 是 | — |
| `voice_id` | string | 是 | — |

### GK Imagine 2.0 图像

- **模型 ID**: `grok-imagine-image-2.0`
- **类型**: image · **计费方式**: 按次计费
- max_prompt_chars: 20000 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 5 个, 单个 ≤ 5 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 否 | 1:1 (1:1 正方形) / 16:9 (16:9 横屏) / 9:16 (9:16 竖屏) / 3:2 (3:2 横版) / 2:3 (2:3 竖版) / 4:3 (4:3 横版) / 3:4 (3:4 竖版), 默认 1:1 |

### GT Whisper

- **模型 ID**: `whisper-1`
- **类型**: audio · **计费方式**: 按秒计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `audio_duration_sec` | string | 是 | — |
| `audios` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 25 MB |
| `language` | string | 否 | — |

### Doubao TTS 2.0

- **模型 ID**: `doubao-tts-2.0`
- **类型**: audio · **计费方式**: 按字符计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `emotion` | enum | 否 | auto (自动) / happy (开心) / sad (悲伤) / angry (愤怒) / fearful (害怕) / surprised (惊讶) / calm (平静), 默认 auto |
| `emotion_scale` | enum | 否 | 1 / 2 / 3 / 4 / 5, 默认 4 |
| `response_format` | enum | 否 | mp3 (MP3) / wav (WAV), 默认 mp3 |
| `speed` | enum | 否 | 0.5 (0.5x) / 0.75 (0.75x) / 1 (1.0x) / 1.25 (1.25x) / 1.5 (1.5x) / 2 (2.0x), 默认 1 |
| `voice` | string | 是 | — |

### GM NB 2.1 Image

- **模型 ID**: `gemini-nano-banana-2.1-image`
- **类型**: image · **计费方式**: 按次计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `aspect_ratio` | enum | 是 | 1:1 (1:1 正方形) / 2:3 (2:3 竖版) / 3:2 (3:2 横版) / 3:4 (3:4 竖版) / 4:3 (4:3 横版) / 4:5 (4:5 竖版) / 5:4 (5:4 横版) / 9:16 (9:16 竖屏) / 16:9 (16:9 横屏) / 21:9 (21:9 超宽屏) / 1:4 (1:4 超竖版) / 4:1 (4:1 超横版) / 8:1 (8:1 极横版), 默认 1:1 |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 否 | 上传文件, 最多 14 个, 单个 ≤ 10 MB |
| `mode` | enum | 否 | text-to-image (文生图) / image-edit (图编辑) / multi-reference (多图融合), 默认 text-to-image |
| `size` | enum | 是 | 1K (1K 标清) / 2K (2K 高清) / 4K (4K 超清), 默认 4K |

### Kling Digital Human

- **模型 ID**: `kling-avatar`
- **类型**: video · **计费方式**: 按秒计费
- max_prompt_chars: 2500 (Unicode 码点，非字节)

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `audios` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 5 MB, 合计时长 ≤ 300s, min_duration_sec: 2, accept_formats: mp3 / wav / m4a / aac |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `images` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 10 MB, 短边 ≥ 300px, 宽高比 (宽÷高) 0.4 ~ 2.5, accept_formats: jpg / jpeg / png |
| `mode` | enum | 否 | avatar (数字人), 默认 avatar |
| `quality` | enum | 否 | std (标准) / pro (高品质), 默认 std |

### Kling Lip Sync

- **模型 ID**: `kling-lip-sync`
- **类型**: video · **计费方式**: 按秒计费
- **参考视频计费**: 按合计时长计入输入费 (输出秒 + 参考视频秒); 估价请在 params 传 `videos` + `video_total_duration_sec`, 否则不含这部分, 实扣以服务端探测的真实时长为准。

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `audios` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 5 MB, 合计时长 ≤ 60s, min_duration_sec: 2, accept_formats: mp3 / wav / m4a |
| `count` | int | 否 | 1 ~ 50, 默认 1 |
| `mode` | enum | 否 | lip-sync (对口型), 默认 lip-sync |
| `original_audio_volume` | int | 否 | 0 ~ 2, 默认 0 |
| `sound_volume` | int | 否 | 0 ~ 2, 默认 1 |
| `videos` | upload | 是 | 上传文件, 最多 1 个, 单个 ≤ 100 MB, 长边 ≤ 2160px, 短边 ≥ 512px, 合计时长 ≤ 60s, min_duration_sec: 2, duration_tolerance_sec: 0, accept_formats: mp4 / mov |

### MiniMax-M3.1-Flash

- **模型 ID**: `minimax-m3.1-flash`
- **类型**: chat · **计费方式**: 按量计费

| 参数 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `attachments` | upload | 否 | 上传文件, 最多 10 个 |

---
_优创AIGC 开放 API 文档 · 导出于 2026-10-26. 如需最新参数, 以 `GET /v1/skills/models` 实时目录为准。_