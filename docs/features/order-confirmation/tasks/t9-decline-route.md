---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T9 — Decline POST route

**Links:** [PRD AC-02](../PRD.md#5-acceptance-criteria) (happy path) · [PRD AC-04](../PRD.md#5-acceptance-criteria) (duplicate decision) · [SAD §6](../sad.md) flows 2, 4

## Summary

`POST` handler that calls T5's `decide(id, "declined")` and maps the result: `"created"` → 200 decision recorded, no order placed; `"already_decided"` → 409 "this quote already has a final decision". Unlike confirm, decline does not check model-file existence (SAD §6 flow 5 is confirm-only).

## DoR

- T5 merged

## Scope

- `POST` decline handler with the two-way status mapping above

## Out of scope

- Rate limiting (T10), structured logging (T11) — separate middleware
- Confirm handling — T8

## DoD

- Manual/curl smoke test hits 200 and 409 (duplicate) with the exact messages from SAD §6 flows 2, 4

## Deps

T5

## Estimate

S
