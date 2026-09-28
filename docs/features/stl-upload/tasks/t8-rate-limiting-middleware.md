---
status: done
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T8 — Rate limiting middleware

**Links:** [PRD §6.1](../PRD.md#61-security--privacy) abuse case #4 (30 uploads/min/IP) · [openapi.yaml](../contracts/openapi.yaml) `429` response (`upload.rate_limited`)

## Summary

Per-IP rate limit on `POST /api/v1/uploads`: 30 uploads/minute. Over the limit returns 429 with the `Error` body from openapi.yaml.

## DoR

- T7 merged

## Scope

- Middleware enforcing 30 req/min per client IP on the upload route
- 429 response body matches openapi.yaml's `upload.rate_limited` example

## Out of scope

- Distributed rate-limit state — single-instance deployment (SAD §7), in-memory counter is sufficient; do not add Redis or similar for v1

## DoD

- Test: 31st request within a 1-minute window from the same IP returns 429 with the correct body; 30th does not

## Deps

T7

## Estimate

S
