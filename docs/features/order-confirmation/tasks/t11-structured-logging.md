---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T11 — Structured logging

**Links:** [SAD §8](../sad.md) Crosscutting concepts — Logging

## Summary

Structured JSON logging with a `request_id` field on all order-confirmation routes, per SAD §8's convention. No decision content beyond id/status is logged (SAD §8, PRD §6.1 data classification — no new PII).

## DoR

- T7, T8, T9 merged

## Scope

- `request_id` attached and logged on every request to T7/T8/T9's routes

## Out of scope

- Any SSE or streaming log path — none exists (ADR-0005 dropped, SAD §7)

## DoD

- Every request logs `request_id` as structured JSON; log output contains no decision content beyond id/status (manual review of sample log lines)

## Deps

T7, T8, T9

## Estimate

XS
