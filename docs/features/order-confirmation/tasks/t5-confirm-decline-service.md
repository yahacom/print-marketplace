---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T5 — Confirm/decline domain service

**Links:** [SAD §5](../sad.md) `services/` · [SAD §6](../sad.md) flows 1, 2, 4, 5 · [PRD AC-01, AC-02, AC-04, AC-05](../PRD.md#5-acceptance-criteria)

## Summary

The core use-case orchestration: given a decision (`confirmed` | `declined`) and the shared id, for `confirmed` first check the model file still exists (T4, AC-05), then write the decision via the repository (T2), returning a typed result the routes (T8/T9) map to status codes. AC-04's "already decided" case is the repository's `already_exists` result surfacing through this service, not re-implemented here.

## DoR

- T2, T3, T4 merged

## Scope

- `decide(id: string, decision: "confirmed" | "declined"): Promise<"created" | "already_decided" | "file_missing">`
  - `confirmed`: check T4's `modelFileExists` first (AC-05) → if false, return `"file_missing"` without writing
  - both: call T2's `createOrder` → map `"already_exists"` to `"already_decided"`
- `getQuoteForDisplay(id: string)`: composes T3's quote status with T2's `getOrder` for the reopen-after-decision case (SAD §6 flow 6, US-04)

## Out of scope

- HTTP status-code mapping — routes' job (T8, T9, T6)
- Rate limiting — T10

## DoD

- Unit tests (with T3/T4 stubs, fake T2 repository): confirm happy path, decline happy path, duplicate decision (AC-04), file missing on confirm (AC-05), reopen showing an already-recorded decision (US-04)

## Deps

T2, T3, T4

## Estimate

M
