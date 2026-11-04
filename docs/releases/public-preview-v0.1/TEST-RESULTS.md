# Public Preview v0.1 test results

## Production public smoke — 2026-11-04

| Item | Observed result |
| --- | --- |
| Run time | 2026-11-04 20:46:33 UTC+08:00 |
| Production URL | `https://esg-platform-lilac.vercel.app` |
| Product commit | `cd5f612d318e29755f118cdcf1095773de548c61` (deployment commit supplied for this check; local checkout was at this commit when the smoke ran) |
| Browser | Chromium 154.0.8037.57 on Debian GNU/Linux 13 |
| Public HTTP check | `curl -I`: proxy `HTTP/1.1 200 OK`, origin `HTTP/2 200` |
| Functional smoke | **PASS — functional public smoke**; 25 PASS / 0 FAIL |
| Browser errors | `browserErrors: []`; console errors 0, page errors 0 |
| Result artifact | `docs/releases/public-preview-v0.1/public-url-smoke-results.json` |

The public homepage loaded successfully and showed the version, privacy notice, sample-project entry and new-project entry. `/api/ai/status` returned HTTP 200 with `configured:false`; its observed keys were `configured`, `provider`, `model` and `baseUrl`, with no key, secret or token field. The sample project opened, and all eight public Step 1–8 routes were actually visited and passed. A new project received a dynamic ID and persisted after refresh. Context A and B remained isolated; clearing A removed its project without affecting B.

The test ran through `PUBLIC_PREVIEW_BASE_URL=https://esg-platform-lilac.vercel.app npm run test:public-preview` in a temporary `/tmp` copy of the test harness. Both Browser Contexts used `ignoreHTTPSErrors: true` because Codex cloud intercepts HTTPS with a proxy CA that Chromium does not trust. Both contexts also used the Codex cloud HTTPS proxy so Playwright's API request could resolve the public host. The temporary harness waited for the sample enterprise field to finish hydrating before running its existing assertion. The repository test script and all product code remained unchanged.

**TLS verification bypassed only in Codex cloud browser because the execution environment intercepts HTTPS with an untrusted CA.** This functional smoke does not establish that user-side HTTPS certificate verification passes.

## 组合证据链 — 2026-11-04

本次只核对现有证据，**没有重新运行**历史浏览器回归。发布规则把 Phase 1/2 合为一组，五组对应六条命令。下表是早期真实浏览器执行结果，不把它们写成在 `cd5f612d…` 或公网 URL 上重新执行的结果。

| 命令 | 已有结果 | browserErrors | 原始证据和测试提交限制 |
| --- | --- | --- | --- |
| `test:phase1:browser` | 22/22 PASS，0 FAIL | `[]`（0） | `docs/acceptance/phase1/phase1-browser-results.json`；2026-11-03、本地 `127.0.0.1:4325`；JSON 未记录 `testedCommit` |
| `test:phase2:browser` | 19/19 PASS，0 FAIL | `[]`（0） | `docs/acceptance/phase2/browser-results.json`；2026-11-03、本地 `127.0.0.1:4326`；JSON 未记录 `testedCommit` |
| `test:step7:browser` | 验收表列出 15 个场景通过；未保存逐项 stdout 日志 | 文档记录 console 0、page 0；无原始错误数组 | `docs/acceptance/step7/README.md` 第 6 节、PR #6 验证记录；未记录目标提交 SHA |
| `test:step7-1:browser` | A–G 及 C+、F+ 扩展场景通过；未保存逐项 stdout 日志 | 文档记录 console 0、page 0；无原始错误数组 | `docs/acceptance/step7-1/README.md` 第 4、6 节；未记录目标提交 SHA |
| `test:step8:browser` | 27 PASS，0 FAIL | `[]`（0） | `docs/acceptance/step8/browser-results.json`；原始 JSON 未记录 SHA，`docs/acceptance/phase4/phase4-results.json` 的 `testedCommit` 为 `9efe73a8dbcc2ae73aa488f8e8e8bfe4bb21b466` |
| `test:e2e:step1-8` | 85 PASS，0 FAIL，0 findings | `[]`（0） | `docs/acceptance/e2e-step1-step8/e2e-results.json`；阶段汇总 `testedCommit=9efe73a8dbcc2ae73aa488f8e8e8bfe4bb21b466`、本地 `127.0.0.1:4325` |

