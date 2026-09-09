---
status: Approve
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-08"
feature_size: M
stage: "03"
ticket: "<TBD>"
---

# PRD — stl-upload

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](./CONTEXT.md)
> **Reference module:** N/A — green-field mode.
> **External context channels used:** None — only CONTEXT + idea-brief (user selected "Skip — green-field" at step 3).

## 1. Context

Users today upload STL files that the downstream slicing step cannot use — wrong formats, corrupted files, or geometry that is non-manifold/non-watertight (holes, self-intersections) — and nothing catches this early with a clear explanation, so failures surface confusingly deep in the flow. This affects newcomers with no 3D-modeling background who want an object printed but have never opened CAD or mesh-repair software (idea-brief §2, §3).

stl-upload is the entry point of the entire MVP flow (upload → quote → confirm/decline) for this web-first 3D print marketplace and is a blocking dependency: quote-engine and order-confirmation have nothing to process without it (idea-brief §4).

The accepted vector is Approach A — Local Validate-Then-Store Pipeline (idea-brief §13): synchronous, single-pass geometry validation with a plain-language pass/fail — no auto-repair, no queue, no async processing. This is deliberately narrower than Shapeways/Craftcloud/i.materialise's guided-fix flows (idea-brief §6) but matches the two-week solo-delivery constraint. The file-id handoff to quote-engine is a settled input (idea-brief §13 locked-in pointer), not an open design question.

N/A — green-field mode (no reference module, MCP-Atlassian, project docs, or RAG channel was used; user selected "Skip — green-field" at step 3).

## 2. Goals

- User gets an immediate, synchronous yes/no on their STL upload — no pending/async state to interpret.
- Only valid, watertight models reach the quote engine — quote-engine never receives an unusable file (idea-brief §13 locked-in file-id contract).
- User understands in plain language why an upload was rejected, without needing to know mesh-repair terminology.

## 3. Non-goals

- Auto-repair or guided step-by-step fixing of broken meshes — parked as Approach B/C, reserved for after quote-engine + order-confirmation ship and real abandonment data exists (idea-brief §14).
- Support for non-STL formats (OBJ/3MF/STEP) — an explicit, disclosed competitive gap versus Shapeways/Craftcloud, accepted permanently (not just for v1) per PRD Socratic review (idea-brief §6, §15).
- Payments, checkout, multi-vendor routing, order fulfillment, vendor-facing tooling, and full accounts/auth — MVP-wide exclusions (idea-brief §5).

## 4. User stories

### US-01: Upload a valid STL and get confirmation
**As a** user
**I want** to upload an STL file of my model
**So that** I get confirmation it's stored and ready for a quote

### US-02: Get a clear reason when a file isn't a usable STL
**As a** user
**I want** a plain-language explanation when my file can't be read as an STL
**So that** I know it failed without needing to understand file formats

### US-03: Get a clear reason when geometry isn't watertight
**As a** user
**I want** a plain-language explanation when my model's geometry isn't watertight
**So that** I understand why it isn't printable without knowing mesh-repair jargon

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

**Given** a user has a well-formed, watertight STL file
**When** they upload it
**Then** the system stores it as a valid model and confirms to the user that it's ready for a quote

### AC-02 (US-02) — error

**Given** a user uploads a file
**When** the file is not a valid STL (wrong format, corrupted/truncated, or empty)
**Then** the system rejects the upload and tells the user their file could not be read as an STL

### AC-03 (US-03) — domain invariant

**Given** a user uploads a well-formed STL file
**When** the model's geometry is not watertight (has holes or self-intersections)
**Then** the system blocks the model from becoming valid and tells the user their mesh must be watertight before it can be printed

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
| Accuracy (false-negative rate) | validator flags ≥99% of meshes that later fail in the real slicer | manual QA sample against PrusaSlicer CLI (see stl-parse-feature-plan.md) |

## 6.1 Security / privacy

- **Data classification:** internal — uploaded STL files are user-supplied content; not secret, but access should be scoped to the uploader via the file's identifier.
- **Personal data touched:** none new — only the file itself; no user accounts/PII fields are collected in this feature (idea-brief §5, accounts/auth out of scope).
- **AuthZ/AuthN impact:** no accounts/auth in MVP; access control is limited to the model's unguessable system-generated identifier (AC-04) — no listing endpoint, no cross-object enumeration surface.
- **Abuse cases:**
  1. **Malicious/crafted STL exploiting a parser vulnerability** (idea-brief §10 top risk) — mitigation: parsing runs in a sandboxed/isolated process (memory cap, CPU/time limit, no network access, minimal filesystem access) so a parser exploit or crash cannot affect the host or other requests.
  2. **Resource exhaustion via forged triangle-count header / oversized allocation** — partially mitigated by the 50 MB max file-size limit (§6); parser must validate declared vs. actual size before allocating.
  3. **Disk exhaustion via unlimited/duplicate uploads with no quota** — each upload (including duplicates of the same file) gets a new file-id with no dedupe; residual risk is bounded by the existing file-size cap (§6) and rate limit (below), not by additional dedupe logic.
  4. **Spam upload** — rate limit of 30 uploads/minute per IP.
  5. **Identifier-enumeration attack** — mitigated by using unguessable system-generated identifiers (AC-04), making guessing/enumeration infeasible.
- **Security review:** Required — a new untrusted-binary-parsing boundary is idea-brief §10's top devil's-advocate risk.

## 7. Metrics / KPIs

- **Upload success rate for non-garbage files** — baseline: TBD (pre-launch, Reach unresolved per idea-brief §11), target: ≥90% of non-garbage uploads validated correctly within 30 days of launch (idea-brief §7 Approach A outcome metric).
- **False-negative rate (validator accepts, real slicer later rejects)** — baseline: 0, target: <5% within 90 days.
- **Time-to-first-quote pipeline unblock** — baseline: 0% of uploads reach quote-engine (feature doesn't exist yet), target: 100% of valid uploads automatically reach quote-engine with no manual intervention, immediately after launch (idea-brief §11 Impact — stl-upload as blocking dependency for the whole MVP flow).

## 8. Open questions

- [x] Confirm `feature_size` (Effort=S per idea-brief §7) still holds after Socratic edits (wider latency buffer, 50 MB file-size limit, UUIDv4-style identifier, sandboxed parsing) via `sdlc:classify-size` — owner: Yakiv Vakoliuk, due: before architecture-design — **Resolved: M**. PR count (2-5) and timeline (1 week) alone would suggest S, but the feature touches two of {new module, new API, DB migration} — a new untrusted-binary-parsing module, a new upload API surface, and file-metadata storage (§6.1) — which is S-disqualifying per the skill's mapping table; per the skill's edge-case guidance this risk signal outweighs the compact PR/timeline estimate. (Note: an earlier draft of this rationale also cited "public-facing breaking changes" — dropped on critic review, since stl-upload is a green-field first feature with no existing public surface to break; idea-brief §4.) User confirmed M.
- [ ] Feasibility (idea-brief §12) remains unconfirmed (greenfield, no track record) — revisit after the first real shipped feature. — owner: Yakiv Vakoliuk, due: after stl-upload ships
