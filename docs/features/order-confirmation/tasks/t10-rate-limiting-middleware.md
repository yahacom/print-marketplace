---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T10 — Rate limiting middleware

**Links:** [PRD §6.1](../PRD.md#61-security--privacy) abuse case "Spam create" — 10 confirm/decline attempts/min/session

## Summary

Middleware in front of T8/T9 enforcing 10 confirm/decline attempts per minute per session, per PRD §6.1's spam-create abuse case.

## DoR

- T8, T9 merged

## Scope

- Per-session rate limit (10/min) applied to confirm and decline routes
- 11th request in a window returns 429

## Out of scope

- Rate limiting on the order-state GET route (T7) — PRD §6.1 scopes this to confirm/decline attempts only

## DoD

- Test: 11th confirm/decline attempt within a minute for the same session returns 429; the window resets correctly

## Deps

T8, T9

## Estimate

S
