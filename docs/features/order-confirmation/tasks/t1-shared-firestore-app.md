---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-03"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T1 — Shared `firestore-app.ts` singleton

**Links:** [SAD §5](../sad.md) (new `src/shared/firestore-app.ts`) · [SAD §7](../sad.md) (shared boot-failure risk) · [SAD §11](../sad.md) risk row 2 (touches shipped quote-engine code)

## Summary

`firebase-admin`'s `initializeApp()` throws on a second default-app init, so order-confirmation can't call it again once quote-engine already has. Extract the single `initializeApp({ credential: cert(...) })` call currently inline in `src/modules/quote-engine/repositories/quote-repository.ts` into `src/shared/firestore-app.ts`, and have quote-engine's repository import it instead of calling `initializeApp` itself. T4's order repository will be the second caller.

## DoR

- SAD §5 reviewed

## Scope

- `src/shared/firestore-app.ts` exporting a function that reads `FIRESTORE_CREDENTIALS_JSON`, parses it, and returns a memoized Firestore app instance (same fail-fast-on-missing/malformed-credential behavior `createQuoteRepository` has today — preserve it, don't just move the happy path)
- `quote-repository.ts` updated to call the shared function instead of `initializeApp`/`cert` directly

## Out of scope

- Any change to `writeDraftOrder`'s write semantics — T2
- order-confirmation's own repository — T4

## DoD

- quote-engine's existing repository test suite (`quote-repository.test.ts`) passes unchanged in behavior (same fail-fast messages, same mocked calls shape adjusted only for the new import)
- New unit test for `firestore-app.ts`: missing/malformed `FIRESTORE_CREDENTIALS_JSON` fails the same way the old inline code did; a second call returns the same memoized instance (no second `initializeApp`)

## Deps

—

## Estimate

S
