---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T5 — stl-upload adapter — real `modelExists` check

**Links:** [ADR-0002](../adr/0002-use-in-process-module-calls-for-order-confirmation-integration.md) (in-process calls) · [ADR-0008](../adr/0008-scope-in-process-calls-to-stl-upload-only.md) (scoped to stl-upload only) · [SAD §6](../sad.md) flow 5 (AC-05, live model-file-exists check)

## Summary

stl-upload exists (`src/modules/stl-upload/`) but exports no existence check today — only `saveModel`. Add `modelExists(fileId: string): Promise<boolean>` to stl-upload's `repositories/model-repository.ts` (an `fs.access`-style check on the same `STORAGE_DIR`/`<fileId>.stl` path `saveModel` writes to, reusing the same `SAFE_FILE_ID` validation quote-engine's `model-reader.ts` already applies), then add order-confirmation's thin adapter that calls it in-process.

## DoR

- T3 merged

## Scope

- `modelExists(fileId: string): Promise<boolean>` exported from `src/modules/stl-upload/repositories/model-repository.ts` — validates `fileId` against `SAFE_FILE_ID` (reject early, same as quote-engine's `model-reader.ts` pattern) before touching the filesystem
- `src/modules/order-confirmation/repositories/` (or a small adapter module) calling `modelExists` directly (ADR-0002/0008 — same process, no network hop)

## Out of scope

- Any check beyond existence (content/geometry validation is quote-engine's concern — SAD §12 glossary)
- Changes to `saveModel` or the upload route

## DoD

- Unit test on stl-upload's `modelExists`: true for a file written by `saveModel`, false for an unknown id, false (not thrown) for a malformed id
- order-confirmation's adapter has a passthrough unit test (mocked `modelExists`)

## Deps

T3

## Estimate

S
