---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T5 — errors.ts

**Links:** [PRD AC-02, AC-03, AC-04](../PRD.md#5-acceptance-criteria) · [SAD §8 Crosscutting concepts](../sad.md#8-crosscutting-concepts) (error handling / mapping) · [SAD §10 QG-2](../sad.md#10-quality-requirements) · [stl-upload openapi.yaml](../../stl-upload/contracts/openapi.yaml) (error code catalog)

## Summary

A pure mapping module: backend `{code, message}` plus a network/timeout marker (from T4) → one of a fixed set of plain-language strings. Never surfaces raw backend `message` or stack detail (PRD §6.1 abuse case #3).

## Scope

- Map `upload.invalid_format` → distinct plain-language message (AC-02)
- Map `upload.file_too_large` → distinct plain-language message, never confused with invalid-format (AC-03)
- Map `upload.rate_limited` → distinct plain-language message (PRD §6.1 abuse case #4)
- Map unrecognized 5xx → generic "something went wrong, try again" message
- Map network/timeout marker → distinct "can't reach the server" message (AC-04)

## Out of scope

- Rendering (T7)
- XHR/network mechanics (T4)

## DoD

- Unit tests cover all 3 documented backend codes + unrecognized 5xx + network/timeout → 5 distinct message strings, none containing the raw backend `message` field

## Deps

—

## Estimate

XS
