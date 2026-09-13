---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T6 — Quote-summary GET route

**Links:** [PRD AC-03](../PRD.md#5-acceptance-criteria) (no quote yet) · [SAD §6](../sad.md) flows 3, 6 (not-found; reopen-after-decision) · [PRD US-04](../PRD.md#4-user-stories)

## Summary

`GET` handler that shows the quote's cost breakdown for a given shared id (US-01), or falls through to: 404 "no quote available yet" with confirm/decline hidden (AC-03), or the already-recorded decision with no confirm/decline controls if one exists (US-04, SAD §6 flow 6). No formal `openapi.yaml` exists yet for this feature — response shapes follow SAD §6's flows, not a contract; flagged for api-forge to formalize later.

## DoR

- T5 merged

## Scope

- Route composes T5's `getQuoteForDisplay`: `not_found` → 404; `decided` → 200 with the recorded decision, no confirm/decline affordance; `ready` → 200 with quote + cost breakdown and confirm/decline affordance shown

## Out of scope

- SSE push for the "still slicing" case — T7
- Confirm/decline actions themselves — T8, T9

## DoD

- Manual/curl smoke test hits all three cases (404 no-quote, 200 already-decided, 200 ready-to-decide) with response bodies matching SAD §6's flows
- Full automated coverage is T12's job, not a gate for this task's merge

## Deps

T5

## Estimate

S
