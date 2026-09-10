---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T6 — Upload service orchestration

**Links:** [SAD §5](../sad.md#5-building-block-view) (`services/` layer, upload-and-validate use case) · [SAD §6 flows 1-2](../sad.md#6-runtime-view) · [PRD AC-01, AC-02](../PRD.md#5-acceptance-criteria) · [ADR-0006](../adr/0006-descope-mesh-validation-to-quote-engine.md) (mesh/geometry validation is out of scope here — format/size check only) · [ADR-0004](../adr/0004-layered-architecture.md) (Negative consequence: `services/` risks becoming a god object — keep the format-check and repository-write calls as clearly separated internal functions)

## Summary

The use case that ties the format/size check and T5 (filesystem write) together: check declared content-type/extension, and based on the result either generate a file-id (T2) and persist the file, or return a typed rejection reason — with no HTTP concerns (those belong to T7). No mesh/geometry parsing happens here (ADR-0006).

## DoR

- T1, T5, T2 merged

## Scope

- `uploadAndValidate(buffer, declaredContentType, filename): Promise<UploadResult>` where `UploadResult` is a discriminated union: `{ kind: 'valid', fileId }` / `{ kind: 'invalid_format', reason }`
- Calls T5's `saveModel` only on the valid path

## Out of scope

- HTTP status-code mapping, multipart parsing, 413/429 handling (T7, T8)
- Any mesh/geometry parsing or watertightness check — out of scope for stl-upload entirely (ADR-0006)

## DoD

- Unit tests for both outcomes (valid / invalid_format), each asserting `saveModel` is called only on the valid path

## Deps

T1, T5, T2

## Estimate

S
