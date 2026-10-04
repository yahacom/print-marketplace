---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T14 — Deployment config + monitoring

**Links:** [SAD §7](../sad.md) Deployment view (single process, systemd/pm2, monitoring, alerts — revised 2026-10-03)

## Summary

Deploy order-confirmation co-located in the same single Node/TS process as stl-upload/quote-engine (ADR-0002/0008 requires co-location for the stl-upload in-process call) under systemd/pm2, and wire the monitoring SAD §7 specifies. No SSE connections to track or scale (ADR-0005 dropped, SAD §7 revised) — this task no longer includes an open-connections counter.

## DoR

- T7, T8, T9 merged

## Scope

- systemd/pm2 unit running the service on the target VM
- Latency metrics wired: confirm/decline write p95, order-state GET p95
- Alert on a 409 spike on confirm/decline (PRD §6.1 spam-create signal)

## Out of scope

- Horizontal scaling / session affinity (SAD §7 — explicitly deferred, single instance in v1; would require splitting stl-upload into its own deploy unit, which revisits ADR-0002/0008)
- Any SSE connection tracking — none exists

## DoD

- Service runs on the target VM under systemd/pm2
- Latency metrics are visible on the monitoring dashboard
- 409-spike alert fires in a manual test (synthetic burst of duplicate confirms)

## Deps

T7, T8, T9

## Estimate

S
