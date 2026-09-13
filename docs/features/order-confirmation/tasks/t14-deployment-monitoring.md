---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T14 — Deployment config + monitoring

**Links:** [SAD §7](../sad.md) Deployment view (single process, systemd/pm2, monitoring, alerts)

## Summary

Deploy order-confirmation co-located in the same single Node/TS process as stl-upload/quote-engine (ADR-0002 requires co-location) under systemd/pm2, and wire the monitoring SAD §7 specifies.

## DoR

- T7, T8, T9 merged

## Scope

- systemd/pm2 unit running the service on the target VM
- Latency metrics wired: confirm/decline write p95, quote-summary display p95
- Open-SSE-connections counter (ADR-0005 negative — new operational parameter)
- Alert on a 409 spike on confirm/decline (PRD §6.1 spam-create signal)

## Out of scope

- Horizontal scaling / session affinity for SSE (SAD §7 — explicitly deferred, single instance in v1)

## DoD

- Service runs on the target VM under systemd/pm2
- Latency metrics and the SSE-connection counter are visible on the monitoring dashboard
- 409-spike alert fires in a manual test (synthetic burst of duplicate confirms)

## Deps

T7, T8, T9

## Estimate

S
