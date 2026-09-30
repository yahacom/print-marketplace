---
status: Not started
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T4 — upload-client.ts

**Links:** [ADR-0003](../adr/0003-use-xhr-for-upload-progress.md) (XHR for real byte-level progress; needs a thin Promise wrapper) · [SAD §6 Runtime view](../sad.md#6-runtime-view) flows 1-3 · [PRD §6 NFR](../PRD.md#6-non-functional-requirements) (progress ≥1 update/sec)

## Summary

A Promise wrapper around `XMLHttpRequest` that submits the multipart upload to `POST /api/v1/uploads`, exposes real byte-level progress via `xhr.upload.onprogress` (ADR-0003), and normalizes outcomes (success payload, backend `{code,message}` error, or network/timeout failure) for `errors.ts` (T5) to map.

## Scope

- `submitUpload(file): { promise, onProgress }` (or equivalent) wrapping XHR: resolves with `{file_id, status}` on 2xx, rejects with a typed result carrying either the backend `{code,message}` or a `network`/`timeout` marker
- `onprogress` events forwarded to a caller-supplied callback

## Out of scope

- Mapping to plain-language text (T5)
- Any component rendering (T6, T7)

## DoD

- Unit tests (mocked XHR): resolves on 2xx with parsed body
- Unit tests: rejects with backend `{code,message}` on 4xx/5xx
- Unit tests: rejects with a distinct network/timeout marker on `onerror`/timeout
- Unit test: progress callback invoked on each simulated `onprogress` event

## Deps

T1

## Estimate

S
