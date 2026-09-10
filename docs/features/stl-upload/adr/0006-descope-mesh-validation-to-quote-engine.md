---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0006 — Descope mesh/geometry validation from stl-upload to quote-engine

- **Status:** Accepted
- **Date:** 2026-09-10
- **Deciders:** Yakiv Vakoliuk (Architect)

## Context

stl-upload was originally scoped (ADR-0001, ADR-0002) to synchronously validate STL geometry (watertightness) using an npm mesh-validation library, running that library inside a sandboxed child process because it parses untrusted, attacker-controllable bytes. On revisiting the MVP/PoC scope, this duplicates work: quote-engine (see `docs/features/quote-engine/stl-parse-feature-plan.md`) already loads the same mesh into PrusaSlicer CLI to slice it, and PrusaSlicer's own load step will reject or fail on non-watertight geometry. Running two independent geometry-parsing implementations (an npm library in stl-upload, PrusaSlicer CLI in quote-engine) means they can disagree — a risk ADR-0001's own Negative consequences already called out ("accuracy depends on third-party code quality... must be verified against PrusaSlicer's real behavior").

## Decision drivers

- MVP/PoC simplicity — avoid building and maintaining a second geometry-validation pipeline separate from the slicer that will ultimately judge the mesh anyway.
- Avoids the accuracy-drift risk between the npm library's verdict and PrusaSlicer's real behavior (ADR-0001 Negative).
- Removing untrusted-content parsing from stl-upload also removes the need for the sandboxing infrastructure in ADR-0002 — the two decisions are coupled.

## Considered options

1. **Keep watertightness checking in stl-upload (status quo)** — reject on ADR-0001/ADR-0002 as before.
2. **Move watertightness/geometry validation to quote-engine** — stl-upload only checks declared format (content-type/extension) and size; quote-engine is the sole place that judges mesh geometry, via the slicer it already invokes.
3. **Drop watertightness checking entirely, anywhere** — rejected; quote-engine still needs some way to reject unprintable geometry, it just isn't stl-upload's job.

## Decision outcome

**Chosen:** Option 2. stl-upload becomes a thin format/size gate; quote-engine owns all mesh geometry validation as part of its slicing pipeline.

## Consequences

**Positive**
- stl-upload is simpler: no mesh-validation library, no sandboxed child process, fewer failure modes and a smaller MVP/PoC surface.
- Eliminates the two-implementation accuracy-drift risk flagged in ADR-0001.

**Negative**
- UX regression: the user no longer gets an immediate watertightness verdict at upload time — they only find out their mesh has holes/self-intersections when quote-engine processes it (later in the flow, possibly after a slicer run has started). This is a real tradeoff, not hidden.
- stl-upload's PRD US-03/AC-03 (watertightness rejection) is no longer this module's responsibility. Whoever writes quote-engine's PRD/SAD must pick this requirement up explicitly — if it's dropped, unprintable geometry silently reaches the slicer with no user-facing explanation.

**Neutral**
- ADR-0003 (local filesystem storage/handoff) and ADR-0005 (UUID v4 file-id) are unaffected — quote-engine still reads `<file-id>.stl` off the shared filesystem by file-id.

## Links

- Supersedes: [[0001-npm-mesh-validation-library]], [[0002-child-process-sandbox]]
- PRD: [[../PRD.md]] §2 Goals, §3 Non-goals
- SAD: [[../sad.md]] §4
- quote-engine: `docs/features/quote-engine/stl-parse-feature-plan.md` (mesh will be loaded into PrusaSlicer CLI here — watertightness rejection should be picked up in that feature's own PRD/SAD)
