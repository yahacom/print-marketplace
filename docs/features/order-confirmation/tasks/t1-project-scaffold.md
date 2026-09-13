---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T1 — Project scaffold + module skeleton

**Links:** [SAD §5](../sad.md) (layered style: `routes/`, `services/`, `repositories/`, `module.ts`)

## Summary

Wire the empty `src/modules/order-confirmation/` skeleton into a starting app, matching the layered style SAD §5 specifies (same convention as stl-upload ADR-0004).

## DoR

- SAD §5 Approved

## Scope

- `src/modules/order-confirmation/{routes,services,repositories}/` directories
- `module.ts` self-wiring entrypoint

## Out of scope

- Any actual route/service/repository logic — later tasks

## DoD

- `tsc --noEmit` + lint pass
- Empty module wired via `module.ts` into a starting app

## Deps

—

## Estimate

S
