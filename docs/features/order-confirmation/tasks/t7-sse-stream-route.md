---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T7 — SSE stream route

**Links:** [ADR-0005](../adr/0005-use-server-sent-events-for-slicing-completion-updates.md) (SSE for slicing-completion) · [SAD §6](../sad.md) flow 1 (loading state → quote-ready push)

## Summary

`GET` SSE endpoint (`EventSource`-compatible) that streams a "still slicing" state and then a one-shot "quote ready" event, backed by T3's `subscribeToQuoteReady`. No reconnection/heartbeat handling for long-running slicing jobs (ADR-0005 accepted debt, out of scope for v1).

## DoR

- T3 merged

## Scope

- SSE endpoint holding the connection open, pushing a "still slicing" event immediately and a "quote ready" event when T3's stub/adapter signals readiness
- Connection closes after the "quote ready" event is sent

## Out of scope

- Reconnection/heartbeat for long slicing jobs (ADR-0005 Neutral, accepted debt)
- Cross-instance session affinity (SAD §7 — single instance in v1)

## DoD

- Manual test: client receives the loading event, then the ready event, then the connection closes, using T3's stub to simulate timing

## Deps

T3

## Estimate

S
