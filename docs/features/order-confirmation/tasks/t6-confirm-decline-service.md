---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T6 — Confirm/decline domain service

**Links:** [SAD §5](../sad.md) `services/` · [SAD §6](../sad.md) flows 1, 2, 4, 5, 6 · [PRD AC-01, AC-02, AC-03, AC-04, AC-05](../PRD.md#5-acceptance-criteria)

## Summary

The core use-case orchestration, replacing the old quote-engine-coupled design (no quote-engine call exists per ADR-0008). For `confirm`, check the model file still exists (T5, AC-05) before writing; for both `confirm`/`decline`, call T4's `decideOrder` and map its result for the routes (T7/T8/T9). `getOrderState` composes T4's `getDraftOrder` for the GET route's three cases (not-found / decided / ready-to-decide — flows 3, 4, 6).

## DoR

- T4, T5 merged

## Scope

- `decide(fileId: string, decision: "confirmed" | "declined"): Promise<"decided" | "already_decided" | "file_missing" | "not_found">`
  - look up the document first (T4's `getDraftOrder`) — not-found → `"not_found"` (flow 3)
  - `confirmed`: check T5's `modelExists` (AC-05) → false → `"file_missing"`, no write attempted (flow 5)
  - both: call T4's `decideOrder` → pass through `"decided"` / `"already_decided"` (flows 1, 2, 4)
- `getOrderState(fileId: string)`: wraps T4's `getDraftOrder` into the three display cases the GET route needs (not-found / decided-with-no-controls / ready-with-controls — flow 6, US-04)

## Out of scope

- HTTP status-code mapping — routes' job (T7, T8, T9)
- Rate limiting — T10

## DoD

- Unit tests (fake T4 repository, fake T5 adapter): confirm happy path, decline happy path, duplicate decision (AC-04) on both confirm and decline, file missing on confirm (AC-05), no-quote-yet (AC-03), reopen showing an already-recorded decision (US-04)

## Deps

T4, T5

## Estimate

M
