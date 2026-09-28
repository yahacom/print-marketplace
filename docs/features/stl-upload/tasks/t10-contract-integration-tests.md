---
status: done
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T10 — Contract/integration tests

**Links:** [PRD AC-01, AC-02, AC-04, AC-05](../PRD.md#5-acceptance-criteria) · [openapi.yaml](../contracts/openapi.yaml) (all response schemas/examples) · [SAD §6 flows 1-3](../sad.md#6-runtime-view)

## Summary

End-to-end integration test suite against the running route (T7) + rate limiter (T8), asserting every response code and body in openapi.yaml, and tracing each to its PRD acceptance criterion.

## DoR

- T7, T8 merged

## Scope

- 201 valid upload (AC-01) → response matches `UploadAccepted` schema
- 400 invalid format (AC-02) → `upload.invalid_format`
- 413 oversized file (PRD §6 max file size)
- 429 rate limited (T8)
- AC-04 (unguessable identifier): assert file-id is not derivable/predictable from request metadata
- AC-05 (quote-engine handoff): assert the file written by T5 is readable directly off disk by file-id, matching the id returned in the 201 response

## Out of scope

- Mesh/geometry adversarial fixtures and watertightness testing — out of scope for stl-upload entirely (ADR-0006); no equivalent of the former T11 exists in this feature
- Load/throughput testing — that's T13

## DoD

- All of AC-01, AC-02, AC-04, AC-05 have ≥1 passing automated test, each test named/commented with the AC it covers
- Suite runs in CI

## Deps

T7, T8

## Estimate

S
