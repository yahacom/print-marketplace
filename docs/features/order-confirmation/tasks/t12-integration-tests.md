---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T12 — Integration tests — AC-01..AC-05

**Links:** [PRD §5 Acceptance criteria](../PRD.md#5-acceptance-criteria) (AC-01..AC-05) · [SAD §10 QG-1](../sad.md#10-quality-requirements) (domain-invariant concurrency test)

## Summary

End-to-end integration suite across T6-T10, using T3/T4's stubs (real quote-engine/stl-upload modules don't exist yet — see epic scope note) and the Firestore emulator (T2), covering every PRD acceptance criterion plus SAD §10 QG-1's concurrent-duplicate test.

## DoR

- T6, T7, T8, T9, T10 merged

## Scope

- AC-01 confirm happy path, AC-02 decline happy path, AC-03 no-quote-yet, AC-04 duplicate decision (including QG-1's two-concurrent-requests case — exactly one 201/200 and one 409), AC-05 model file gone

## Out of scope

- Load/latency testing — T13
- Real quote-engine/stl-upload integration (blocked, see epic scope note)

## DoD

- Each of AC-01 through AC-05 traceable to ≥1 passing test
- QG-1's concurrent duplicate-decision test passes: exactly one Firestore document created, exactly one 409 response

## Deps

T6, T7, T8, T9, T10

## Estimate

S
