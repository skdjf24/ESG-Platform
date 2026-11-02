# Phase 3｜真实 AI 接入验收

## 范围

本阶段只实现：

- Step 5 真实 AI 写作与改写；
- 已确认事实/资料的证据约束和来源引用；
- 建议与原文对照、人工接受后才写入正文；
- Step 7 整本报告 AI 语义审校；
- AI 审校记录与确定性 Step 7 / Step 8 Gate 隔离；
- `OPENAI_API_KEY` 仅在 Next.js Route Handler 的服务端运行时读取。

不包含 PostgreSQL、账号、云存储、多租户、OCR、文件解析扩展或完整后端基础设施。

## 配置

复制 `.env.example` 为 `.env.local`，仅在本地或部署平台的服务端 Secret 中填写：

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-6.1-sol
```

不得使用 `NEXT_PUBLIC_OPENAI_API_KEY`。浏览器只访问同源 `/api/ai/*`，不会读取 Key。

## 安全与证据边界

- 使用 OpenAI Responses API 与严格 JSON Schema 输出。
- 每次请求显式设置 `store:false`。
- 只向 Step 5 发送当前操作所需的正文、Writing Policy、披露要求 ID 和已确认且有来源的证据。
- 服务端校验所有 citation 的 `evidenceId`；未知引用直接拦截。
- 模型标记的 `unsupportedClaims` 未清空前，UI 禁止接受建议。
- 接受时再次检查事实/资料 revision 和来源快照；上游变化后旧建议不可写入。
- Step 7 AI 发现必须定位到输入的 chapterId/blockId，未知位置或来源直接拦截。
- AI 审校仅为人工辅助记录，不创建、关闭或降级确定性质量问题，不改变 Step 8 Gate。
- 同源检查、请求体上限和进程内限流只是当前无账号阶段的最小防护；公开部署前仍需账号鉴权和持久化限流。

## 自动化验收

```bash
npm run test:phase3
npm run lint
npm run typecheck
npm run build
git diff --check
```

`test:phase3` 使用服务端 fetch 测试替身验证协议和安全边界，不会调用外部模型，也不会伪造“真实 API 已连通”。实际模型连通需由配置了有效 Key 的验收环境另行执行。

## 人工验收

1. 配置服务端 Key，打开 Step 5。
2. 选择段落和 AI 操作，生成建议；确认原文未被自动覆盖。
3. 核对建议中的来源定位，若存在“无依据陈述”，确认接受按钮不可用。
4. 勾选人工确认并接受，确认正文、FactCitation 和 SourceReference 同步写入。
5. 修改被引用事实 revision，再尝试接受旧建议，确认被拦截。
6. 打开 Step 7，运行“AI 语义审校”，确认发现可定位到 Step 5。
7. 人工接受并保存审校记录，确认 Step 8 Gate 与保存前一致。

## 当前结论

- Phase 3 协议/安全回归：13 PASS / 0 FAIL。
- Step 1–8 Chromium 回归：85 PASS / 0 FAIL / browserErrors 0；AI 路由使用明确测试替身。
- Step 6 回归：PASS。
- Phase 2 文档解析回归：20 PASS / 0 FAIL。
- lint / typecheck / build / git diff --check：PASS。

真实 OpenAI API 连通尚未执行：验收环境没有提供服务端 `OPENAI_API_KEY`。这不影响代码和安全边界验收，但在配置有效 Key 并完成人工内容质量验收前，Phase 3 不能标记为“真实模型联调完成”。没有 Key 时系统会明确返回“服务端尚未配置真实 AI”，且不修改项目数据。

机器可读结果见 `phase3-results.json`。
