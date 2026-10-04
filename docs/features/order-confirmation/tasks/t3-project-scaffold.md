---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T3 — Project scaffold + module skeleton

**Links:** [SAD §5](../sad.md) (layered style: `routes/`, `services/`, `repositories/`, `module.ts`)

## Summary

Wire the empty `src/modules/order-confirmation/` skeleton into the app, matching the layered style SAD §5 specifies (same convention as stl-upload/quote-engine).

## DoR

- SAD §5 reviewed

## Scope

- `src/modules/order-confirmation/{routes,services,repositories}/` directories
- `module.ts` self-wiring entrypoint, registered in `src/app.ts`

## Out of scope

- Any actual route/service/repository logic — later tasks

## DoD

- `tsc --noEmit` + lint pass
- Empty module wired via `module.ts` into `buildApp`

## Deps

—

## Estimate

S
