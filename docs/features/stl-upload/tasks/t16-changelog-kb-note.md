---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T16 — CHANGELOG + KB note

**Links:** [PRD AC-05](../PRD.md#5-acceptance-criteria) (quote-engine handoff contract) · [openapi.yaml](../contracts/openapi.yaml)

## Summary

Close out the feature: CHANGELOG entry, and a short KB note documenting the upload contract quote-engine needs to consume — file-id format, storage path convention (`<file-id>.stl` under the shared directory, ADR-0003), and that stl-upload only guarantees declared format + size, not geometry validity — quote-engine must perform its own mesh/watertightness validation (ADR-0006).

## DoR

- T10, T13, T15 done

## Scope

- CHANGELOG entry for stl-upload's first release
- KB note (or README section) for quote-engine implementers: where to read the file, by what key, what "valid" already guarantees

## Out of scope

- Any code change — this is docs/release only

## DoD

- CHANGELOG entry merged
- KB note merged
- Tag created for this release

## Deps

T10, T13, T15

## Estimate

XS
