---
status: done
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T5 — Filesystem repository

**Links:** [ADR-0003](../adr/0003-local-filesystem-storage.md) (local filesystem, `<file-id>.stl` under a fixed directory) · [data-model.md](../data-model.md) (no relational entities — this is the entire persistence layer)

## Summary

The `repositories/` layer write path: given a file-id (T2) and validated bytes, write `<file-id>.stl` to a configurable directory on disk. ADR-0003's key-naming note: "expected to carry over unchanged if/when the backend migrates to object storage" — keep the function signature storage-agnostic (`save(fileId, buffer)`) so a later swap to object storage doesn't require touching callers.

## DoR

- T1, T2 merged

## Scope

- `saveModel(fileId: string, buffer: Buffer): Promise<void>` — writes to `<STORAGE_DIR>/<file-id>.stl`
- Storage directory configurable via env var, defaulting to a local path for dev

## Out of scope

- Any read path for quote-engine — per [openapi.yaml](../contracts/openapi.yaml), quote-engine reads the file directly off the shared filesystem (ADR-0003, SAD §7), not through this module's API; no read endpoint is in scope here
- Cleanup-on-disconnect (explicitly flagged as out of scope in data-model.md until it lands in PRD/SAD)

## DoD

- Unit test: after `saveModel`, the file exists at the expected path with matching bytes

## Deps

T1, T2

## Estimate

S
