---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0003 — Thread stl-upload's file-id as the shared quote/order id

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner) during the sad.md §4 Socratic walk

## Context

PRD §3 non-goals rule out quote editing, re-quoting, or decision reversal — one model maps to exactly one quote and, if confirmed, one order. The feature owner directed that the UUID v4 file-id stl-upload generates at upload time (stl-upload ADR-0005) is not replaced or re-minted at any later phase — the same value identifies the model through upload, slicing, and the final order record.

## Decision drivers

- PRD §3 non-goals: no re-quote / no decision reversal — a 1:1:1 mapping (model → quote → order) is already the intended shape.
- ADR-0004 (this feature): using this shared id as the Firestore document id is what makes AC-04's "exactly one decision per quote" enforceable via `create()` without extra locking.
- stl-upload ADR-0005: file-id is already an unguessable UUID v4 — reusable as-is, no new id-generation code needed.

## Considered options

1. **Reuse stl-upload's file-id end-to-end** — the same UUID v4 serves as file-id, quoteId, and order document id.
2. **Generate a fresh quoteId in quote-engine, and a fresh orderId in order-confirmation** — three independent identifiers, joined by foreign-key-style references.
3. **Generate a fresh quoteId in quote-engine, reuse it as the order id** — two identifiers (file-id, quoteId) instead of three.

## Decision outcome

**Chosen:** Option 1. A single id threaded through all three phases gives order-confirmation a trivial, race-free way to enforce "one decision per quote" (ADR-0004) and avoids building or maintaining an id-translation table between features.

## Consequences

**Positive**
- No id-mapping/translation logic needed between stl-upload, quote-engine, and order-confirmation.
- AC-04's domain invariant becomes a one-line Firestore `create()` call keyed by this id (ADR-0004), instead of a separate uniqueness check.

**Negative**
- quote-engine's own architecture has not been designed yet — this decision commits quote-engine to honoring the file-id as its quote identifier before quote-engine's own SAD exists. Tracked as a cross-feature risk in §11 until quote-engine's architecture-design pass confirms it (PRD §8 open question already covers the broader "quote-engine output contract").

**Neutral**
- Couples order-confirmation's data-model assumption to a decision made outside its own SAD — acceptable because PRD §3 non-goals already forecloses the alternative (per-phase distinct ids would only pay off if re-quoting existed).

## Links

- PRD: [[../PRD.md]] §3 Non-goals, §8 Open questions
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-store-order-records-in-firestore.md]], [[0004-use-firestore-document-create-for-exactly-once-decisions.md]]