四份原始浏览器 JSON 最后一次提交于 2026-11-03 的 `893293c1aa20cae20151dd4e33e6319a8aa3f3c0`，早于生产产品提交；Step 7/7.1 的证据是历史验收记录。**不能据此声称六条命令在 `cd5f612d…` 或生产 HTTPS URL 上重跑并通过。**

`a3551cf → cd5f612d318e29755f118cdcf1095773de548c61` 的 Git 差异仅为 `.github/workflows/ci.yml` 和三份发布/分支文档，无产品运行时代码变化。GitHub Actions [CI push run #41803433357](https://github.com/skdjf24/ESG-Platform/actions/runs/41803433357) 的 `head_sha` 是 `cd5f612d…`、结论为 `success`；`lint / typecheck / build` 与 `deterministic regressions` 两个 job 均为 `success`，其中 lint、typecheck、build、Phase 2/3/4 和 Step 6 步骤均成功。该提交关联的 Vercel 状态为 `success`。

Public Preview 的公网增量由本次生产 URL Smoke 的 **25 PASS / 0 FAIL、`browserErrors: []`** 验证，结果见同目录 `public-url-smoke-results.json`。这 25 项覆盖首页、公开说明、AI status、示例 Step 1–8、动态项目 ID、IndexedDB 持久化与双 Context 隔离。测试仅在 Codex 云浏览器的临时 harness 中绕过不受信任的代理 CA；不代表用户侧 HTTPS 证书验证通过。

**验收解释：**历史浏览器回归、`a3551cf → cd5f612d…` 的运行时代码不变、目标提交 CI 全绿以及最终公网 Smoke 构成可复核的组合证据链。它支持本 PR 对当前候选的功能验收，但不等同于六条套件在生产 URL 上重新执行。现有 `DEPLOYMENT.md` 对“全部浏览器命令在固定 HTTPS URL 运行”的字面要求仍未由这些结果证明；本 PR 供发布审核决定是否接受组合证据，不创建 Tag。

## Earlier release-candidate checks — 2026-11-03

Release base: `e7de71044926fb5da0ebab44a4d21a4dc845cee5`  
Preview code commit: `08cdaf23d90e6bc76bbc35cf61757c70f26d2538`

## Release-candidate checks executed in the earlier work session

| Command / check | Result | Detail |
| --- | --- | --- |
| `npm install` | PASS | Lockfile dependencies installed |
| `npm run lint` | PASS | 0 errors |
| `npm run typecheck` | PASS | 0 errors |
| `npm run build` | PASS | Next.js production build and Node route handlers compiled |
| `git diff --check` | PASS | No whitespace errors |
| `npm run test:phase2` | PASS | 20 PASS / 0 FAIL |
| `npm run test:phase3` | PASS | 20 PASS / 0 FAIL |
| `npm run test:phase4` | PASS | 15 PASS / 0 FAIL |
| `npm run test:step6` | PASS | 3 PASS / 0 FAIL |
| `/api/ai/status` with empty AI env | PASS | HTTP 200, `configured:false`, no key/secret field |
| Client bundle secret scan | PASS | No `AI_API_KEY`, `OPENAI_API_KEY` or LM Studio localhost value in `.next/static` |
| Server upload-route inventory | PASS | Only `/api/ai/status`, `/api/ai/writing`, `/api/ai/semantic-review`; no file-upload API |

## Browser execution status at the earlier check

The 2026-11-03 executor had the Playwright package but no Chrome/Chromium executable. `npx playwright install chromium` was attempted and the download endpoint returned a zero-byte/truncated archive on every retry. System paths were also checked for `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` and `chrome`; none existed in that executor.

Therefore the following release-candidate commands were **not recorded as PASS in that earlier check**:

- `npm run test:step7:browser`
- `npm run test:step7-1:browser`
- `npm run test:step8:browser`
- `npm run test:e2e:step1-8`
- `npm run test:phase1:browser`
- `npm run test:phase2:browser`
- `npm run test:public-preview`

The repository contains earlier browser artifacts for the pre-release base, including Step 8 results with 23 PASS and 0 browser errors and Step 1–8 E2E results with 82 PASS / 0 FAIL / 1 finding. The task input at that time reported newer Phase 4 acceptance totals of Step 8 27 PASS and E2E 85 PASS / 0 FAIL / 0 findings, but those newer totals were not present in the checked-in machine-readable result files at the release base. This was an open evidence gap in the earlier check; the available historical artifacts and their commit provenance are audited separately above.
