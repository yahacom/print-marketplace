---
status: Not started
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T10 — NFR verification checklist

**Links:** [SAD §10 QG-1](../sad.md#10-quality-requirements) · [SAD §11 Risks and technical debt](../sad.md#11-risks-and-technical-debt) (accepted debt: no automated browser-perf test) · [PRD §6 NFR](../PRD.md#6-non-functional-requirements)

## Summary

QG-1 (time-to-first-visible-feedback ≤2000ms, progress ≥1 update/sec, p95 submit→result ≤10500ms) has no automated browser-perf test in this pass (SAD §11 accepted debt — adding Playwright/similar for one NFR is out of scope). This task produces the manual verification checklist and runs it once against the built UI.

## Scope

- Checklist doc: steps to capture `performance.now()` timestamps at file-select, first render, each progress event, and result-shown
- One manual dry run against the deployed/built `dist-ui/` recording actual measured values against the three targets

## Out of scope

- Any automated browser-perf tooling (explicitly deferred per SAD §11)
- Component/unit tests (covered in T2–T8)

## DoD

- Checklist doc committed under `docs/features/stl-upload-ui/`
- One manual dry-run result recorded, showing all three QG-1 targets met (or a flagged miss with follow-up)

## Deps

T8, T9

## Estimate

XS
