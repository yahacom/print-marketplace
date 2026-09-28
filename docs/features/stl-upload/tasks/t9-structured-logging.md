---
status: done
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T9 — Structured logging + request_id

**Links:** [SAD §8](../sad.md#8-crosscutting-concepts) (Logging row: structured JSON, `request_id`, no PII/file-content logged)

## Summary

Add structured JSON request logging to the upload route, with a `request_id` field per request. Explicitly must not log file content or any PII (PRD §6.1 classifies uploaded files as internal, not secret, but SAD §8 still excludes file content from logs).

## DoR

- T7 merged

## Scope

- Request-scoped `request_id` (generated or propagated from an inbound header)
- Structured JSON log line per request: method, path, status, duration, `request_id` — no file bytes/filename content

## Out of scope

- Metrics/alerting (T14) — this task is logging only

## DoD

- Manual check: a request produces one structured JSON log line containing `request_id`; no file content appears in logs

## Deps

T7

## Estimate

XS
