---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0001 — Use an existing npm library for STL geometry validation

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** Yakiv Vakoliuk (Architect) during the sad.md §4 Socratic walk

## Context

PRD §2 requires that only valid, watertight models reach quote-engine, and PRD §6 sets an accuracy bar of ≥99% agreement with the real slicer. stl-upload must synchronously (≤10000ms p95) parse an uploaded STL and check it for watertightness (no holes/self-intersections) before storing it. The parsing/validation logic is the core of the feature and its output ("valid model") is a contract other modules (quote-engine) will trust without re-checking (AC-05).

## Decision drivers

- §1 QG-1 (top priority): validator accuracy ≥99% agreement with real slicer (PRD §6).
- §2 Organisational: 2-week solo-maintainer deadline — no time to write and verify custom mesh-geometry math.
- PRD §3 Non-goals: keeps stl-upload's parsing scope independent from quote-engine's separate PrusaSlicer CLI orchestration (quote-engine/stl-parse-feature-plan.md).

## Considered options

1. **Custom TS library** — hand-written STL parser + edge-pairing watertightness check.
2. **Shared PrusaSlicer CLI (check-only mode)** — reuse the same slicer binary quote-engine will use, invoked in a validation-only mode.
3. **Existing npm library** — an existing open-source mesh-validation package, used as-is.

## Decision outcome

**Chosen:** Option 3, existing npm library. Avoids writing and independently verifying custom geometry math under a 2-week solo deadline, and avoids coupling stl-upload's parsing pipeline to quote-engine's separate PrusaSlicer CLI infrastructure and orchestration plan.

## Consequences

**Positive**
- Less custom code for complex geometry math (self-intersection, manifold checks).
- stl-upload stays independently deployable/testable from quote-engine — no shared binary dependency.

**Negative**
- Accuracy depends on third-party code quality — must be verified against PrusaSlicer's real behavior (PRD §6 Accuracy target) before trusting it in production; QA sample plan required before stage 15 (test-plan).
- Risk of unmaintained/abandoned package — needs a maintenance-health check before final library selection.

**Neutral**
- The exact library is a stage-08/implementation-time choice, not fixed by this ADR — this ADR fixes the *strategy* (existing library, not custom code, not shared slicer CLI).

## Links

- PRD: [[../PRD.md]] §2 Goals, §6 NFR
- SAD: [[../sad.md]] §4
- Related ADR: [[0002-child-process-sandbox]] (this library's native code runs inside that sandbox)
