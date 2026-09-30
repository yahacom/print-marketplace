---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "04-05"
ticket: "<TBD>"
---

# 0002 — Serve upload-ui static assets from the existing Fastify app

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Yakiv Vakoliuk (Architect), during Socratic walk of sdlc:architecture-design

## Context

The `stl-upload` backend today serves only a JSON API (`POST /api/v1/uploads`) via Fastify — it does not serve any static assets. `stl-upload-ui` needs to be delivered to a browser somehow, and this decision determines whether the UI ships as part of the existing Fastify deployment unit or as a separately hosted static site.

## Decision drivers

- Constraints §2 — no deadline committed, but demo-driven urgency argues against adding new infrastructure to provision.
- ADR-0003 (stl-upload) already established a co-located-deployment convention (quote-engine reads files directly off the shared filesystem, no HTTP indirection) — this decision extends that same "keep it in one deployable" bias to the UI.
- Security constraint (PRD §6.1) — no accounts/auth; cross-origin requests would otherwise need CORS configuration on every request.

## Considered options

1. **Fastify serves static assets** — register `@fastify/static` in the existing `app.ts`, serving the built `dist-ui/` directory alongside the JSON API.
2. **Separate static host / CDN** — deploy the UI independently (e.g. a static hosting provider), decoupling its release cycle from the API's.

## Decision outcome

**Chosen:** Fastify serves static assets. Same-origin serving avoids introducing CORS handling into the API for what is currently a single consumer, and keeps the feature to one deployable unit — consistent with the existing co-located-deployment convention (ADR-0003, stl-upload) and with not provisioning new infrastructure for a demo-driven, size-S feature.

## Consequences

**Positive**
- No CORS configuration needed — UI and API share an origin.
- Single deployable unit; no new hosting infrastructure to provision or operate.
- Consistent with the repo's existing co-located-deployment precedent (ADR-0003).

**Negative**
- UI and API release cycles are coupled — a UI-only change still requires redeploying the whole service.
- Fastify process now serves two concerns (API + static assets), a mild departure from "one process, one job."

**Neutral**
- Splitting the UI out to a separate static host later remains possible; it would require adding CORS support to the API at that point.

## Links

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-use-preact-for-upload-ui]]
