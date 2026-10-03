---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0007 — Use a Firestore transaction with a decision-field precondition for exactly-once confirm/decline

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner), superseding ADR-0004 as a direct consequence of ADR-0006

## Context

ADR-0004 planned `.create()` on a fresh document, keyed by the shared id, as the exactly-once guard for AC-04. ADR-0006 changes the write target to `draftOrders/{fileId}` — a document quote-engine already created via `.set()` before order-confirmation is ever called. `.create()` on that path would fail with `ALREADY_EXISTS` on every attempt, including the first legitimate confirm, not just a duplicate. AC-04 still requires that a quote receive at most one recorded decision.

## Decision drivers

- AC-04 (domain invariant) and §1 QG-1 — unchanged from ADR-0004, still the feature's top-priority quality goal.
- ADR-0006 — the write target is now a pre-existing document, which rules out `.create()` as the guard.
- PRD §3 non-goals: no edit/re-decide path, so the guard only needs to catch "already decided," not support revision.

## Considered options

1. **Firestore transaction: read `draftOrders/{fileId}`, abort if `decision` is already set, else write `decision` + `decidedAt`** — `runTransaction` retries automatically on contention; the precondition check happens inside the transaction so a concurrent second writer sees the just-committed `decision` field and aborts.
2. **A separate lock/mutex document per fileId, released after the decision write** — adds a second document and cleanup path for a guarantee Firestore transactions already provide natively.
3. **Optimistic concurrency via a Firestore `update()` precondition on `updateTime`** — compare-and-swap on the document's last-modified timestamp instead of checking the `decision` field directly; works but encodes the invariant as "the document hasn't changed since I read it," which is weaker than "no decision exists yet" (a quote-engine re-quote between read and write would also trip it, for the wrong reason).

## Decision outcome

**Chosen:** Option 1. A Firestore transaction is the native, SDK-guaranteed way to express "check-then-write atomically" without inventing a second document or relying on a side-channel precondition. It states the actual invariant (`decision` must be unset) rather than a proxy for it.

## Consequences

**Positive**
- Atomicity guaranteed by Firestore itself, consistent with ADR-0004's original rationale — no new locking primitive invented.
- The precondition is the actual business invariant ("no decision yet"), not a proxy like a timestamp compare — safe against a concurrent *order-confirmation* writer.

**Negative**
- Slightly more code than a bare `.create()` call: a transaction function, an explicit abort/throw on "already decided," and mapping that thrown error to the 409 response (AC-04).
- Firestore transactions retry automatically on contention, so the read-check-write body must stay side-effect-free outside the transaction's own write — a constraint `.create()` never required.
- **This transaction does not protect against quote-engine.** `quote-repository.ts`'s `writeDraftOrder` calls `draftOrders.doc(fileId).set(order)` with no `merge: true` — a re-quote of the same `fileId` replaces the *entire* document, including an already-set `decision`/`decidedAt`, with no check that a decision exists. A re-quote arriving after a confirm/decline silently erases the decision, defeating AC-04/QG-1 from the other direction. This transaction only guards against two order-confirmation writers racing each other, not against quote-engine's independent write. Tracked as a High-severity risk in sad.md §11 — the real fix is on quote-engine's side (reject re-quote once a decision exists, or `set(..., {merge: true})` plus a precondition), outside this ADR's scope.

**Neutral**
- If a future release needs decision revision (contradicts current PRD §3 non-goals), this pattern extends naturally — allow the transaction to overwrite under an explicit "supersede" flag — unlike ADR-0004's create-only pattern, which had no revision path at all.

## Links

- PRD: [[../PRD.md]] AC-04, §3 Non-goals
- SAD: [[../sad.md]] §4, §6
- Related ADR: supersedes [[0004-use-firestore-document-create-for-exactly-once-decisions.md]]; depends on [[0006-record-decisions-on-quote-engines-draftorders-document.md]], [[0003-thread-stl-uploads-file-id-as-the-shared-quote-order-id.md]]
