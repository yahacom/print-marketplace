---
status: Approve
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-10"
feature_size: S
stage: "03"
ticket: "<TBD>"
---

# PRD — stl-upload

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](./CONTEXT.md)
> **Reference module:** N/A — green-field mode.
> **External context channels used:** None — only CONTEXT + idea-brief (user selected "Skip — green-field" at step 3).

## 1. Context

Users today upload STL files that the downstream slicing step cannot use — wrong formats, corrupted or empty files — and nothing catches this early with a clear explanation, so failures surface confusingly deep in the flow. This affects newcomers with no 3D-modeling background who want an object printed but have never opened CAD or mesh-repair software (idea-brief §2, §3). Geometry problems (non-manifold/non-watertight meshes — holes, self-intersections) are not caught here; they surface later when quote-engine loads the model into the slicer (ADR-0006).

stl-upload is the entry point of the entire MVP flow (upload → quote → confirm/decline) for this web-first 3D print marketplace and is a blocking dependency: quote-engine and order-confirmation have nothing to process without it (idea-brief §4).

The accepted vector is Approach A — Local Validate-Then-Store Pipeline (idea-brief §13): synchronous, single-pass format/size validation with a plain-language pass/fail (geometry validation moved to quote-engine, ADR-0006) — no auto-repair, no queue, no async processing. This is deliberately narrower than Shapeways/Craftcloud/i.materialise's guided-fix flows (idea-brief §6) but matches the two-week solo-delivery constraint. The file-id handoff to quote-engine is a settled input (idea-brief §13 locked-in pointer), not an open design question.

N/A — green-field mode (no reference module, MCP-Atlassian, project docs, or RAG channel was used; user selected "Skip — green-field" at step 3).

## 2. Goals

- User gets an immediate, synchronous yes/no on their STL upload — no pending/async state to interpret.
- Only structurally-declared STL files within the size limit are stored; geometry validity is quote-engine's responsibility, not asserted here (ADR-0006).
- User understands in plain language why an upload was rejected, without needing to know mesh-repair terminology.

## 3. Non-goals

- Auto-repair or guided step-by-step fixing of broken meshes — parked as Approach B/C, reserved for after quote-engine + order-confirmation ship and real abandonment data exists (idea-brief §14).
- Mesh geometry/watertightness validation — moved to quote-engine (ADR-0006), which already loads the mesh into the slicer.
- Support for non-STL formats (OBJ/3MF/STEP) — an explicit, disclosed competitive gap versus Shapeways/Craftcloud, accepted permanently (not just for v1) per PRD Socratic review (idea-brief §6, §15).
- Payments, checkout, multi-vendor routing, order fulfillment, vendor-facing tooling, and full accounts/auth — MVP-wide exclusions (idea-brief §5).

## 4. User stories

### US-01: Upload a valid STL and get confirmation
**As a** user
**I want** to upload an STL file of my model
**So that** I get confirmation it's stored and ready for a quote

### US-02: Get a clear reason when a file isn't a usable STL
**As a** user
**I want** a plain-language explanation when my file isn't a valid STL (wrong format/extension, or too large)
**So that** I know it failed without needing to understand file formats

### US-03: ~~Get a clear reason when geometry isn't watertight~~ — moved to quote-engine (ADR-0006)

Struck rather than deleted, to preserve the decision history: this story (and its acceptance criterion, formerly AC-03) is no longer stl-upload's responsibility. Mesh geometry/watertightness validation moved to quote-engine, since it already loads the mesh into the slicer (see ADR-0006). Whoever scopes quote-engine's PRD should pick up an equivalent user story there.

### US-04: Trust my upload is private to me
**As a** user
**I want** my uploaded model to be invisible to other users
**So that** I trust the platform even without a full account system

### US-05: My valid upload is ready for the quote engine automatically
**As a** user
**I want** my successfully uploaded model to be immediately usable by the quote step
**So that** I don't have to do anything extra to get a price

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a user has a well-formed STL file (correct declared format, within the size limit)
**When** they upload it
**Then** the system stores it as a valid model and confirms to the user that it's ready for a quote

### AC-02 (US-02) — error

**Given** a user uploads a file
**When** the file is not declared as an STL (wrong content-type/extension) or is empty
**Then** the system rejects the upload and tells the user their file could not be accepted as an STL

### AC-03 (US-03) — ~~domain invariant~~ — moved to quote-engine (ADR-0006)

Struck along with US-03: watertightness is no longer checked or enforced by stl-upload.

### AC-04 (US-04) — authorization

**Given** a valid model has a system-generated, unguessable identifier
**When** someone attempts to access the model without knowing that identifier
**Then** the system does not grant them access — the identifier itself is the only access control in v1, since full user authorization is explicitly out of scope for the MVP (idea-brief §5); anyone who does possess the correct identifier (e.g. a different browser session) is granted access — no additional session-scoped isolation is required in v1

