---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T11 — Structured logging

**Links:** [SAD §8](../sad.md) Crosscutting concepts — Logging

## Summary

Structured JSON logging with a `request_id` field on all order-confirmation routes, per SAD §8's convention. No decision content beyond id/status is logged (SAD §8, PRD §6.1 data classification — no new PII).

## DoR

- T6, T8, T9 merged

## Scope

- `request_id` attached and logged on every request to T6/T8/T9's routes

## Out of scope

- Logging on T7's SSE route (covered incidentally if it shares the same middleware chain, not a separate requirement)

## DoD

- Every request logs `request_id` as structured JSON; log output contains no decision content beyond id/status (manual review of sample log lines)

## Deps

T6, T8, T9

## Estimate

XS
