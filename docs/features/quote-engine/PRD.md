---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-02"
feature_size: M
stage: "03"
ticket: "<TBD>"
---

# PRD — quote-engine

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](../../CONTEXT.md)
> **Reference module:** `src/modules/stl-upload/` — code patterns used (layered routes→services→repositories, `{code, message}` error sentinels, per-IP rate limiting, strict file-id allowlist validation).
> **External context channels used:** None beyond reference module code — green-field otherwise.

## 1. Context

The marketplace's business model needs price accuracy within ±5% of real print cost — a bigger error is a direct loss, not just a UX wrinkle. The MVP flow (upload → quote → confirm/decline) is currently stuck: `stl-upload` ships a stored, format-valid model, but nothing turns that into a real quote, so no user can ever complete the flow (idea-brief §2).

`stl-upload` shipped as v0.1.0 + UI; order-confirmation (the next flow step) explicitly depends on quote-engine's output (time, material, price, breakdown) per the feature README. There's no external deadline — quote-engine is simply the only remaining blocker before any further MVP progress (idea-brief §4).

The team selected **Approach A — Single-Config Slice-and-Price**: every upload is sliced once against one fixed printer+material configuration, and the slicer's real output feeds a single pricing formula directly — no live re-slicing, no explicit confidence signal, deliberately simpler than what competitors (Sculpteo, Craftcloud) offer, to validate the core loop with real usage data first (idea-brief §13).

Reusable patterns from `stl-upload`: the same Fastify/TS layering (routes → services → repositories), the `{code, message}` error-sentinel convention, and per-IP rate limiting are expected to carry over to quote-engine's own request-handling layer — noted here for traceability; none of this appears in §5 AC, which stays business-observable only.

## 2. Goals

- A user who uploaded a valid model gets an exact price and print time from a real slice, not a weight-based guess — the core manifestation of the selected Approach A (§13).
- A user whose model can't be sliced sees a clear explanation instead of an indefinite wait or a crash.
- Order-confirmation (the next MVP flow step) becomes buildable, because quote-engine finally supplies the price/time/breakdown it depends on.

## 3. Non-goals

- Multi-material / multi-printer selection — MVP supports exactly one fixed printer+material configuration; broader choice is a later cycle (idea-brief §6).
- Live re-slicing as the user reorients/rescales the model — considered and parked as Approach B (idea-brief §14).
- An explicit confidence/trust signal or richer failure messaging beyond a basic error — considered and parked as Approach C (idea-brief §14).
- Payments and checkout — MVP-wide exclusion (overview.md).
- Multi-vendor matching/routing — MVP-wide exclusion (overview.md).
- Caching or reusing a prior slice result for a repeated upload of the same file — every quote request triggers a fresh slice; there is currently no way to detect that two uploads are the same file (idea-brief §9 edge case, resolved: always re-slice).

## 4. User stories

### US-01: Get an exact print quote

**As a** user
**I want** to get an exact price and print time for my uploaded model
**So that** I can decide whether to confirm or decline the order with real numbers instead of a rough guess

### US-02: See a clear error on unslicable models

**As a** user
**I want** a clear explanation when my model can't be sliced
**So that** I understand why instead of staring at a stuck or crashed page

### US-03: See the price breakdown

**As a** user
**I want** to see how the price splits into its components (time, material, margin)
**So that** I understand what I'm paying for before I confirm

### US-04: Be blocked when a model is too big to print

**As a** user
**I want** to be told clearly when my model exceeds the fixed printer's build volume
**So that** I don't get a bogus quote for something that can't actually be printed

### US-05: Be told when my uploaded model is no longer available

**As a** user
**I want** a clear message if the model I uploaded is no longer available by the time I request a quote
**So that** I understand I may need to re-upload instead of getting a confusing failure

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a user has a valid model stored from a prior upload
**When** the user requests a quote for that model
**Then** the system returns a print time, material usage, and price with a cost breakdown, and confirms the quote to the user

### AC-02 (US-02) — error

**Given** a user requests a quote for a model that cannot be sliced
**When** the system attempts to produce the quote
**Then** the system blocks the quote and tells the user that the model could not be processed, instead of leaving the request pending indefinitely

### AC-03 (US-03) — happy path (breakdown visibility)

