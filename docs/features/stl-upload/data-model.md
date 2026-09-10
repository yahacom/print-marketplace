---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "08"
ticket: "<TBD>"
---

# Data model — stl-upload

<!-- Stage 08 → see sdlc/plugin/skills/generate-data-model/SKILL.md -->

## Outcome: no relational database for this feature

This feature has **zero relational entities**. Persistence is a single filesystem write (`<file-id>.stl` under a fixed directory, ADR-0003), keyed by an unguessable UUID v4 (ADR-0005). No `data-model.md` migrations are generated.

### Rationale

- **Flow is single-session and ephemeral** (docs/overview.md MVP user flow): the user stays on one web page through upload → validate → slice/quote → confirm/decline. If the user closes the page, the flow interrupts and the uploaded file is removed — there is no cross-session state to persist, so there is no system-of-record need for a database table.
- **ADR-0003** (local filesystem storage) already scopes persistence to "durable enough for quote-engine to read the file by file-id" — not a queryable, structured record. It documents a storage *location* decision, not a metadata schema.
- **No AC requires stored metadata.** AC-01 through AC-05 (PRD §5) are satisfied by: file exists on disk (validity), or doesn't (rejected); UUID v4 filename (sole access control, AC-04); quote-engine reads the file by id (AC-05). None require a `created_at`, `status`, or owner column to be queried back.
- **PRD §8 correction:** the PRD's size-classification rationale cited "file-metadata storage (§6.1)" as one of the M-classification triggers. That language predates the SAD/ADR-0003 decision to use filesystem-only storage and does not reflect a real metadata-table requirement — confirmed with the user (2026-09-09). No SAD/PRD edit is in scope for this skill; flagging here so the discrepancy isn't silently carried forward.

### Not addressed by this pass (flagged, not solved)

- **Cleanup-on-disconnect.** The user described a requirement (2026-09-09, not yet in PRD/SAD): if the browser tab/connection closes at any phase of the flow, the in-progress file must be removed. This is a *runtime lifecycle* concern (request/connection-scoped cleanup, e.g. an `on close` handler removing the temp file), not a persistence/schema concern — out of scope for `generate-data-model`. Recommend capturing it explicitly in SAD §8 (Crosscutting concepts) or a small ADR when the upload API is designed, since it affects the API/streaming design (how "page closed" is detected server-side) more than storage.
- **Multi-page flow beyond stl-upload** (quote/confirm steps in docs/overview.md) belongs to the quote-engine feature, not yet scoped in this repo — any state that flow needs (if it turns out to be more than "call quote-engine synchronously with the file-id") is a separate feature's data-model decision, not this one's.

## Entities

None.

## Indexes

None — no tables exist to index.

## Migrations

None generated. `migrations/` directory and `.claude/rules/migrations.md` were **not** bootstrapped — there is nothing to migrate for this feature, and creating a rules file for a repo with no DB yet would be premature.

## Test fixtures

None — no DB rows to fixture. If test setup needs a valid on-disk STL file for integration tests, that belongs to the module's own test helpers (e.g. `internal/modules/stl-upload/testdata/`), not a DB factory.
