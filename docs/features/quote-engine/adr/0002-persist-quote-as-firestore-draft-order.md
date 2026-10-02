---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-02"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0002 — Persist the computed quote to Firestore as a draft order, keyed by the shared file-id

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Yakiv Vakoliuk (Product Owner / Architect) during the sad.md §4 Socratic walk

## Context

order-confirmation — the next MVP step — needs the price/time/breakdown quote-engine produces. Its own architecture is already Accepted: Firestore for order records (order-confirmation ADR-0001), the quote re-derived live via an in-process call to quote-engine at confirm time (order-confirmation ADR-0002), no persisted quote snapshot anywhere (order-confirmation data-model.md), and the shared UUID v4 file-id threaded unchanged through upload → quote → order (order-confirmation ADR-0003). During this Socratic walk the product owner directed a different shape: quote-engine should itself write the computed quote into Firestore as a draft order at quote time, so the later confirm step acts on an already-existing record rather than recomputing. **This explicitly contradicts the already-Accepted order-confirmation design** — recorded as a deliberate override, not an oversight (see sad.md §1 ¶4).

## Decision drivers

- Product owner's explicit direction during this walk: store the quote in Firestore at quote time so order-confirmation "just confirms an existing draft."
- order-confirmation ADR-0003 (shared id) — reused here unchanged, so this decision does not introduce a second identifier scheme.
- Counter-driver (weighed and overridden): order-confirmation's own ADR-0001/0002/0004 and data-model.md already solved the "does order-confirmation trust client-submitted price" problem via live in-process recomputation, with no persistence needed on quote-engine's side at all.

## Considered options

1. **Stateless — export a function order-confirmation calls in-process, persist nothing** — matches order-confirmation's already-Accepted design (its ADR-0002, data-model.md) exactly; zero new infrastructure for quote-engine.
2. **Persist the quote in Firestore as a draft order, keyed by the shared file-id** — new `firebase-admin` dependency, new service-account credential, and a required rework of order-confirmation's ADR-0001/0002/0004 and data-model.md (its `create()`-based exactly-once mechanism assumed no pre-existing document; a pre-written draft turns the confirm step into an `update()`, which does not get the same atomicity for free).
3. **Persist the quote to the local filesystem (JSON file by id)** — same zero-new-infra pattern as stl-upload's own model storage (stl-upload ADR-0003), but doesn't give order-confirmation's Firestore-based confirm step anything it can `create()`/`update()` atomically without first reading the filesystem — mixes two storage technologies for one conceptual record.

## Decision outcome

**Chosen:** Option 2. The product owner's explicit direction overrides the simpler, already-accepted Option 1, accepting the follow-up cost of reworking order-confirmation's persistence design in exchange for a draft-order flow where confirm-time is a cheap update rather than a full re-slice.

## Consequences

**Positive**
- order-confirmation's confirm step no longer needs to re-invoke quote-engine (and re-run a ~60s slice) just to redisplay the price at decision time.
- Single source of truth for "what was this model quoted" lives in Firestore from the moment of slicing, not reconstructed on demand.

**Negative**
- **order-confirmation's already-Accepted architecture is now stale and must be reworked**: ADR-0001 ("Firestore for orders," written assuming orders are the only Firestore writer), ADR-0002 ("in-process live recomputation," no longer needed as the primary path), ADR-0004 ("`create()` for exactly-once," which assumed no document exists yet — a pre-existing draft makes confirm an `update()`, forfeiting that atomicity guarantee without a replacement, e.g. a transaction with a status-field check).
- New dependency (`firebase-admin`) and new credential-management surface (a Firestore service-account key) — the first cloud dependency and the first credential anywhere in this repo; CLAUDE.md's "no accounts" / filesystem-only framing no longer holds for this feature and needs an explicit update.
- Quote data now has a durability/retention question that didn't exist when it was stateless (how long does a draft live if never confirmed? PRD doesn't specify) — flagged as a new open item, not resolved here.

**Neutral**
- Reuses the existing shared id (file-id = quoteId = order-doc-id) from order-confirmation ADR-0003 unchanged — no third identifier scheme introduced.

## Links

- PRD: [[../PRD.md]] §1, §8 Open questions ("quote-engine's final output contract")
- SAD: [[../sad.md]] §1 ¶4, §4
- Related ADR (order-confirmation feature, now requiring rework): `../../order-confirmation/adr/0001-store-order-records-in-firestore.md`, `../../order-confirmation/adr/0002-use-in-process-module-calls-for-order-confirmation-integration.md`, `../../order-confirmation/adr/0003-thread-stl-uploads-file-id-as-the-shared-quote-order-id.md`, `../../order-confirmation/adr/0004-use-firestore-document-create-for-exactly-once-decisions.md`
