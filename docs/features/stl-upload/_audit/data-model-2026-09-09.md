# Data model audit — stl-upload — 2026-09-09

## Generated files

- `docs/features/stl-upload/data-model.md` — documents a **no-relational-DB** outcome (not a normal entity/index doc).

No migration files generated (no entities to migrate).
No `.claude/rules/migrations.md` bootstrapped (no DB in this feature; premature to write migration conventions with nothing to migrate).

## Decision: no relational database

Confirmed with the user (2026-09-09): the MVP flow (docs/overview.md) is single-session and ephemeral — user stays on one page through upload → validate → slice/quote → confirm/decline; closing the page interrupts the flow and the file is removed. There is no cross-session state requiring a system-of-record. ADR-0003 (local filesystem storage) already covers the only persistence this feature needs — a transient file on disk keyed by UUID v4 (ADR-0005).

## PRD/SAD discrepancy surfaced

PRD §8 (Open questions) cites "file-metadata storage (§6.1)" as part of the M-size classification rationale. This predates ADR-0003's filesystem-only decision and does not correspond to an actual metadata table requirement. Not corrected in PRD/SAD by this skill (out of scope) — flagged in `data-model.md` and here so it isn't silently carried forward into task breakdown or API design.

## New requirement surfaced (not yet documented upstream)

User stated a cleanup-on-disconnect requirement: if the browser closes mid-flow, the in-progress file must be removed. Not currently in PRD or SAD. This is a runtime/API lifecycle concern (detecting connection close, removing temp files), not a persistence-schema concern, so it's out of scope for this skill's output — recommend it be added to SAD §8 (Crosscutting concepts) or scoped as a small ADR when the upload API's connection-handling is designed.

## Drift findings

N/A — no Go domain structs exist yet (no code in repo).

## Breaking changes decomposed

N/A.

## TBDs

None in `data-model.md` — the "no DB" outcome is a definitive answer, not a placeholder.

## Self-check against DoD

- `data-model.md` exists — documents the no-DB decision with rationale, in place of an ER/entities/indexes doc (none apply).
- No entity requires a migration pair — none generated, none owed.
- 4 mandatory migration self-checks — not applicable, no migration files were produced.
- Audit report — this file.

## Next stage

`define-api stl-upload` (stage 10, API contracts) — proceeds without a DB dependency; the upload API's response shape is driven by the sequence diagrams (SAD §6) and PRD ACs, not by a schema.
