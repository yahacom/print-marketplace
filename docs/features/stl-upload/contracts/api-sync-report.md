---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: M
stage: "10"
ticket: "<TBD>"
---

# API sync report — stl-upload

<!-- Stage 10 -> see sdlc/plugin/skills/api-forge/SKILL.md -->

> **Post-hoc note (2026-09-10):** ADR-0006 descoped mesh/geometry validation (watertightness) out of stl-upload into quote-engine. This report reflects the contract as originally generated (stage 10, 2026-09-09), including the now-removed `422 upload.not_watertight` response and AC-03 traceability. `openapi.yaml` itself has been updated to drop the 422 response; this report is left as a historical record rather than fully rewritten, since re-running api-forge from scratch is out of scope for this revision. Treat any reference below to watertightness/AC-03/422 as superseded by `openapi.yaml`'s current state.

## Scenario

**Scenario A** — `data-model.md` exists (stage 08, status Draft). It records **zero relational entities**: persistence is a single filesystem write (`<file-id>.stl`), keyed by UUID v4 (ADR-0005), not a queryable schema (data-model.md "Outcome" section).

This is scenario A by presence-of-file, but it is an edge case the skill's A/B split doesn't cleanly anticipate: there are no DDL types/constraints to trace fields to, so field origins below come from PRD acceptance criteria + `sad.md` S6 sequences + the two ADRs that fix the id/storage contract (ADR-0003, ADR-0005), not from a schema. Confidence is marked accordingly (see Section A) — this is closer to scenario B's sourcing in practice, run under scenario A's label because the artifact exists and is authoritative about there being nothing to type against.

## Inputs read

| Input | Found? | Used for |
|---|---|---|
| `PRD.md` | Yes | Endpoints, error branches (AC-02/AC-03), NFRs (file size, latency, rate limit) |
| `data-model.md` | Yes (empty entity set) | Confirms no stored-metadata fields exist to expose in the response schema |
| `sad.md` S6 (sequences) | Yes — 4 sequences, all inline under S6 | Happy path (201), invalid-format (400), not-watertight (422); flow 4 (quote-engine <-> filesystem) confirmed **no HTTP endpoint** is in scope for that read |
| `idea-brief.md` | Yes | `info.description` context |
| `adr/0002-child-process-sandbox.md` | Yes | No API-surface impact (internal sandboxing, not exposed) |
| `adr/0003-local-filesystem-storage.md` | Yes | Confirms quote-engine reads FS directly, not via this API |
| `adr/0005-uuid-v4-file-id.md` | Yes | `file_id` type = `uuid`, sole access-control mechanism |
| `CONTEXT.md` glossary (via sad.md S12) | Yes | Schema naming (`file_id`, `model` vocabulary) |

No optional input was skipped.

## Endpoints generated

| Method + path | Source |
|---|---|
| `POST /api/v1/uploads` | US-01/AC-01 (happy path), US-02/AC-02 (400), US-03/AC-03 (422), PRD S6 (413, 429) |

Only one endpoint exists. This is a direct consequence of the architecture, not an oversight: C4 Container (`sad.md` S5) shows quote-engine reading the stored model **directly from the shared filesystem** (`Rel(quote_engine, fs, "Reads valid model by file-id")`), with no `Rel(quote_engine, api, ...)`. AC-05 ("quote engine requests that model") is satisfied by that filesystem contract (ADR-0003 + ADR-0005), not by an HTTP operation — so no `GET /uploads/{file_id}` was generated for it. Flagged explicitly rather than invented, per the skill's "never invent fields/endpoints" invariant.

## Deviations from skill defaults

| Default | Applied here? | Reason |
|---|---|---|
| `BearerAuth` global security | No — `security: []` on the one operation | PRD S3 non-goal: "full accounts/auth" explicitly out of scope for MVP; AC-04 makes the unguessable `file_id` itself the only access control. |
| Mandatory `Idempotency-Key` on mutating/retriable POST | No | PRD S6.1 abuse case #3, verbatim: "each upload (including duplicates of the same file) gets a new file-id with no dedupe" — idempotency is explicitly rejected by design, not merely undocumented. Documented in the operation description instead of a header. |
| Cursor pagination for list endpoints | N/A | No list endpoint exists — no AC describes listing uploads. |

Both deviations trace to explicit PRD statements, not a missing artifact — recorded here so the "why no auth / no idempotency key" question doesn't get re-litigated later.

## Section A — field origins

