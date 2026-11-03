# Public Preview v0.1 test results

Run date: 2026-11-03  
Release base: `e7de71044926fb5da0ebab44a4d21a4dc845cee5`  
Preview code commit: `08cdaf23d90e6bc76bbc35cf61757c70f26d2538`

## Release-candidate checks executed in this work session

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

## Browser execution status

The current executor has the Playwright package but no Chrome/Chromium executable. `npx playwright install chromium` was attempted and the download endpoint returned a zero-byte/truncated archive on every retry. System paths were also checked for `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` and `chrome`; none exists.

Therefore the following release-candidate commands are **not recorded as PASS** in this report:

- `npm run test:step7:browser`
- `npm run test:step7-1:browser`
- `npm run test:step8:browser`
- `npm run test:e2e:step1-8`
- `npm run test:phase1:browser`
- `npm run test:phase2:browser`
- `npm run test:public-preview`

The repository contains earlier browser artifacts for the pre-release base, including Step 8 results with 23 PASS and 0 browser errors and Step 1–8 E2E results with 82 PASS / 0 FAIL / 1 finding. The task input reports newer Phase 4 acceptance totals of Step 8 27 PASS and E2E 85 PASS / 0 FAIL / 0 findings, but those newer totals are not present in the checked-in machine-readable result files at the release base. This discrepancy must be resolved by a fresh release-candidate browser run; it is not silently treated as passed.

## Public URL smoke test

Status: pending production URL.

`scripts/public-preview-smoke.cjs` is included to test:

- public homepage and version notice;
- sample project and Step 1–8 routes;
- dynamic project ID and refresh persistence;
- AI unconfigured status and secret-free status response;
- two independent browser contexts;
- clearing one context without affecting the other;
- console and page errors.

After Vercel authorization and production deployment, run:

```bash
PUBLIC_PREVIEW_BASE_URL=https://<production-domain> \
CHROMIUM_EXECUTABLE=/actual/path/to/chrome \
npm run test:public-preview
```

Then run the existing Phase 1/2, Step 7/7.1/8 and E2E browser commands against the same production URL using their documented base URL environment variables.

## Release Gate

Status: **not passed**. Deployment, fresh browser regression and public URL smoke are still required. A release tag must not be created yet.
