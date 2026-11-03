# Public Preview v0.1

- Version: `Public Preview v0.1`
- Release branch: `release/public-preview-v0.1`
- Stable base commit: `e7de71044926fb5da0ebab44a4d21a4dc845cee5`
- Preview code commit: `08cdaf23d90e6bc76bbc35cf61757c70f26d2538`
- Release tag: pending; only create `v0.1-public-preview` after production deployment and public smoke pass
- Planned provider: Vercel
- Production URL: pending first-time Vercel/GitHub authorization
- Prepared on: 2026-11-03

## Included scope

The release branch was created directly from the accepted Phase 4 tree. It includes Phase 0–4 and Step 1–8. No earlier Phase branch was merged or cherry-picked again.

Phase 2, Phase 3, Phase 4 and Step 6 non-browser regressions pass on the release candidate. Production deployment and public-URL browser acceptance remain pending, so this version is not tagged as released yet.

## Public Preview behavior

- No account or login is required.
- Project data, uploaded file bytes, parsed documents and Step 1–8 state are stored in the current browser's IndexedDB.
- Uploaded files are parsed in the browser and are not automatically sent to a project server.
- A clearly labelled sample project can be created and opened without uploading files.
- New projects receive independent project IDs and do not modify the sample project.
- Backup and restore use the existing Phase 1 archive format, including file bytes.
- AI is unconfigured by default. Step 5 editing, Step 7 deterministic checks, charts and exports remain available.
- If a remote AI provider is configured later, only user-initiated structured AI requests are sent to that provider.

## Current release state

`Public Preview v0.1：未通过`

The remaining release gates are a successful production deployment, execution of the browser suite against the release candidate, and the public-URL smoke test. No formal tag has been created.