| operation | schema_field | origin | confidence |
|---|---|---|---|
| `POST /uploads` request | `file` (multipart) | PRD AC-01/AC-02 ("upload a file" / STL) + sad.md S6 flow 1 `User->>API: Uploads STL file` | high |
| `POST /uploads` 201 | `file_id` | ADR-0005 (UUID v4, sole access-control id) | high |
| `POST /uploads` 201 | `status: valid` | PRD AC-01 ("confirms ... it's ready for a quote") — only the success state is modeled; failures use HTTP status + `Error.code`, not a status enum value | medium |
| `Error.code` values | `upload.invalid_format` | PRD AC-02 + sad.md S6 flow 2 (`Parse error — not a valid STL`) | high |
| `Error.code` values | `upload.not_watertight` | PRD AC-03 + sad.md S6 flow 3 (`watertight check FAILED`) | high |
| `Error.code` values | `upload.file_too_large` | PRD S6 NFR table ("Max file size <= 50 MB") — no sequence branch shows this explicitly; inferred from the stated limit | medium |
| `Error.code` values | `upload.rate_limited` | PRD S6.1 abuse case #4 ("rate limit of 30 uploads/minute per IP") — no sequence branch; inferred from the NFR/abuse-case table | medium |

No field in the contract lacks a traceable origin; none were invented.

## Section B — drift findings (5-point check)

1. **Endpoint <-> data-model** — N/A in the usual sense (data-model.md has zero entities by design, not by omission). Substituted check: every endpoint maps to the filesystem operation described in `data-model.md` ("single filesystem write ... keyed by UUID v4"). `POST /uploads` -> that write. **✓** (with the caveat above that "data-model" here is a storage note, not a schema).
2. **Error codes <-> domain sentinels** — no `domain/errors.go`-equivalent exists yet (no code in the repo — CLAUDE.md confirms pre-code state). **✗ (deferred, not failed)**: cannot verify against source until implementation lands. Re-run this check when the service module exists.
3. **Validation <-> DB constraints** — no DB constraints exist (filesystem-only). Substituted check: the one real constraint sourced is PRD's 50 MB max file size, which is documented in the request body description (OpenAPI has no native multipart-size keyword to enforce this declaratively — noted as a limitation below). **✓ (as far as OpenAPI 3.1 can express it)**.
4. **Entity <-> endpoint** — N/A, zero entities (data-model.md explicit outcome). **✓ (vacuously)**.
5. **OpenAPI <-> sequence** — `sad.md` S6 has 4 sequences: flow 1 (201 happy path) ✓ matches; flow 2 (400 invalid format) ✓ matches; flow 3 (422 not watertight) ✓ matches; flow 4 (quote-engine <-> filesystem, no HTTP) correctly produced **no** endpoint, matching the C4 Container diagram (no `Rel(quote_engine, api, ...)`). **✓**.

**Core checks (1-3):** 1 ✓, 2 deferred (no code exists yet to check sentinels against — not a contract defect), 3 ✓. No blocker.

**Supporting checks (4-5):** both ✓.

## Section C — unresolved_origins

None classified as scenario-B-style "inferred, needs confirmation when data-model.md arrives" — `data-model.md` already exists and its answer (zero entities) is final, not pending. The two `medium`-confidence rows in Section A (`upload.file_too_large`, `upload.rate_limited`, and the `status` field) are inferred from PRD prose/NFR tables rather than a sequence `alt`-branch or a typed field; they will not be "tightened" by any future artifact since there is no data-model to reconcile against — they should instead be confirmed against the implementation once the sandbox/rate-limiter code exists (check 2 above).

## Outstanding items

- **Lint not run.** `spectral` is not installed and `npx @stoplight/spectral-cli` failed locally (`npm error ... cache folder contains root-owned files` — pre-existing environment issue, `sudo chown -R $(id -u):$(id -g) ~/.npm` fixes it). Manually reviewed the YAML for structural correctness (valid `$ref` targets, required properties present, no `nullable: true` 3.0-style usage). Recommend running spectral once the npm cache ownership issue is fixed, before this contract is treated as final.
- **Mock server not started** — no code/dependencies exist yet in this repo to host Prism from; `prism mock docs/features/stl-upload/contracts/openapi.yaml -p 4010` is the command to run once Prism is available.
- **`events.md` not generated** — this feature is explicitly synchronous, no queue, no async processing (idea-brief S13, SAD S4 "Inherited from idea-brief S13 ... no auto-repair; no queue/async processing"). No async events exist to document.

## Definition of Done

- [x] Contract at `docs/features/stl-upload/contracts/openapi.yaml`.
- [x] `api-sync-report.md` committed alongside — scenario recorded (A, with the empty-entity-set caveat noted above).
- [x] Core checks (1, 3) ✓; check 2 explicitly deferred with reason (no implementation exists yet), not silently skipped.
- [x] `unresolved_origins` — none in the scenario-B sense; two `medium`-confidence rows called out with their actual reconciliation path (implementation, not a future data-model).
- [ ] Spectral lint pass — **not yet run**, environment blocker documented above.
- [ ] Mock server up — **not yet run**, no dependencies installed in this pre-code repo.
- [x] Examples on the one operation (request shape description + 201/400/413/422/429 examples).
- [x] Error model `{code, message, details?}`, snake_case, domain-namespaced (`upload.*`).
