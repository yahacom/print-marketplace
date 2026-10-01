---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T6 — UploadProgress component

**Links:** [SAD §5](../sad.md#5-building-block-view) `UploadProgress.tsx` · [PRD §6 NFR](../PRD.md#6-non-functional-requirements) (progress ≥1 update/sec) · [PRD §1](../PRD.md#1-context) (author-overridden empty-file/divide-by-zero finding — client rejects 0-byte files before progress tracking begins, per T3's pre-check, so no guard needed here) · [PRD §3 non-goals](../PRD.md#3-non-goals) (no fabricated/cosmetic progress)

## Summary

Renders real byte-transfer progress fed by `upload-client.ts` (T4) progress events. Progress shown must reflect true transfer bytes only — no animation or estimation.

## Scope

- `UploadProgress` renders a percentage/bar driven by a `loaded`/`total` prop pair sourced from T4's `onprogress` events

## Out of scope

- Producing the progress events (T4)
- Deciding when to show this component vs. form/result (T2, T8)

## DoD

- Component test: renders updated progress for each of a synthetic sequence of progress events (≥1 render per event)

## Deps

T2, T4

## Estimate

XS
