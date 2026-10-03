---
status: "Superseded by 0007"
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0004 — Use Firestore document create() for exactly-once decisions

- **Status:** Superseded by [[0007-firestore-transaction-with-decision-precondition-for-exactly-once.md]] — 2026-10-03
- **Date:** 2026-09-13
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner) during the sad.md §4 Socratic walk

> **2026-10-03 note:** ADR-0006 moved the write target to `draftOrders/{fileId}`, a document quote-engine already creates. `create()` would fail with `ALREADY_EXISTS` on every attempt, including the first. See ADR-0007 for the transaction-based replacement.

## Context

AC-04 requires that a quote receive at most one recorded decision — a duplicate confirm/decline (double-click, retry, back-button resubmit) must be rejected, not double-recorded. Firestore has no SQL-style `UNIQUE` constraint to lean on for this.

## Decision drivers

- AC-04 (domain invariant) and §1 QG-1 — the feature's top-priority quality goal.
- ADR-0001 (Firestore) and ADR-0003 (shared id) — this decision only works because both are already in place.
- PRD §3 non-goals: no edit/re-decide path exists, so a create-only (no update) write pattern is sufficient.

## Considered options

1. **Document id = shared id (ADR-0003) + Firestore `.create()`** — `create()` atomically fails with `ALREADY_EXISTS` if a document with that id already exists.
2. **Optimistic locking with a `version` field inside a Firestore transaction** — read the document, check no decision is recorded yet, write with an incremented version, retry on conflict.

## Decision outcome

**Chosen:** Option 1. `create()` gives atomicity for free from the Firestore SDK, requires no additional locking code, and matches the actual invariant precisely: since no revision path exists in v1 (PRD §3 non-goals), a single non-retryable write is all that's needed.

## Consequences

**Positive**
- Minimal implementation — no transaction/version-check code to write or test.
- Atomicity is guaranteed by Firestore itself, not by application logic that could have a race-condition bug.

**Negative**
- If a future release needs to revise or append to an existing order (contradicts current non-goals), this create-only pattern doesn't support it — a future feature would need to migrate to the transaction-based pattern (Option 2), superseding this ADR.

**Neutral**
- This decision is only correct because PRD §3 non-goals rule out edit/re-decide for v1; it would need to be revisited if that non-goal is lifted.

## Links

- PRD: [[../PRD.md]] AC-04, §3 Non-goals
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-store-order-records-in-firestore.md]], [[0003-thread-stl-uploads-file-id-as-the-shared-quote-order-id.md]]
