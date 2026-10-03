---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T4 — Order repository over `draftOrders`

**Links:** [ADR-0006](../adr/0006-record-decisions-on-quote-engines-draftorders-document.md) (shared document) · [ADR-0007](../adr/0007-firestore-transaction-with-decision-precondition-for-exactly-once.md) (transaction precondition) · [SAD §5](../sad.md) `repositories/` · [`kb-quote-contract.md`](../../quote-engine/kb-quote-contract.md) (`DraftOrder` shape)

## Summary

The `repositories/` layer reading and writing quote-engine's `draftOrders/{fileId}` document (not a new collection — ADR-0006). `get(fileId)` returns the document (quote fields + `decision`/`decidedAt` if set) or not-found, for AC-03/US-04. `decide(fileId, decision)` runs a Firestore transaction that re-reads the document, aborts if `decision` is already set, otherwise writes `decision` + `decidedAt` (server timestamp) — ADR-0007. This repository does not call `writeDraftOrder` or otherwise touch quote-engine's write path (that's T2's job, and T2's `merge: true` fix is what keeps a concurrent re-quote from undoing this task's write).

## DoR

- T1, T3 merged

## Scope

- `getDraftOrder(fileId: string): Promise<DraftOrder & Partial<DecisionFields> | NotFound>` — reuses quote-engine's `DraftOrder` type (import, don't redefine) plus `decision?: "confirmed" | "declined"`, `decidedAt?: Timestamp`
- `decideOrder(fileId: string, decision: "confirmed" | "declined"): Promise<"decided" | "already_decided" | "not_found">` — Firestore transaction: read, branch on not-found / `decision` already set / unset-then-write

## Out of scope

- Any write to the quote fields (`price`, `breakdown`, etc.) — quote-engine-only, per ADR-0006
- stl-upload's file-existence check — T5

## DoD

- Integration test (Firestore emulator): two concurrent `decideOrder` calls on the same `fileId` resolve to exactly one `"decided"` and one `"already_decided"`
- `getDraftOrder` returns not-found for an unknown `fileId`, the full document (quote + decision fields) for a decided one, and the document without decision fields for an undecided one

## Deps

T1, T3

## Estimate

M
