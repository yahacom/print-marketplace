---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0006 — Record confirm/decline decisions directly on quote-engine's draftOrders document

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner) during the sad.md §3/§4 revision Socratic walk, prompted by quote-engine having shipped with a different contract than ADR-0001/0002/0005 assumed

## Context

order-confirmation's original ADR-0001 planned a dedicated Firestore order record, read in-process from quote-engine. quote-engine has since shipped (`docs/features/quote-engine/kb-quote-contract.md`, ADR-0002) with its own persistence: it writes the full quote (price, breakdown, filename, timings) to `draftOrders/{fileId}` via `Firestore.set()` before pushing `quote.done` to the browser over its own WebSocket. By the time a user reaches the confirm/decline UI in the same session, the browser already has everything it needs to display — it only needs to tell the backend a `fileId` and a decision; POST /confirm and /decline never need to read the quote fields. The one exception is reopening the screen later (US-04, no live session): the GET endpoint does return the quote fields already on the document for that case, since there is no other source for them — this is still a plain Firestore read of data quote-engine already wrote, not a new coupling to quote-engine's code or WebSocket.

## Decision drivers

- Minimize new coupling to a quote-engine that has already shipped and is tested — avoid changing its code or adding a read API it doesn't have.
- §1 QG-2 (p95 quote-summary display ≤200ms) is moot for this flow now: the browser already has the quote before order-confirmation is ever called, so there is no display-latency budget to protect in this module.
- PRD §3 non-goals: model:quote:order stays 1:1:1 — one Firestore document per fileId is enough to represent the whole lifecycle (quoted → confirmed/declined).

## Considered options

1. **Record the decision as new fields on the existing `draftOrders/{fileId}` document** — order-confirmation reads/writes the same document quote-engine already created, adding `decision` and `decidedAt` fields.
2. **A separate `orders` collection, keyed by the same shared id** — order-confirmation owns its own collection, decoupled from quote-engine's schema, but must separately fetch or duplicate quote data from `draftOrders` to avoid a data-less order record.
3. **In-process read from quote-engine + a new orders collection** — the original ADR-0001/0002 design: order-confirmation calls into quote-engine to read the live quote and writes its own order record.

## Decision outcome

**Chosen:** Option 1. The quote data is already in Firestore and order-confirmation doesn't need to re-read or duplicate it — it only needs to flip the document from "quoted" to "decided." This avoids a second collection, avoids copying data that can go stale relative to its source, and needs no new quote-engine API. It supersedes ADR-0001's "separate order record" framing and makes ADR-0005 (SSE push) moot — see links.

## Consequences

**Positive**
- No new coupling surface on quote-engine — order-confirmation never calls into it, in-process or otherwise.
- No data duplication/staleness risk between an order record and the quote it's based on — there is only one document.
- Removes the entire "quote ready" push problem (ADR-0005) — the browser already has the quote by the time this module is involved.

**Negative**
- order-confirmation now writes into a collection whose shape (`DraftOrder` type) is defined and owned by quote-engine's code (`src/modules/quote-engine/repositories/quote-repository.ts`). A quote-engine schema change can silently break order-confirmation's write path with no compiler-enforced contract between the two modules — tracked as accepted debt in sad.md §11.
- The document's purpose is no longer single-owner: quote-engine writes the quote fields, order-confirmation writes the decision fields. Two modules co-owning one document is a deliberate trade against standard single-writer practice.

**Neutral**
- `draftOrders` is a slight misnomer once a document can carry a final decision — left as-is rather than renaming a collection quote-engine already ships with; flagged for `sdlc:fix-term` / a future rename pass.

## Links

- PRD: [[../PRD.md]] §1, §3 Non-goals
- SAD: [[../sad.md]] §3, §4, §5
- Related ADR: supersedes [[0001-store-order-records-in-firestore.md]] (separate-collection framing) and [[0005-use-server-sent-events-for-slicing-completion-updates.md]] (push mechanism no longer needed); see also quote-engine's `0002-persist-quote-as-firestore-draft-order.md`
