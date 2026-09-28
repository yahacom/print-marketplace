---
status: done
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T7 — Upload HTTP route

**Links:** [openapi.yaml](../contracts/openapi.yaml) `POST /api/v1/uploads` (request/response schemas, examples) · [PRD AC-01, AC-02](../PRD.md#5-acceptance-criteria) · [PRD §6](../PRD.md#6-non-functional-requirements) (50 MB max file size)

## Summary

The `routes/` layer HTTP handler: accept the multipart upload, enforce the 50 MB size limit before handing bytes to T6's service, and map the service result (plus the size-limit case) to the exact status codes and response bodies in `openapi.yaml` — 201/`UploadAccepted`, 400/`Error` (`upload.invalid_format`), 413/`Error` (`upload.file_too_large`).

## DoR

- T6 merged

## Scope

- `POST /api/v1/uploads` handler: multipart parse → size check (413 if over 50 MB, before calling the service) → `uploadAndValidate` → status/body mapping per openapi.yaml
- Response bodies match the `Error`/`UploadAccepted` schemas exactly, including the plain-language `message` text from the openapi examples (PRD §2 goal: no mesh-repair jargon)

## Out of scope

- Rate limiting (T8), structured logging (T9) — wired as separate middleware in later tasks
- 429 response (produced by T8, not this task)

## DoD

- Manual/curl smoke test hits 201, 400, 413 with the exact response bodies from openapi.yaml examples
- Full automated contract coverage is T10's job, not a gate for this task's merge

## Deps

T6

## Estimate

M
