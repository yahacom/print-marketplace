---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0004 — Use simple layered architecture (routes/services/repositories) for the first module

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** Yakiv Vakoliuk (Architect) during the sad.md §5 Socratic walk

## Context

stl-upload is the first feature built in this greenfield repository — `CLAUDE.md` has no established code convention yet, so this module's internal layering sets the pattern future features (starting with quote-engine) are likely to follow. The module has a real boundary to keep clean: untrusted input (sandboxed child-process parsing, ADR-0002) versus business logic (validation orchestration, file storage).

## Decision drivers

- §2 Organisational: 2-week solo-maintainer deadline.
- Need for a clear seam between untrusted parsing (ADR-0002) and business logic, without over-engineering for a single-developer team.

## Considered options

1. **Hexagonal (ports & adapters)** — `domain/`, `app/`, `infra/`, `ports/` folders.
2. **Simple layered** — `routes/`, `services/`, `repositories/` folders.

## Decision outcome

**Chosen:** Option 2, simple layered. Fewer files and interfaces to write and maintain solo within the 2-week deadline (§2), while still giving `services/` a clear seam from `routes/` (HTTP concerns) and `repositories/` (storage concerns) — good enough separation for the current module count (one).

## Consequences

**Positive**
- Faster to build and read for a solo maintainer — less boilerplate than ports-and-adapters.
- Still separates HTTP concerns (`routes/`), orchestration (`services/`), and storage (`repositories/`) into distinct files.

**Negative**
- `services/` risks growing into a "god object" without a hard interface boundary between the sandboxed child-process call and business validation rules — must be watched as the module grows.
- If quote-engine or later features copy this pattern and outgrow it, migrating to hexagonal later touches every module that copied it — this ADR is a precedent-setting decision, not just a local one.

**Neutral**
- This pattern is not mandated project-wide by this ADR alone; a future feature can choose differently, but is likely to default to this pattern absent a stated reason not to.

## Links

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §5
- Related ADR: [[0002-child-process-sandbox]] (the boundary `services/` must respect)
