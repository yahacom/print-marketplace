---
status: "Superseded by 0006 (collection framing only — Firestore itself still stands)"
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0001 — Store order records in Firestore

- **Status:** Superseded by [[0006-record-decisions-on-quote-engines-draftorders-document.md]] — 2026-10-03
- **Date:** 2026-09-13
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner) during the sad.md §3-§4 Socratic walk

> **2026-10-03 note:** Firestore-as-storage (the choice this ADR argues for) still stands. What's superseded is the "separate order-record document" framing: quote-engine shipped with its own `draftOrders/{fileId}` document, and order-confirmation now records the decision on that same document instead of a new one. See ADR-0006.

## Context

order-confirmation is the marketplace's first feature that persists an order record (PRD §6.1). Every confirm/decline decision must be durably recorded, with p95 write latency ≤300ms and duplicate confirm/decline rejected, not double-recorded (PRD §6, AC-04). No database or hosting choice existed anywhere in the repo before this decision (§2 Constraints — greenfield).

## Decision drivers

- PRD §6 NFR: p95 confirm/decline write ≤300ms; concurrency-safety on the same quote (AC-04).
- §2 Constraints: solo maintainer, ~2-week effort budget, no existing DB infrastructure to reuse.
- §1 QG-1: domain-invariant correctness is the feature's top quality goal.

## Considered options

1. **Firestore** — Google Cloud managed NoSQL document store.
2. **Postgres** — self-hosted or managed relational database.
3. **Local filesystem (JSON file per order)** — same pattern as stl-upload's model storage (ADR-0003 in stl-upload).

## Decision outcome

**Chosen:** Option 1, Firestore. No database server to provision or operate within the solo-maintainer budget; native Node.js SDK; atomic per-document writes meet the latency budget with margin; durability/replication are handled by the managed service without extra setup.

## Consequences

**Positive**
- No new infrastructure to provision, patch, or back up.
- Atomic single-document writes/reads fit the "one decision per quote" access pattern exactly.

**Negative**
- Vendor lock-in to Google Cloud; migrating later requires a data migration and a rewrite of the storage-access code.
- No native cross-collection JOINs — a future "all orders with quote details" report requires either denormalized data or multiple reads merged in application code.
- Billed per read/write operation rather than a fixed instance cost.

**Neutral**
- The document-shaped schema (see ADR-0003, ADR-0004) is expected to carry over largely unchanged if the backend later migrates to a relational store — same key, different store.

## Links

- PRD: [[../PRD.md]] §6.1, §6
- SAD: [[../sad.md]] §3, §4
- Related ADR: [[0002-use-in-process-module-calls-for-order-confirmation-integration.md]], [[0003-thread-stl-uploads-file-id-as-the-shared-quote-order-id.md]], [[0004-use-firestore-document-create-for-exactly-once-decisions.md]]
