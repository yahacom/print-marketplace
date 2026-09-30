---
status: Not started
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T2 — State machine shell

**Links:** [SAD §5 Building block view](../sad.md#5-building-block-view) (`app.tsx` owns state-machine state) · [PRD §2 Goal 3](../PRD.md#2-goals) (state machine must extend to quote/order-confirmation later without a rewrite) · [ADR-0001](../adr/0001-use-preact-for-upload-ui.md)

## Summary

The top-level Preact component (`app.tsx`) that owns the `idle → uploading → success | error` state and renders one of three child components per state. This task builds the state container and transition logic only — the real `UploadForm`/`UploadProgress`/`UploadResult` children (T3, T6, T7) render as stub placeholders here and are swapped in by T8.

## Scope

- `main.tsx` mounts `App`
- `app.tsx`: state type `idle | uploading | success | error`, transition functions, renders one child per state
- Component test asserting the correct stub child renders for each state value

## Out of scope

- Real form/progress/result component behavior (T3, T6, T7)
- Wiring to `upload-client.ts`/`errors.ts` (T8)

## DoD

- `app.tsx` owns `idle → uploading → success | error` state
- Component test asserts correct child renders per state

## Deps

T1

## Estimate

S
