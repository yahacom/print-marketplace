---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "04-05"
ticket: "<TBD>"
---

# 0001 — Use Preact for upload-ui

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Yakiv Vakoliuk (Architect), during Socratic walk of sdlc:architecture-design

## Context

`stl-upload-ui` is the first browser-facing code in a repo that today is a Node.js/TypeScript Fastify backend with no frontend framework, bundler, or UI code of any kind. PRD §8 explicitly deferred the frontend-tooling choice to this architecture pass. The page is a form → uploading → result state machine (3-4 states) that PRD §2 Goal 3 explicitly wants built so quote/order-confirmation states can extend it later without a rewrite, even though those states aren't built now.

## Decision drivers

- PRD §2 Goal 3 — state machine must extend to quote/order-confirmation screens later without a rewrite.
- CLAUDE.md — "prefer boring technology," "no unnecessary dependencies," "avoid premature optimization / speculative flexibility."
- Repo has zero existing frontend precedent — no convention to follow or break.
- Quality goal §1 QG-1 — fast, honest feedback; tooling choice should not add meaningful load time.

## Considered options

1. **Vanilla TypeScript, no bundler** — dedicated browser tsconfig compiles `src/ui/**/*.ts` to `dist-ui/**/*.js`, loaded via native `<script type="module">`. Zero new dependencies.
2. **Vanilla TypeScript + Vite/esbuild as bundler** — adds one dev-time bundler dependency for HMR and asset bundling, no UI framework.
3. **Preact** — a 3KB React-API-compatible library; adds one runtime dependency plus JSX tooling.
4. **htmx / Alpine.js** — declarative HTML attributes, no build step, but weak TypeScript-boundary type safety.
5. **Lit (Web Components)** — standards-based, no virtual DOM, but more templating machinery than a 3-4 state form needs.
6. **React + Vite** — full framework, most future-proof for a multi-screen app, heaviest dependency footprint.

## Decision outcome

**Chosen:** Preact. It gives component/state ergonomics that make the PRD-mandated extension path (quote/order-confirmation screens as new components later) straightforward, at a 3KB runtime cost — a materially smaller commitment than full React while still following a well-known, documented API. It's a deliberate middle ground between "zero dependencies" (vanilla TS) and "heaviest framework" (React): the repo's "boring technology" bias is honored by picking the smallest library that still satisfies the explicit multi-screen extension requirement, rather than defaulting to no framework and re-deriving component/state patterns by hand later.

## Consequences

**Positive**
- Component/state model directly supports adding quote/order-confirmation as new components later without restructuring the form/uploading/result state machine.
- Small runtime footprint (~3KB) keeps time-to-first-visible-feedback (NFR ≤2000ms) largely unaffected.
- React-familiar API lowers onboarding cost for any future contributor who knows React.

**Negative**
- Introduces the repo's first runtime frontend dependency and JSX build tooling (needs a bundler/transform step — see building-block decisions in §5).
- Slightly more machinery than the current 3-4-state page strictly requires today.

**Neutral**
- Migrating to full React later (if the app grows well beyond quote/order-confirmation) is possible without a full rewrite, since Preact's API is React-compatible.

## Links

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §4
- Related ADR: [[0002-serve-upload-ui-static-assets-from-fastify]]
