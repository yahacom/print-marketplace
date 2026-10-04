---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T13 — k6 load test

**Links:** [PRD §6 NFR](../PRD.md#6-non-functional-requirements) (latency, throughput) · [SAD §10 QG-2](../sad.md#10-quality-requirements)

## Summary

k6 script in CI asserting PRD §6's NFR targets: p95 confirm/decline write ≤300ms, p95 order-state read ≤200ms, ≥20 req/s per instance. Note SAD §11's open question: the ≤200ms "quote-summary display" NFR as originally worded no longer has a step inside this module to measure (the quote is shown by quote-engine's own WebSocket/UI before order-confirmation is called) — this task measures T7's GET (decision-state read) instead, pending the Tech Lead resolving that retargeting at stage 06 sign-off.

## DoR

- T8, T9, T10 merged

## Scope

- k6 script exercising confirm, decline, and the order-state GET route at ≥20 req/s per instance, staying under the rate-limit window per virtual session (coordinate with T10)

## Out of scope

- Availability/SLO measurement (PRD §6 — that's a production monitoring concern, T14)
- Resolving the QG-2 retargeting open question (SAD §11) — flag it in the report, don't decide it here

## DoD

- k6 script in CI asserts p95 ≤300ms (confirm/decline write) and p95 ≤200ms (order-state GET) at ≥20 req/s per instance
- Report notes the QG-2 retargeting ambiguity for the Tech Lead

## Deps

T8, T9, T10

## Estimate

S
