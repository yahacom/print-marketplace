---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T17 — Order API client (`src/ui/order-client.ts`)

**Links:** [PRD AC-01, AC-02, AC-04, AC-05](../PRD.md#5-acceptance-criteria) · [T8](t8-confirm-route.md), [T9](t9-decline-route.md) (response codes this client maps)

## Summary

Added scope (2026-10-03, feature-owner direction): no UI building block existed for order-confirmation in `sad.md` §5 — the quote screen `QuoteResult.tsx` only displays the quote, it never called this feature's API. Per feature-owner clarification, the existing `quote_ready` screen (shown right after `quote.done`) *is* the confirm/decline screen; it just needs the buttons wired. This task adds the typed fetch client, following the same pattern as `upload-client.ts` (fetch/XHR wrapper) and `errors.ts` (`code` → fixed user text, raw backend `message` never rendered — same discipline CLAUDE.md's UI architecture note requires).

## DoR

- T8, T9 merged (response `code` values fixed)

## Scope

- `confirmOrder(fileId: string): Promise<void>` — `POST /api/v1/orders/:fileId/confirm`; resolves on 201, rejects with a typed `OrderFailure` otherwise
- `declineOrder(fileId: string): Promise<void>` — `POST /api/v1/orders/:fileId/decline`; resolves on 200
- `OrderFailure` type in `errors.ts`: `{ kind: "backend"; status: number; code: string; message: string } | { kind: "network" }` — same shape as `UploadFailure`
- `toOrderUserMessage(failure: OrderFailure): string` in `errors.ts`, keyed on `code`: `order.not_found` → "We couldn't find your quote. Please upload your model again."; `order.already_decided` → "This quote already has a final decision."; `order.file_missing` → "Your model needs to be re-uploaded before an order can be placed."; unknown/network → generic text (same `GENERIC_TEXT` constant already in `errors.ts`)

## Out of scope

- Any UI wiring (buttons, state machine) — T18
- The GET order-state route (T7) — not called by this client; no reopen-after-reload screen exists in the SPA today (see T18's Out of scope)

## DoD

- Unit tests (`order-client.test.ts`, mocked `fetch`): 201/200 resolve; 404/409 reject with the matching `code`; a network failure rejects with `{ kind: "network" }`
- `order-errors.test.ts` (or added to `errors.test.ts`): each `code` maps to its fixed text; raw backend `message` is never returned by `toOrderUserMessage`

## Deps

T8, T9

## Estimate

S
