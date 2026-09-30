---
status: Not started
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T3 — UploadForm component

**Links:** [PRD AC-01b, AC-05](../PRD.md#5-acceptance-criteria) · [SAD §5](../sad.md#5-building-block-view) `UploadForm.tsx` · [PRD §6.1 abuse case #2](../PRD.md#61-security--privacy) (multi-file/folder drop bypass)

## Summary

Drag-and-drop plus click-to-browse file selection (AC-01b), with a client-side guard that rejects multiple files or a dropped folder **before any network call** (AC-05).

## Scope

- Drag/drop event handlers + `<input type="file">` fallback for browsers without drag-and-drop (AC-01b)
- Client-side single-file guard: multiple files or a folder drop is rejected with a plain-language "only one model at a time" message, no request sent
- Client-side ≤50MB pre-check (PRD §6 NFR) surfaced as a distinct message, no request sent

## Out of scope

- Upload submission itself (T4, T8)
- Progress/result rendering (T6, T7)

## DoD

- Component test: single valid file accepted (calls `onFileSelected`)
- Component test: multiple files rejected client-side, no `onFileSelected` call
- Component test: folder drop rejected client-side, no `onFileSelected` call

## Deps

T2

## Estimate

S
