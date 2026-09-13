---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T8 — Confirm POST route

**Links:** [PRD AC-01](../PRD.md#5-acceptance-criteria) (happy path) · [PRD AC-04](../PRD.md#5-acceptance-criteria) (duplicate decision) · [PRD AC-05](../PRD.md#5-acceptance-criteria) (model file gone) · [SAD §6](../sad.md) flows 1, 4, 5

## Summary

`POST` handler that calls T5's `decide(id, "confirmed")` and maps the result: `"created"` → 201 order confirmed; `"already_decided"` → 409 "this quote already has a final decision"; `"file_missing"` → 409 "model needs to be re-uploaded before an order can be placed". No formal `openapi.yaml` exists yet — response shapes follow SAD §6 flows 1/4/5's literal messages.

## DoR

- T5 merged

## Scope

- `POST` confirm handler with the three-way status mapping above

## Out of scope

- Rate limiting (T10), structured logging (T11) — separate middleware
- Decline handling — T9

## DoD

- Manual/curl smoke test hits 201, 409 (duplicate), 409 (file missing) with the exact messages from SAD §6 flows 1, 4, 5
- Full automated coverage is T12's job, not a gate for this task's merge

## Deps

T5

## Estimate

S
