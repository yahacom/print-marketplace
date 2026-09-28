---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T1 — Project scaffold + module skeleton

**Links:** [SAD §5](../sad.md#5-building-block-view) (layer diagram) · [ADR-0004](../adr/0004-layered-architecture.md) (layered architecture) · [CLAUDE.md](../../../../CLAUDE.md) (Node.js/TypeScript stack — the only pre-existing decision)

## Summary

First code in this greenfield repo. Set up the Node.js/TypeScript project (`package.json`, `tsconfig.json`, lint/format config, test runner) and create the empty layer skeleton at `src/modules/stl-upload/{routes,services,repositories}/` plus a `module.ts` self-wiring file, per the SAD §5 building-block diagram. No business logic — this task only makes the layers exist and buildable.

## DoR

- SAD §5 status: Approved

## Scope

- `package.json` + `tsconfig.json` + lint/format config (implementer's choice of HTTP framework is not fixed by any ADR — pick a minimal one, e.g. Express/Fastify; not an architecturally significant decision per ADR-0004's rationale for keeping this module lightweight)
- Empty `src/modules/stl-upload/routes/`, `services/`, `repositories/` directories
- `module.ts` wiring stub, mounted into a minimal app entrypoint that starts and responds to a health check

## Out of scope

- Any upload/validation logic (T6, T7)
- CI pipeline beyond what's needed to run `tsc`/lint locally (assume repo-level CI setup is separate)

## DoD

- `tsc --noEmit` and lint pass
- App entrypoint starts locally and responds on a health-check route — an automated test using the framework's in-process request injection (e.g. Fastify's `app.inject()`) against the mounted route is sufficient proof; a real port bind is not required for this DoD to pass
- `module.ts` wires the three empty layer directories per SAD §5

## Deps

None — first task.

## Estimate

S
