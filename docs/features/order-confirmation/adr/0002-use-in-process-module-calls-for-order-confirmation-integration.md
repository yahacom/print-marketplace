---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0002 — Use in-process module calls for order-confirmation integration

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner) during the sad.md §4 Socratic walk

## Context

order-confirmation needs the quote + cost breakdown from quote-engine to display (US-01) and needs to check with stl-upload that the model file still exists before confirming (AC-05). stl-upload's own SAD already established a precedent: quote-engine reads the validated model directly from local disk, without an HTTP call, because both are modules of the same Node.js/TypeScript monolith (no separate deploy units exist yet — §2 Constraints).

## Decision drivers

- §1 QG-2: p95 quote-summary display ≤200ms (PRD §6, verbatim) — an extra network hop plus JSON (de)serialization eats into this budget for no benefit while everything runs in one process.
- §2 Constraints: no deploy-unit split decided yet; introducing HTTP between modules that still ship as one process is unused complexity.
- Existing precedent: stl-upload sad.md §5 already has quote-engine reading stl-upload's storage directly, not via API call.

## Considered options

1. **In-process function calls** — order-confirmation imports and calls exported functions from the quote-engine and stl-upload modules directly within the same Node process.
2. **Synchronous HTTP calls between separate services** — order-confirmation, quote-engine, and stl-upload each run as independent HTTP services.

## Decision outcome

**Chosen:** Option 1, in-process function calls. Matches the established stl-upload↔quote-engine precedent, avoids unneeded network latency and serialization code for a system that is still one deployable process, and keeps within the solo-maintainer 2-week-scale effort budget (§2).

## Consequences

**Positive**
- Lowest possible latency between modules — direct function call, no serialization.
- No new infrastructure (no service discovery, no HTTP client/server boilerplate).
- Consistent with the existing stl-upload↔quote-engine integration style.

**Negative**
- If any of the three features is later split into a separately deployed service, every one of these calls must be rewritten as an HTTP/RPC call.
- No enforced schema contract at the call boundary — a TypeScript type change in one module can silently break a caller without a contract test, unlike an OpenAPI-checked HTTP boundary.

**Neutral**
- The exported function signatures become the de facto contract between modules until (if ever) an API-contract stage (stage 09/10) formalizes an HTTP boundary.

## Links

- PRD: [[../PRD.md]] §6 NFR
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0001-store-order-records-in-firestore.md]]
