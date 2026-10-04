---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T9 — Decline POST route

**Links:** [PRD AC-02](../PRD.md#5-acceptance-criteria) (happy path) · [PRD AC-04](../PRD.md#5-acceptance-criteria) (duplicate decision) · [SAD §6](../sad.md) flows 2, 4

## Summary

`POST /api/v1/orders/:fileId/decline` — calls T6's `decide(fileId, "declined")` and maps the result: `"decided"` → 200 decision recorded, no order placed; `"not_found"` → 404 `{code: "order.not_found", message: "no quote available yet"}` (flow 2's not-found branch, symmetric with confirm); `"already_decided"` → 409 `{code: "order.already_decided", message: "this quote already has a final decision"}`. Same `code` requirement as T8, for T17's UI client. Unlike confirm, decline does not check model-file existence (SAD §6 flow 5 is confirm-only).

## DoR

- T6 merged

## Scope

- `POST` decline handler with the three-way status mapping above

## Out of scope

- Rate limiting (T10), structured logging (T11) — separate middleware
- Confirm handling — T8

## DoD

- Manual/curl smoke test hits 200, 404 (not found), and 409 (duplicate) with the exact messages from SAD §6 flows 2, 4

## Deps

T6

## Estimate

S
