---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T16 — CHANGELOG + KB note

**Links:** [PRD §8](../PRD.md#8-open-questions) open questions (no-authz v1 gap) · [SAD §11](../sad.md) accepted debt (co-owned document, draftOrders misnomer)

## Summary

CHANGELOG entry and a short KB note documenting: the order-confirmation contract as shipped (GET/POST on `draftOrders/{fileId}`, no quote-engine call, no SSE), T2's merge-safety fix and why it was needed, and the still-open items — PRD §8's no-authz v1 gap, SAD §11's QG-2 retargeting question (flagged by T13), and `data-model.md`'s stale `orders`-collection description (flagged by this epic, not fixed here).

## DoR

- T12, T13, T15, T18 done

## Scope

- CHANGELOG entry
- KB note covering the final `draftOrders/{fileId}` contract and the open items above, as a handoff note for whoever runs `sdlc:generate-data-model` to refresh `data-model.md` and whoever resolves SAD §11's QG-2 question at stage 06
- KB note also flags the still-open US-04/US-05 "reopen after reload" gap (T18 out-of-scope note) — the SPA has no routing/persisted `fileId`, so reopening a past quote is not yet possible even though T7's GET route supports it server-side

## Out of scope

- Resolving PRD §8's or SAD §11's open questions — tracked there, not here
- Rewriting `data-model.md` — flagged, not this task's job

## DoD

- CHANGELOG entry merged
- KB note merged
- Tag created

## Deps

T12, T13, T15, T18

## Estimate

XS
