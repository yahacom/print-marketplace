---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T2 — File-id generator

**Links:** [ADR-0005](../adr/0005-uuid-v4-file-id.md) (UUID v4, sole access control) · [PRD AC-04](../PRD.md#5-acceptance-criteria)

## Summary

A single utility function that generates the file-id: `crypto.randomUUID()` wrapped so callers (T5 repository, T6 service) depend on one seam, not the raw Node API directly.

## DoR

- T1 merged

## Scope

- `generateFileId(): string` returning a UUID v4 string

## Out of scope

- Any storage or HTTP wiring (T5, T6, T7)

## DoD

- Unit tests: returned value matches UUID v4 format; N consecutive calls produce distinct ids

## Deps

T1

## Estimate

XS
