---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T18 — Confirm/decline buttons on the quote screen

**Links:** [PRD US-02, US-03, US-05](../PRD.md#4-user-stories) · [PRD AC-01, AC-02, AC-04, AC-05](../PRD.md#5-acceptance-criteria) · [`app.tsx`](../../../../src/ui/app.tsx) `quote_ready` state · [`QuoteResult.tsx`](../../../../src/ui/components/QuoteResult.tsx)

## Summary

Adds Confirm/Decline buttons to the existing `quote_ready` screen (`QuoteResult.tsx`'s success branch) — per feature-owner direction, this screen already *is* the order-confirmation screen; it only lacked the action. `app.tsx`'s `quote_ready` state currently drops the `fileId` it has available in `beginQuote` (only `quote` + `filename` are kept) — this task carries it through so a click has something to call T17's client with.

## DoR

- T17 merged

## Scope

- `app.tsx`: add `fileId` to the `quote_ready` state shape; add new terminal states `order_confirmed` / `order_declined` (US-02/US-03 happy paths) and reuse the existing error-rendering pattern for `order_error` (AC-04/AC-05, network) — mirrors how `quote_ready`/`quote_error` were added in quote-engine's T12/T16
- Both buttons disabled while a request is in flight (client-side guard against a double-click firing two requests — belt-and-suspenders on top of T4/ADR-0007's server-side transaction, not a replacement for it) — satisfies US-05 "no accidental re-confirmation"
- `QuoteResult.tsx` success branch: render "Confirm" and "Decline" buttons, wired to `onConfirm`/`onDecline` props calling T17's `confirmOrder`/`declineOrder`
- On success: `order_confirmed` shows "Order confirmed" (AC-01); `order_declined` shows "No order was placed" (AC-02) — no further action, no un-decide affordance (US-05)
- On failure: render `toOrderUserMessage` (T17) for `order.already_decided` (AC-04) and `order.file_missing` (AC-05, confirm only)

## Out of scope

- **US-04/US-05 "leave and come back" reopen screen.** The SPA has no URL-based routing or persisted `fileId` — reloading always resets to `idle` (`app.tsx`'s `initialState` default). Wiring T7's GET route into a reload-safe reopen flow is a separate, larger change (routing) the feature owner did not ask for here ("just need to add Confirm button") — flagged as a still-open gap for US-04/US-05, not built in this task
- Rate limiting / structured logging UI feedback beyond the generic failure text — T10/T11 are server-side only

## DoD

- `app.quote.test.tsx` (or a new `app.order.test.tsx`) / `QuoteResult.test.tsx`: click Confirm → 201 → shows confirmed message, buttons gone; click Decline → 200 → shows declined message; click Confirm on an already-decided quote → 409 → shows "already has a final decision", no retry affordance that re-triggers the same request; click Confirm with the model file gone → 409 → shows re-upload message
- Existing UI tests (`app.test.tsx`, `app.integration.test.tsx`, `app.quote.test.tsx`) still pass unchanged
- No raw backend `message` reaches the rendered UI in any new code path (same discipline as T12/T16 in quote-engine) — confirmed by test, not just code review

## Deps

T17

## Estimate

M
