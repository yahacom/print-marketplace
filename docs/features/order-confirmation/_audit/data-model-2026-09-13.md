# Data-model audit — order-confirmation — 2026-09-13

## Mode

**Adapted, not literal.** `sdlc:generate-data-model`'s default output is a relational schema: `data-model.md` + paired `<timestamp>_create_<entity>.up.sql`/`.down.sql` migrations for `golang-migrate`, plus a `.claude/rules/migrations.md` bootstrap.

That default was not run. **SAD §3/§4/§9, ADR-0001 (status: Accepted)** already locked persistence to **Firestore**, a managed NoSQL document store — decided independently of this skill, before this run. Generating Postgres-flavored migrations against that decision would have produced files nothing would ever execute and that misrepresent the actual architecture. This was surfaced to the user before generation (see conversation) with three options: adapt to a Firestore-shaped doc, revisit ADR-0001, or force relational output anyway. User chose **adapt**.

## Generated files

- `docs/features/order-confirmation/data-model.md` — Firestore collection design (1 collection: `orders`), replacing the SQL ER+entities+indexes sections with their Firestore equivalents.

**Not generated (and why):**
- `migrations/*.up.sql` / `*.down.sql` — no relational schema exists; Firestore is schemaless and has no migration-file concept in this project.
- `.claude/rules/migrations.md` — not bootstrapped. It's a SQL-migration convention file; nothing in this feature or repo currently does SQL migrations. Bootstrapping it here would assert a repo-wide convention the user hasn't chosen. Skipped rather than defaulted.
- `internal/testfixtures/*.go` (or equivalent) — no `src/` tree exists yet (CLAUDE.md: repo has no application code). A TS-shaped fixture example is inlined in `data-model.md` instead, for the first implementation PR to follow.

## Default deviations applied

| Skill default | What happened here | Why |
|---|---|---|
| Migration filename timestamp convention, `IF NOT EXISTS`, `.up`/`.down` pairs | N/A — no migration files | No relational store (see Mode above). |
| PK: UUID v7, generated app-side | Doc id is **UUID v4** | SAD §9 ADR-0003 (Accepted) mandates threading stl-upload's existing UUID v4 file-id through unchanged as the shared quoteId/order-id. That ADR predates and outranks this skill's PK default — an Accepted architectural decision is not something a data-model pass overrides. |
| No `updated_at`; audit-only `created_at` | Field is named `decided_at`, not `created_at`, but the same immutability principle holds — no `updated_at`, documents never edited post-creation (ADR-0004 accepted debt) | Naming follows the domain term (SAD §12 glossary: "decision," not a generic create timestamp) rather than the skill's literal column name, since there is no SQL column at all — Firestore field names are free-form. |
| One index per query, justified | Zero indexes | Both access patterns (`create`/`get` by known document id) are covered by Firestore's automatic id-based lookup; no query in SAD §6's 6 flows scans or filters the collection. Documented explicitly in `data-model.md` rather than silently omitted, to make clear this was checked, not skipped. |
| Forbidden: CHECK constraints, DB triggers | N/A at the store level (Firestore has neither) | `decision`'s enum validity is enforced in app code — same principle as the SQL default ("DB stays dumb"), just enforced by a different mechanism since there's no DDL layer to forbid things in. |

## Drift findings

None. No Go (or TS) domain structs exist yet in the repo (`internal/**/domain/*.go` search and general `.go`/`src/**` search both came back empty) — drift detection has nothing to compare against. Will apply once the module's domain types exist.

## Breaking changes decomposed

None. Greenfield collection, first pass.

## TBDs

See `data-model.md` "TBDs" section — carried here for visibility:
- `docs/features/order-confirmation/data-model.md:TBD` — `model_file_ref`'s exact wire format (depends on stl-upload's storage design; tracked as PRD §8 open question, owner Yakiv Vakoliuk).
- `docs/features/order-confirmation/data-model.md:TBD` — whether a quote snapshot ever needs persisting (no AC currently requires it; deferred until a concrete need appears).
- `docs/features/order-confirmation/data-model.md:TBD` — quote-engine's final output contract (PRD §8 open question) — doesn't change this collection's shape but blocks the `define-api` pass.

## Next stage

`define-api order-confirmation` (stage 10) — note for that pass: the confirm/decline endpoints write to Firestore directly (no ORM/query layer to contract against), so the API contract's response shapes should be derived from `data-model.md`'s `orders` document fields, not from a generated schema layer.
