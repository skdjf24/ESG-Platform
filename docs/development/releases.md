# 版本号、发布门禁与 tag 策略

配套 [分支模型与仓库治理](./branching.md)。本文只约束「什么时候可以对外发布、用什么名字、留什么证据」。

## 1. 版本号

采用语义化版本，tag 名与 `package.json` 的 `version` 不一致时以 tag 为准：

| 形式 | 用途 |
| --- | --- |
| `vMAJOR.MINOR.PATCH` | 正式版本，可对外承诺 |
| `vMAJOR.MINOR.PATCH-preview.N` | 公开试用版，功能可用但不承诺稳定性 |
| `vMAJOR.MINOR.PATCH-rc.N` | 发布候选，仅内部对账，不对外 |

`MAJOR`：数据格式或流程语义不兼容（例如 `ReportProjectData.schemaVersion` 升级且无法加法迁移）。
`MINOR`：新增 Step、新增规则族、新增输出格式。
`PATCH`：缺陷修复、文案与版式调整、规则实现修正（不改规则 ID）。

当前状态：**没有任何 tag**。`Public Preview v0.1` 是候选名，代码已在 `main`，公开发布门禁未完成，因此不创建 `v0.1.0-preview.1`。

## 2. 打 tag 的前置门禁

四条全部通过才允许打 tag，缺一条都不行：

1. `main` 上的 CI 为绿（lint / typecheck / build / 非浏览器回归）。
2. 生产部署可访问，且与 `main` 同一提交。
3. 发布候选的浏览器回归通过（Phase 1/2、Step 7、Step 7.1、Step 8、Step 1–8 E2E）。
4. 公网冒烟通过：`scripts/public-preview-smoke.cjs` 对生产域名运行。

门禁证据统一写入 `docs/releases/<version>/`：

- `TEST-RESULTS.md`：逐条命令 + 结果 + 执行提交 sha，未执行的写「未执行」，不得留空
- 机器可读结果 JSON 原样提交（`*-results.json`）
- `KNOWN-LIMITATIONS.md`：对外可披露的限制
- 截图放在同目录或 `docs/acceptance/` 下引用

## 3. tag 的创建方式

```bash
# 在 main 上，且与即将部署的提交一致
git switch main
git pull --ff-only
git tag -a v0.1.0-preview.1 -m "Public Preview v0.1

commit: $(git rev-parse --short HEAD)
gates:
- CI: green (run <URL>)
- deploy: <production URL> @ <sha>
- browser: phase1/2, step7, step7.1, step8, e2e all pass
- smoke: scripts/public-preview-smoke.cjs pass
known limitations: docs/releases/public-preview-v0.1/KNOWN-LIMITATIONS.md"
git push origin v0.1.0-preview.1
```

规则：

- **annotated tag**，必须是 annotated；轻量 tag 没有作者、时间与说明，不可作为发布凭证。
- tag 只指向 `main` 上的提交，不指向 `release/*` 分支头。
- tag **一旦推送不可移动、不可删除重建**。发错了就打下一个补丁版本，不要 `git tag -f`。
- 发布记录与 tag 一一对应，仓库里用 `docs/releases/<version>/` 目录作为人类可读版本说明，不另建 CHANGELOG。

## 4. tag 之后的动作

1. 在 GitHub Releases 用 tag 说明作为正文发布，附件可选（DOCX 样例、截图）。
2. 删除 `release/<version>` 分支：`git push origin --delete release/<version>`。
3. 若发布分支上有只存在于发布分支的修复，先合回 `main` 再删分支。
4. 下一轮开发从 `main` 拉 `feature/*`，不要在 tag 上继续提交。

## 5. 演示与预发布环境

需要给外部看、但门禁未完成时，用 Vercel Preview 部署，**不打 tag、不对外承诺 URL 长期有效**，并在页面上保留 `APP_VERSION` 的预览标识。这样做的好处在回滚：预览部署可以随时替换，tag 不行。

## 6. 回滚

- 应用回滚：把生产部署指向旧 tag，不改代码、不移动 tag。
- 数据回滚：`ReportProjectData` 已有 `schemaVersion` 与迁移记录，版本回退时不得降级写回旧格式；必要时提供只读模式，等迁移补齐。
- 规则回退：改 `ruleVersion` 会让旧质量检查失效（这是设计），回滚规则也意味着要重跑全面检查。
