---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T12 — Integration tests — AC-01..AC-05 + QG-1 concurrency

**Links:** [PRD §5 Acceptance criteria](../PRD.md#5-acceptance-criteria) (AC-01..AC-05) · [SAD §10 QG-1](../sad.md#10-quality-requirements) (domain-invariant concurrency test)

## Summary

End-to-end integration suite across T7-T10, against the real stl-upload module (T5) and the Firestore emulator (T4), covering every PRD acceptance criterion plus SAD §10 QG-1's concurrent-duplicate test. Depends on T2 because QG-1's "exactly one decision" guarantee is only real once quote-engine's `writeDraftOrder` is merge-safe — without T2, a re-quote mid-test could erase the decision this suite asserts was recorded.

## DoR

- T2, T7, T8, T9, T10 merged

## Scope

- AC-01 confirm happy path, AC-02 decline happy path, AC-03 no-quote-yet, AC-04 duplicate decision (including QG-1's two-concurrent-requests case — exactly one 201/200 and one 409), AC-05 model file gone

## Out of scope

- Load/latency testing — T13
- Re-testing T2's merge-safety fix in isolation — that's T2's own DoD

## DoD

- Each of AC-01 through AC-05 traceable to ≥1 passing test
- QG-1's concurrent duplicate-decision test passes: exactly one `decision` write committed, exactly one 409 response

## Deps

T2, T7, T8, T9, T10

## Estimate

S
