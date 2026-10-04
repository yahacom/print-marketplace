---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T8 — Confirm POST route

**Links:** [PRD AC-01](../PRD.md#5-acceptance-criteria) (happy path) · [PRD AC-04](../PRD.md#5-acceptance-criteria) (duplicate decision) · [PRD AC-05](../PRD.md#5-acceptance-criteria) (model file gone) · [SAD §6](../sad.md) flows 1, 4, 5

## Summary

`POST /api/v1/orders/:fileId/confirm` — calls T6's `decide(fileId, "confirmed")` and maps the result: `"decided"` → 201 order confirmed; `"not_found"` → 404 `{code: "order.not_found", message: "no quote available yet"}`; `"already_decided"` → 409 `{code: "order.already_decided", message: "this quote already has a final decision"}`; `"file_missing"` → 409 `{code: "order.file_missing", message: "model needs to be re-uploaded before an order can be placed"}`. The `code` field is required (not just the message) so T17's UI client can key its own copy on it, same convention as `upload.*`/`quote.*` codes in `src/ui/errors.ts`. No formal `openapi.yaml` exists yet — response shapes follow SAD §6 flow 1's literal messages plus this task's code scheme.

## DoR

- T6 merged

## Scope

- `POST` confirm handler with the four-way status mapping above

## Out of scope

- Rate limiting (T10), structured logging (T11) — separate middleware
- Decline handling — T9

## DoD

- Manual/curl smoke test hits 201, 404 (not found), 409 (duplicate), 409 (file missing) with the exact messages from SAD §6 flow 1
- Full automated coverage is T12's job, not a gate for this task's merge

## Deps

T6

## Estimate

S
