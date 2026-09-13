---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T2 — Firestore order repository

**Links:** [ADR-0001](../adr/0001-store-order-records-in-firestore.md) (Firestore) · [ADR-0004](../adr/0004-use-firestore-document-create-for-exactly-once-decisions.md) (`create()` exactly-once) · [data-model.md](../data-model.md) (`orders` collection shape)

## Summary

The `repositories/` layer for the single `orders` collection: `create(id, {decision, decided_at, model_file_ref})` keyed by the shared id, and `get(id)` for the reopen-after-decision read. `create()` must surface Firestore's `ALREADY_EXISTS` as a typed result (not a raw SDK error) so T5 can map it to AC-04's 409 without depending on Firestore-specific error shapes.

## DoR

- T1 merged

## Scope

- `createOrder(id: string, data: { decision: "confirmed" | "declined"; modelFileRef: string }): Promise<"created" | "already_exists">` — sets `decided_at` as a Firestore server timestamp
- `getOrder(id: string): Promise<OrderDoc | null>`

## Out of scope

- Any query across the collection (no such access pattern exists per data-model.md — no composite index needed)
- Update/delete — documents are immutable after creation (ADR-0004 accepted debt)

## DoD

- Unit/integration test (Firestore emulator): two concurrent `createOrder` calls with the same id resolve to exactly one `"created"` and one `"already_exists"`
- `getOrder` returns `null` for an unknown id and the persisted doc for a known one

## Deps

T1

## Estimate

S
