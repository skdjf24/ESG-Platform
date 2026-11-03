# Public Preview v0.1 deployment

| Setting | Value |
| --- | --- |
| Provider | Vercel |
| Production URL | Pending first deployment |
| Production branch | `release/public-preview-v0.1` |
| Framework | Next.js |
| Build command | `npm run build` |
| Start/runtime | Vercel Next.js Node runtime |
| Node version | `24.x` from `package.json#engines` |
| Auto deploy | Enabled through Vercel GitHub integration after authorization |
| AI environment | `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` empty by default |

## Why Vercel

The application uses Next.js App Router and Node route handlers under `/api/ai/*`, so it is not suitable for a pure GitHub Pages export. Vercel supports the current Next.js full-stack runtime, fixed HTTPS production domains, GitHub deployments and server-only environment variables without an architecture rewrite.

Repository configuration is intentionally limited to `vercel.json` plus the Node engine declaration. No second hosting-provider configuration is included.

## One-time account connection

1. Sign in to Vercel and choose **Add New → Project**.
2. Connect GitHub and authorize access to `skdjf24/ESG-Platform`.
3. Import the repository with the detected Next.js preset.
4. In **Project Settings → Environments → Production → Branch Tracking**, set `release/public-preview-v0.1`.
5. Leave all AI variables empty for v0.1 and deploy.

After this one-time connection, each new commit pushed to `release/public-preview-v0.1` triggers a production deployment and updates the same production domain.

## Environment rules

- Never commit a real API key.
- Do not use `http://127.0.0.1:1234/v1` in Vercel; that address would refer to the cloud runtime, not a user's LM Studio.
- Keep `AI_*` empty until a remote, approved OpenAI-compatible provider is selected.
- If AI is configured later, set secrets only in Vercel server environment variables.

## Post-deployment gate

Do not create `v0.1-public-preview` until all browser commands in `TEST-RESULTS.md` and the production smoke test pass against the fixed HTTPS URL with `browserErrors: []`.