**Given** a quote has been successfully produced
**When** the user views the quote
**Then** the system shows the price broken into its components (time cost, material cost, margin) rather than only the total

### AC-04 (US-04) — domain invariant

**Given** a model slices successfully but exceeds the fixed printer configuration's build volume
**When** the user requests a quote
**Then** the system blocks the quote and tells the user that the model exceeds the printer's maximum print size

### AC-05 (US-05) — cross-context

**Given** a user requests a quote referencing a previously uploaded model that is no longer available in storage
**When** the system attempts to produce the quote
**Then** the system blocks the quote and tells the user the model is no longer available, rather than failing with an unexplained error

### AC-06 (US-01) — authorization

**Given** a user supplies a file reference that was not issued to their own upload
**When** the user requests a quote using that reference
**Then** the system treats the request the same as an invalid reference and does not reveal to the requester whether a model exists for that id

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Latency p95 — quote generation | ≤ 60 s | quote-engine's generate-quote metric (slicer wall-clock + formula) |
| Throughput | ≥ 1 concurrent slicing job per instance; additional requests queue rather than fail | k6 smoke in CI (same pattern as stl-upload) |
| Availability | 99.0% | monthly SLO window — inherited from stl-upload (solo-maintainer, no on-call) |
| Price accuracy | ≤ ±5% deviation from real print cost | calibration sample of fixed-config prints |

## 6.1 Security / privacy

- **Data classification:** internal — STL files are user-uploaded content; the geometry itself carries no PII, same classification as stl-upload.
- **Personal data touched:** none new — quote-engine reuses the already-uploaded file-id and adds no new PII fields.
- **AuthZ/AuthN impact:** no login in this MVP; the only check added is that a quote request's file-id must resolve to a model that already passed stl-upload's validation — same `SAFE_FILE_ID`-style allowlist pattern as `model-repository.ts`.
- **Abuse cases:**
  - **File-id guessing / enumeration:** hide existence — a quote request for an unrecognized or not-yet-validated file-id gets the same generic response as a malformed one, so a requester can't distinguish "exists but isn't mine" from "doesn't exist" (AC-06).
  - **Draft/model leak:** not applicable in this MVP (no accounts, no draft concept beyond the uploaded/validated state already enforced by stl-upload).
  - **Spam create:** rate limit quote requests per IP (reuse stl-upload's 30/min/IP pattern) to protect the single shared slicing resource.
  - **Resource exhaustion via pathological geometry:** cap slicing wall-clock time; exceeding the cap is treated as a blocked quote (AC-02), not a hang.
  - **Slicer subprocess escape:** treat STL content as untrusted input to a subprocess; no shell interpolation of filenames (same pattern as model-repository's `SAFE_FILE_ID` path-safety check).
- **Security review:** Required — new backend integration invoking an external PrusaSlicer subprocess against untrusted file content. The NFR targets and this security review assume the PrusaSlicer CLI wrapper works correctly on real .stl files; that assumption is not yet verified (idea-brief §12 Tech feasibility; stl-parse-feature-plan.md checkpoint #1).

## 7. Metrics / KPIs

- **Price accuracy** — baseline: N/A (quoting doesn't exist yet), target: within ±5% of real print cost on 100% of fixed-configuration quotes.
- **Quote completion rate** — baseline: TBD (pre-launch, no data), target: ≥80% of slice attempts resolve as a clear pass or a clear blocked/error outcome within the turnaround target, rather than timing out unexplained.
- **Quote turnaround (p95)** — baseline: none (new feature), target: ≤60 s for a successful slice.

## 8. Open questions

- [x] ~~Формула ціни (ставка/год, ціна/грам, %маржі) потребує явного підтвердження product owner~~ — **Resolved 2026-10-02**: `rate_per_hour = 2.5 USD`, `price_per_gram = 0.02 USD`, `margin_pct = 20`. Confirmed by product owner during `sad.md` finalization. Values live in `docs/features/quote-engine/pricing-config.json`, referenced from `sad.md` §5/§11.
- [x] ~~Чи потрібно явно позначати в UI, яка саме конфігурація принтер+матеріал використовується~~ — **Resolved 2026-10-02**: ні, не позначається (default stands — single fixed configuration, no UI indicator). Confirmed during `sad.md` §11 resolution.
