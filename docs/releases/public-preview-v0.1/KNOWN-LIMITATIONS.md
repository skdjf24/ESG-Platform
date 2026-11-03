# Public Preview v0.1 known limitations

## Local data

- Project data and uploaded file bytes are primarily stored in the current browser.
- Clearing site data can remove local projects.
- Projects do not automatically sync across browsers or devices.
- Users must export project backups for durable retention.
- There is no server project database, account, tenant isolation or multi-user collaboration in v0.1.

## Files

- XLSX, DOCX and text-based PDF parsing runs locally in the browser.
- Legacy `.xls` is not supported.
- OCR is not enabled, so scanned/image-only PDFs are not parsed as text.
- There is no cloud file store or server-side file archive.

## AI

- Public Preview does not configure live AI by default.
- Deterministic editing and quality checks remain available without AI.
- The retained Mock chart-layout helper is visibly labelled `Mock AI` and is a local rules demonstration, not a live model.
- LM Studio is intended only for local development. A public deployment cannot connect to a user's `127.0.0.1`.
- If a remote provider is configured later, user-initiated structured text may be sent to that provider.

## Export

- PDF is produced through the browser print / Save as PDF workflow; browser print settings can affect output.
- DOCX is editable OOXML and uses the current formal export implementation.
- The current chart export representation is limited to the existing Phase 4 implementation.

## Release state

- Production deployment and public URL smoke testing are pending.
- No formal release tag exists until the public release gate passes.
