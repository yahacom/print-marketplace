---
status: Not started
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T9 — Fastify static serving

**Links:** [ADR-0002](../adr/0002-serve-upload-ui-static-assets-from-fastify.md) (Fastify serves static assets) · [SAD §5](../sad.md#5-building-block-view) (`src/app.ts` gains `@fastify/static` registration)

## Summary

The one backend-side change this feature makes: register `@fastify/static` in the existing `src/app.ts` to serve the built `dist-ui/` directory alongside the existing JSON API, per ADR-0002 (same-origin, single deployable, no CORS).

## Scope

- Add `@fastify/static` dependency
- Register it in `src/app.ts` pointing at `dist-ui/`, serving `index.html` at `GET /`
- No changes to the existing `stl-upload` module or its routes

## Out of scope

- Anything under `src/ui/` (T1–T8)
- Deployment/infra changes (SAD §7 — none needed, reuses existing deployment unit)

## DoD

- Test in `app.test.ts` (or a sibling): `GET /` returns 200 serving the built `dist-ui/index.html`
- Existing `POST /api/v1/uploads` tests remain green (no regression)

## Deps

T1

## Estimate

S
