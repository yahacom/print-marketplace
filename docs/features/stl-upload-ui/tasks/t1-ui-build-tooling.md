---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T1 — UI build tooling scaffold

**Links:** [SAD §2 Constraints](../sad.md#2-constraints), [SAD §5 Building block view](../sad.md#5-building-block-view) (`src/ui/` layout) · [ADR-0001](../adr/0001-use-preact-for-upload-ui.md) (Preact, Negative consequence: "needs a bundler/transform step")

## Summary

Introduces the repo's first frontend build step. No frontend framework, bundler, or `src/ui/` code exists yet. This task adds the Preact runtime dependency, JSX/TSX compiler config, and a build script that bundles `src/ui/**` into `dist-ui/`, per the `src/ui/` layout in SAD §5.

ADR-0001 accepts Preact but does not name a bundler. This task picks **esbuild** (zero-config, no new framework commitment) as the smallest tool satisfying that consequence — flag to Tech Lead before starting if a different choice is preferred.

## Scope

- Add `preact` (runtime) and `esbuild` (dev, bundler) dependencies
- `tsconfig` (or a dedicated `tsconfig.ui.json`) with `jsx: react-jsx`, `jsxImportSource: preact`, scoped to `src/ui/**`
- `npm run build:ui` script bundling `src/ui/main.tsx` → `dist-ui/main.js`, plus a minimal `dist-ui/index.html` shell
- Empty `src/ui/` directory structure per SAD §5 (`main.tsx`, `app.tsx`, `components/`, `upload-client.ts`, `errors.ts` as placeholders/stubs)

## Out of scope

- Any component logic, state machine, or upload logic (T2–T8)
- Fastify serving of `dist-ui/` (T9)

## DoD

- `npm run build:ui` emits `dist-ui/` from `src/ui/**`
- `tsc --noEmit` and `npm run lint` pass on the new `.tsx`/`.ts` files

## Deps

—

## Estimate

S
