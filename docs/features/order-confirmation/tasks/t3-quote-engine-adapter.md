---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T3 — quote-engine adapter + stub

**Links:** [ADR-0002](../adr/0002-use-in-process-module-calls-for-order-confirmation-integration.md) (in-process calls) · [SAD §6](../sad.md) flows 1, 3, 6 (quote-status polling, slicing-ready push) · [PRD §8](../PRD.md#8-open-questions) (quote-engine's final output contract — open)

## Summary

A typed port for reading quote status/summary from quote-engine, called in-process per ADR-0002. **quote-engine has no PRD/SAD/ADR or `src/` module yet** (project `CLAUDE.md`, PRD §8 open question) — this task can only define the interface shape SAD §6 assumes (`still_slicing | ready(quote, costBreakdown) | not_found`) plus a stub/fake implementation for T5/T7/T12 to build and test against. Wiring the real quote-engine module is out of scope until quote-engine ships and confirms its output contract.

## DoR

- T1 merged

## Scope

- `QuoteEngineAdapter` interface: `getQuoteStatus(id: string): Promise<"still_slicing" | { status: "ready"; quote: Quote; costBreakdown: CostBreakdown } | "not_found">`
- `subscribeToQuoteReady(id: string, onReady: (quote) => void): () => void` (for T7's SSE push)
- In-memory stub implementation with test seams to simulate all three states

## Out of scope

- Real integration with quote-engine's module (blocked — see Summary)
- Any assumption about `Quote`/`CostBreakdown` field names beyond what's needed to display a cost breakdown (PRD US-01) — treat as a minimal placeholder type, not a locked contract

## DoD

- Unit tests exercise the stub's three states
- Interface documented as provisional — a comment/README note points back to PRD §8's open question so a future PR swapping in the real quote-engine call is a drop-in replacement

## Deps

T1

## Estimate

S
