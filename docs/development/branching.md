# 分支模型与仓库治理

本文记录 2026-11-04 的仓库整合结果，以及之后应当遵守的分支规则。整合前的历史见 [Step 1–8 端到端验收报告](../acceptance/e2e-step1-step8/README.md) 第 8 节。

## 1. 整合后的状态

- `main` 已包含 Phase 0–4 与 Step 1–8 的全部代码，共 29 个提交、187 个文件。
- 整合方式为 fast-forward：`main` 原提交 `3b305fe` 是 `release/public-preview-v0.1`（`a3551cf`）的祖先，因此没有产生合并提交，也没有改写任何历史。
- 原有 15 个分支的提交**全部**已被 `main` 包含（逐分支校验 `git rev-list --count <branch> --not main` 均为 0），删除分支不会丢失任何代码或提交。
- 原有 14 个 PR 属于堆叠式验收流程的遗留产物，其内容已在 `main` 中，不再逐个合并。

## 2. 目标分支模型

| 分支 | 用途 | 生命周期 |
| --- | --- | --- |
| `main` | 唯一长期分支，任何时刻可构建 | 永久 |
| `feature/<topic>-<yyyymmdd>` | 单主题开发 | ≤ 1 周 |
| `fix/<topic>-<yyyymmdd>` | 缺陷修复 | ≤ 3 天 |
| `release/<version>` | 发布封板，打 tag 前冻结 | 发布后删除 |

规则：

1. **一个 PR 只做一件事**，base 一律为 `main`，不再使用堆叠 base。堆叠会让后续 PR 的 diff 依赖前一个 PR 是否合并，评审与回滚都会失控。
2. **合并方式用 squash merge**，PR 标题即提交信息，`main` 保持线性可读。
3. **合并前必须全绿**：`npm run lint`、`npm run typecheck`、`npm run build`，以及与改动范围相关的回归脚本（见第 5 节）。
4. **发布流程**：`release/<version>` 冻结 → 部署 → 公网冒烟 → 打 tag `vX.Y.Z` → 如发布分支有额外改动，再合回 `main`。
5. 不对 `main` 使用 force push；已推送的历史只追加不改写。

## 3. 遗留 PR 处置

14 个 PR 的目标分支多为前一个 PR 的 head（堆叠），内容现已全部进入 `main`。

| PR | 主题 | 建议 |
| --- | --- | --- |
| #1 | 第一版产品原型（Step 1–4） | 关闭，理由：已包含于 `main` |
| #2 | Step 5 写作工作台 | 关闭，同上 |
| #3 | Step 5.5 数据贯通 | 关闭，同上 |
| #4 | Step 6 可视化与预览 | 关闭，同上 |
| #5 | Step 6.1 图表统计修复 | 关闭，同上 |
| #6 | Step 7 质量检查 | 关闭，同上 |
| #7 | Step 7.1 质量状态修复 | 关闭，同上 |
| #8 | Phase 2 文档解析 | 关闭，同上 |
| #9 | Phase 0 端到端验收 | 关闭，同上 |
| #10 | Phase 1 本地持久化 | 关闭，同上 |
| #11 | Phase 3 证据约束 AI | 关闭，同上 |
| #12 | Phase 4 DOCX/PDF | 关闭，同上 |
| #13 | Step 8 定稿与导出 | 关闭，同上 |
| #14 | Public Preview v0.1 发布准备（draft） | 转为发布检查清单 issue，或关闭；不要直接合并 |

关闭时建议附一句说明，保留可追溯性：

> 该 PR 的内容已通过 fast-forward 完整包含在 `main`（`a3551cf`），历史提交未丢失，故关闭本 PR。后续改动请基于 `main` 新建分支。

## 4. 旧分支清理

保留 `main` 与 `release/public-preview-v0.1`（发布封板前仍有意义），其余 14 个分支可删除：

```bash
git push origin --delete \
  acceptance/v1-product-review-20261026 \
  feature/phase0-e2e-gap-closure-20261103 \
  feature/phase1-local-persistence-20261103 \
  feature/phase2-document-parsing \
  feature/phase3-evidence-ai-20261103 \
  feature/phase4-docx-pdf-export-20261103 \
  feature/step5-5-project-data-sync-20261027 \
  feature/step5-writing-workbench-20261026 \
  feature/step6-1-chart-preview-fixes-20261028 \
  feature/step6-visualization-layout-preview-20261027 \
  feature/step7-1-quality-state-fixes-20261029 \
  feature/step7-quality-check-20261028 \
  feature/step8-finalization-export-20261103 \
  fix/step6-1-chart-validation-formal-preview-20261028
```

删除后如需追溯某个阶段，用提交信息检索即可：`git log --oneline --all --grep="Step 7.1"`。

## 5. 每次合并前的校验

```bash
npm ci
npm run lint
npm run typecheck
npm run build

# 与改动范围相关的回归（需要浏览器时先 npm run dev 或 npm start）
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:step6
```

浏览器回归依赖 Playwright 与可用的 Chromium，见 `docs/acceptance/` 下各阶段说明。

## 6. 本次整合的复现步骤

```bash
git clone --no-single-branch https://github.com/skdjf24/ESG-Platform.git
cd ESG-Platform
git checkout main
git merge --ff-only origin/release/public-preview-v0.1   # 3b305fe -> a3551cf
git push origin main
```

校验整合结果与原发布分支完全一致：

```bash
git rev-parse 'main^{tree}' 'origin/release/public-preview-v0.1^{tree}'   # 两个哈希应相同
```