### AC-05 (US-05) — cross-context

**Given** a user has a valid model from a completed upload
**When** the quote engine requests that model
**Then** the system provides it in a form the quote engine can use to produce a quote without needing to re-validate it

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Latency p95 — upload validation (single STL, up to max file size) | ≤ 10000 ms | upload-validate request duration metric |
| Throughput | ≥ 5 req/s per instance | k6 smoke in CI |
| Availability | 99.0% | monthly SLO window (solo-maintainer, no on-call — idea-brief §10) |
| Max file size | ≤ 50 MB | enforced at upload boundary |

## 6.1 Security / privacy

- **Data classification:** internal — uploaded STL files are user-supplied content; not secret, but access should be scoped to the uploader via the file's identifier.
- **Personal data touched:** none new — only the file itself; no user accounts/PII fields are collected in this feature (idea-brief §5, accounts/auth out of scope).
- **AuthZ/AuthN impact:** no accounts/auth in MVP; access control is limited to the model's unguessable system-generated identifier (AC-04) — no listing endpoint, no cross-object enumeration surface.
- **Abuse cases:**
  1. ~~Malicious/crafted STL exploiting a parser vulnerability~~ — no longer applicable: stl-upload does not parse file content anymore (ADR-0006), only a content-type/extension + byte-length check, so there is no untrusted-parsing boundary left in this module to exploit. (This risk moves with the parsing responsibility to quote-engine — that feature's own security review must re-assess it.)
  2. **Resource exhaustion via oversized upload** — mitigated by the 50 MB max file-size limit (§6), enforced on byte length before the file is stored; no allocation-before-validation risk remains since no geometry parsing happens.
  3. **Disk exhaustion via unlimited/duplicate uploads with no quota** — each upload (including duplicates of the same file) gets a new file-id with no dedupe; residual risk is bounded by the existing file-size cap (§6) and rate limit (below), not by additional dedupe logic.
  4. **Spam upload** — rate limit of 30 uploads/minute per IP.
  5. **Identifier-enumeration attack** — mitigated by using unguessable system-generated identifiers (AC-04), making guessing/enumeration infeasible.
- **Security review:** Downgraded in scope, not skipped — with the untrusted-parsing boundary gone (ADR-0006), the remaining surface is "arbitrary uploaded bytes stored on disk under a random filename, rate-limited." This is a materially lighter review than the original "new untrusted-binary-parsing boundary" framing (idea-brief §10). Recorded here as a recommendation, not a decision: the Security Lead (§1 stakeholders table) should confirm whether a full review is still warranted or a lighter checklist suffices, before this line is changed.

## 7. Metrics / KPIs

- **Upload success rate for non-garbage files** — baseline: TBD (pre-launch, Reach unresolved per idea-brief §11), target: ≥90% of non-garbage uploads validated correctly within 30 days of launch (idea-brief §7 Approach A outcome metric).
- **Time-to-first-quote pipeline unblock** — baseline: 0% of uploads reach quote-engine (feature doesn't exist yet), target: 100% of valid uploads automatically reach quote-engine with no manual intervention, immediately after launch (idea-brief §11 Impact — stl-upload as blocking dependency for the whole MVP flow).

## 8. Open questions

- [x] Confirm `feature_size` (Effort=S per idea-brief §7) still holds after Socratic edits (wider latency buffer, 50 MB file-size limit, UUIDv4-style identifier, sandboxed parsing) via `sdlc:classify-size` — owner: Yakiv Vakoliuk, due: before architecture-design — **Resolved: M**. PR count (2-5) and timeline (1 week) alone would suggest S, but the feature touches two of {new module, new API, DB migration} — a new untrusted-binary-parsing module, a new upload API surface, and file-metadata storage (§6.1) — which is S-disqualifying per the skill's mapping table; per the skill's edge-case guidance this risk signal outweighs the compact PR/timeline estimate. (Note: an earlier draft of this rationale also cited "public-facing breaking changes" — dropped on critic review, since stl-upload is a green-field first feature with no existing public surface to break; idea-brief §4.) User confirmed M.
- [ ] Feasibility (idea-brief §12) remains unconfirmed (greenfield, no track record) — revisit after the first real shipped feature. — owner: Yakiv Vakoliuk, due: after stl-upload ships
- [x] Re-run `sdlc:classify-size` for `feature_size` (was M) — the prior M-classification driver "a new untrusted-binary-parsing module" no longer applies after ADR-0006 (mesh validation + sandboxing moved to quote-engine); the remaining driver (new upload API surface, one of three per the skill's mapping table) is not S-disqualifying on its own. Re-run 2026-09-10: PR count 2-5, timeline 1 week, one of {new module/API/migration}, internal-only breaking changes — maps to **S**. Frontmatter and `.size` updated to S — owner: Yakiv Vakoliuk, due: before next architecture-affecting change — **Resolved: S**.
