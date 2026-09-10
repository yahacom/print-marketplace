---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T13 — k6 smoke test

**Links:** [PRD §6](../PRD.md#6-non-functional-requirements) Latency p95 ≤10000ms, Throughput ≥5 req/s · [SAD §10 QG-3](../sad.md#10-quality-requirements)

## Summary

k6 smoke test in CI asserting the two NFR targets: p95 upload-validate latency ≤10000 ms, throughput ≥5 req/s per instance, using a representative valid STL fixture.

## DoR

- T7, T8 merged

## Scope

- k6 script hitting `POST /api/v1/uploads` with a representative-size valid STL, at a load profile that exercises ≥5 req/s
- CI step running the script and failing the build if p95 > 10000 ms

## Out of scope

- Multi-instance/horizontal load testing — SAD §7 pins v1 to a single instance

## DoD

- k6 script committed, runs in CI, asserts both thresholds

## Deps

T7, T8

## Estimate

S
