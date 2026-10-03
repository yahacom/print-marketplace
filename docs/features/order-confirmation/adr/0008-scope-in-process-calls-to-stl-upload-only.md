---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0008 — Scope in-process module calls to stl-upload only; quote data flows through shared Firestore, not a quote-engine call

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner), narrowing ADR-0002 as a consequence of ADR-0006

## Context

ADR-0002 planned in-process function calls to both quote-engine and stl-upload. quote-engine shipped with no in-process read API for the quote — it's a one-shot WebSocket to the browser (quote-engine ADR-0001), and the quote itself is reached via the shared `draftOrders/{fileId}` document (ADR-0006), not a call into the quote-engine module. stl-upload is unaffected: it is still a local-filesystem module in the same Node process, and AC-05 still needs to check the model file exists before a confirm is accepted.

## Decision drivers

- ADR-0006 already removes the need for any quote-engine call.
- §2 Constraints: still one Node/TS monolith, no separate deploy units — the original rationale for calling stl-upload in-process (no network hop, no serialization, §1 QG-2 latency budget) is unchanged.
- Avoid leaving a stale cross-reference in sad.md/ADR-0002 that documents a call path that no longer exists.

## Considered options

1. **In-process call to stl-upload's model-repository only; no quote-engine call of any kind** — order-confirmation imports stl-upload's repository to check file existence (AC-05); quote data is reached exclusively through `draftOrders/{fileId}` per ADR-0006.
2. **Leave ADR-0002 as originally written** — keep documenting an in-process quote-engine call that the implementation will never make, misleading a future reader into looking for a call path that doesn't exist.

## Decision outcome

**Chosen:** Option 1. ADR-0002 is narrowed rather than left to describe a call that doesn't exist; its stl-upload-facing rationale (latency, same-process precedent) still holds verbatim.

## Consequences

**Positive**
- sad.md and the ADR set describe the actual integration surface: one in-process dependency (stl-upload), one shared-document dependency (Firestore `draftOrders`), zero direct dependency on quote-engine's code.
- Removes a documented call path implementers would otherwise build or look for.

**Negative**
- None beyond ADR-0002's own, unchanged for the stl-upload half.

**Neutral**
- ADR-0002 remains Accepted for its stl-upload-facing content; this ADR documents the narrowing rather than marking 0002 fully superseded, since the stl-upload decision itself did not change.

## Links

- PRD: [[../PRD.md]] AC-05
- SAD: [[../sad.md]] §3, §4, §5
- Related ADR: narrows [[0002-use-in-process-module-calls-for-order-confirmation-integration.md]]; depends on [[0006-record-decisions-on-quote-engines-draftorders-document.md]]
