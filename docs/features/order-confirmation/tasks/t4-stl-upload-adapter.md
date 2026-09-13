---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T4 — stl-upload adapter + stub

**Links:** [ADR-0002](../adr/0002-use-in-process-module-calls-for-order-confirmation-integration.md) (in-process calls) · [SAD §6](../sad.md) flow 5 (AC-05, live model-file-exists check) · [PRD §8](../PRD.md#8-open-questions) (retention/snapshot open question — SAD §11 already resolved it as a live check)

## Summary

A typed port for checking, at confirm time, that the model file stl-upload owns still exists (AC-05). stl-upload has full SDLC docs but **no `src/` module exists yet either** — this task defines the interface and a stub/fake for T5/T12 to build and test against; wiring the real stl-upload module is out of scope until it ships.

## DoR

- T1 merged

## Scope

- `StlUploadAdapter` interface: `modelFileExists(modelFileRef: string): Promise<boolean>`
- In-memory stub with test seams for both outcomes

## Out of scope

- Real integration with stl-upload's module (blocked — see Summary)
- Any check beyond existence (content/geometry validation is stl-upload/quote-engine's concern, not this feature's — SAD §12 glossary)

## DoD

- Unit tests exercise both stub outcomes (exists / not found)
- Interface documented as provisional, pointing back to PRD §8's open question

## Deps

T1

## Estimate

S
