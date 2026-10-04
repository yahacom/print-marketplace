---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T7 — Order-state GET route

**Links:** [PRD AC-03](../PRD.md#5-acceptance-criteria) (no quote yet) · [PRD AC-04](../PRD.md#5-acceptance-criteria) (already decided) · [PRD US-04](../PRD.md#4-user-stories) (reopen) · [SAD §6](../sad.md) flows 3, 6

## Summary

`GET /api/v1/orders/:fileId` — replaces the old separate "quote-summary" + "SSE" routes, which no longer exist (ADR-0006 dropped the SSE push; the browser already has the quote via quote-engine's own WebSocket before this module is ever called, SAD §3). This route only serves: 404 "no quote available yet" when the document doesn't exist (AC-03), the already-recorded decision with no confirm/decline affordance if one exists (US-04, flow 6), or the quote fields already on the document plus confirm/decline affordance if no decision exists yet (the reopen-before-deciding case, also flow 6). No formal `openapi.yaml` exists for this feature — response shapes follow SAD §6's flows, not a contract; flagged for api-forge to formalize later.

## DoR

- T6 merged

## Scope

- Route composes T6's `getOrderState`: `not_found` → 404; `decided` → 200 with the recorded decision, no confirm/decline affordance; `ready` → 200 with the quote fields from the document and confirm/decline affordance shown

## Out of scope

- Confirm/decline actions themselves — T8, T9

## DoD

- Manual/curl smoke test hits all three cases (404 no-quote, 200 already-decided, 200 ready-to-decide) with response bodies matching SAD §6 flows 3/6
- Full automated coverage is T12's job, not a gate for this task's merge

## Deps

T6

## Estimate

S
