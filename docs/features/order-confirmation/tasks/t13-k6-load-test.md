---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T13 — k6 load test

**Links:** [PRD §6 NFR](../PRD.md#6-non-functional-requirements) (latency, throughput)

## Summary

k6 script in CI asserting PRD §6's NFR targets: p95 confirm/decline write ≤300ms, p95 quote-summary display ≤200ms, ≥20 req/s per instance.

## DoR

- T8, T9, T10 merged

## Scope

- k6 script exercising confirm, decline, and quote-summary routes at ≥20 req/s per instance, staying under the rate-limit window per virtual session (coordinate with T10)

## Out of scope

- Availability/SLO measurement (PRD §6 — that's a production monitoring concern, T14)

## DoD

- k6 script in CI asserts p95 ≤300ms (confirm/decline write) and p95 ≤200ms (quote-summary display) at ≥20 req/s per instance

## Deps

T8, T9, T10

## Estimate

S
