# Phase 3｜证据约束 AI 与可配置 Provider 验收

## 范围

本阶段实现：

- Step 5 证据约束的 AI 写作、改写与人工接受；
- Step 7 整本报告 AI 语义审校，且与确定性质量 Gate 隔离；
- OpenAI-compatible Responses Provider 服务端适配层；
- LM Studio、OpenAI 和其他兼容 Responses 服务的环境配置；
- 旧 `OPENAI_API_KEY` / `OPENAI_MODEL` 配置兼容。

浏览器仍只访问同源 `/api/ai/status`、`/api/ai/writing` 和 `/api/ai/semantic-review`。Provider URL、API Key 与 Authorization header 不进入客户端。

## Provider 配置

复制 `.env.example` 为 `.env.local`。不要使用 `NEXT_PUBLIC_AI_API_KEY`，也不要提交真实 Key。

### LM Studio

```bash
AI_PROVIDER=lmstudio
AI_BASE_URL=http://127.0.0.1:1234/v1
AI_MODEL=<LM Studio 当前加载模型的 model id>
AI_API_KEY=
```

LM Studio 模式不强制 API Key。服务端把规范化后的 Base URL 与 `/responses` 拼接，并仅保存配置，不会由 status 接口反复调用模型。

2026-11-03 检查了 LM Studio 官方文档中的 [`POST /v1/responses`](https://github.com/lmstudio-ai/docs/blob/main/1_developer/3_openai-compat/responses.md)：该端点已明确支持，但文档未承诺 Responses 请求中的 OpenAI `text.format` 字段。为避免把未确认支持的可选字段发给本地服务，LM Studio adapter 保留 Responses endpoint，将 JSON Schema 约束加入 instructions，并在服务端执行同一套严格 JSON、Evidence 与引用校验；OpenAI adapter 继续使用 `text.format: json_schema`。

### OpenAI

```bash
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=<model>
AI_API_KEY=<server-secret>
```

OpenAI 模式要求服务端 API Key，并按条件生成 `Authorization: Bearer ...`。旧配置仍可继续使用：

```bash
OPENAI_API_KEY=<server-secret>
OPENAI_MODEL=<model>
```

新变量优先。为避免把旧 OpenAI Secret 意外发送给本地或第三方服务，`OPENAI_API_KEY` 仅在 OpenAI/旧配置模式回退使用；LM Studio 和显式兼容 Provider 如需鉴权应配置 `AI_API_KEY`。

## LM Studio 本地人工测试

1. 启动 LM Studio，加载支持 Responses API 的模型。
2. 开启 Local Server，确认模型 ID。
3. 按上文设置 `AI_PROVIDER`、`AI_BASE_URL` 和 `AI_MODEL`。
4. 运行 `npm run dev`。
5. 在 Step 5 生成建议，检查原文未自动覆盖、引用仅来自输入证据。
6. 人工复核并接受建议，检查 FactCitation 与 SourceReference 保留。
7. 在 Step 7 运行 AI 语义审校，检查发现可定位且不改变确定性 Gate。

本次 Codex 执行环境无法访问用户电脑上的 LM Studio，因此 live smoke 如实记录为：

`SKIPPED — 当前执行环境无可访问的 LM Studio 服务`

## Provider 与安全边界

- `lib/ai/provider-server.ts` 负责 Provider 配置、Responses endpoint、条件 Authorization、超时及不可达错误。
- OpenAI 请求继续使用 `text.format: json_schema` 与 `store:false`；LM Studio adapter 为兼容官方文档已确认的字段范围，省略这两个可选字段，并由服务端严格校验返回结构。
- Writing 与 Semantic Review 的上层输入/输出契约保持不变。
- Provider 输出仍需通过 JSON 解析、结构校验、Evidence ID、章节/内容块定位和数值来源检查。
- 未知 Evidence ID、无法定位的语义发现以及输入证据外数值都会被拦截。
- AI 建议必须人工确认；事实或资料 revision 变化后旧建议不能写入。
- same-origin、请求体上限、进程内限流与 60 秒超时保持不变。
- LM Studio 不可达时返回 `AI_PROVIDER_UNREACHABLE`，页面显示可操作的连接提示，不修改项目数据。

## 自动化验收

```bash
npm run test:phase3
npm run lint
npm run typecheck
npm run build
git diff --check
```

Provider 协议回归使用服务端 fetch 测试替身，不调用外部模型：

- P3-PROVIDER-01：LM Studio endpoint 正确、Key 可为空；
- P3-PROVIDER-02：OpenAI endpoint 与 Authorization 正确；
- P3-PROVIDER-03：旧 OpenAI 环境变量兼容；
- P3-PROVIDER-04：Provider 不可达错误明确；
- P3-PROVIDER-05：无效 Evidence ID 被拦截；
- P3-PROVIDER-06：证据外数值进入禁止接受清单。

机器可读结果见 `phase3-results.json`。

## 结论

Phase 3：通过。

- AI Provider：已支持 OpenAI-compatible 配置；
- LM Studio：支持配置，live smoke 因执行环境不可访问用户本机而跳过；
- OpenAI：支持配置及旧变量兼容；
- 默认 Live Provider：未绑定具体生产服务；
- API Key 客户端暴露：无；
- 所有模型输出仍受证据、revision、结构化输出和人工确认保护。
