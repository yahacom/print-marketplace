---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T14 — Deployment config + monitoring

**Links:** [SAD §7](../sad.md#7-deployment-view) (single VM, systemd/pm2, monitoring, scaling thresholds)

## Summary

Process supervisor config (systemd or pm2) to run stl-upload as a long-lived process on the target VM, plus the monitoring signals SAD §7 calls out: upload-validate request-duration latency metric, and an alert on a spike in 5xx on the upload endpoint.

## DoR

- T7 merged

## Scope

- systemd unit file or pm2 process config
- Latency metric wired (per-request duration)
- Alert rule for a 5xx spike on the upload endpoint

## Out of scope

- Multi-instance orchestration — blocked on ADR-0003's local-filesystem storage per SAD §7 Scaling thresholds; horizontal scaling is accepted debt (SAD §11), not this task's job

## DoD

- Service starts under the supervisor config on the target VM (or a staging equivalent) and restarts on crash
- Latency metric visible in the monitoring system; alert rule configured (can be a no-op/test-fire proof if the monitoring backend isn't live yet)

## Deps

T7

## Estimate

S
