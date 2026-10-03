---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead"]
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T2 — Fix quote-engine `draftOrders` merge-safety (re-quote erasing a decision)

**Links:** [SAD §11](../sad.md) risk row 3 (**High** severity) · [ADR-0007](../adr/0007-firestore-transaction-with-decision-precondition-for-exactly-once.md) consequences (names this exact gap) · [PRD AC-04](../PRD.md#5-acceptance-criteria)

## Summary

`quote-repository.ts`'s `writeDraftOrder` does `draftOrders.doc(fileId).set(order)` with no `merge: true`. A re-quote of the same `fileId` after a confirm/decline replaces the whole document, silently wiping `decision`/`decidedAt` and reopening an already-decided quote — this is flagged in `sad.md` §11 as a **High**-severity risk that "needs a quote-engine-side fix... out of this SAD's scope to decide unilaterally; raise with quote-engine's owner before either feature ships." Both modules share one owner in this repo, so this task makes that fix explicit and reviewable rather than leaving it unowned. **Treat the fix itself as requiring the same sign-off as any other change to quote-engine's shipped write path**, not as an incidental part of building order-confirmation.

## DoR

- T1 merged (this task edits the same file T1 touches)
- Tech Lead aware this is a quote-engine-side change being made from the order-confirmation epic (per SAD §11's explicit caveat)

## Scope

- `writeDraftOrder` changed to `draftOrders.doc(fileId).set(order, { merge: true })` so a re-quote only overwrites the quote fields it supplies, leaving any already-set `decision`/`decidedAt` untouched
- Regression test: write a draft order, simulate a decision being set (as T4's transaction would), re-write via `writeDraftOrder` with new quote numbers, assert `decision`/`decidedAt` survive and the quote fields update

## Out of scope

- Rejecting a re-quote outright once a decision exists (not required by AC-04 — AC-04 is about confirm/decline being decided once, not about quote-engine refusing to re-quote; `merge: true` is sufficient and SAD §11 lists it as an acceptable option)
- order-confirmation's own transaction logic — T4/ADR-0007, already guards against two order-confirmation writers; this task guards against the third writer (quote-engine itself)

## DoD

- `writeDraftOrder` uses `merge: true`
- New regression test passes: decision fields survive a re-quote; quote-engine's existing test suite otherwise green
- Change reviewed as a quote-engine write-path change, not rubber-stamped as an order-confirmation detail

## Deps

T1

## Estimate

S
