---
status: Accept
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-30"
feature_size: TBD
stage: "03"
ticket: "<TBD>"
---

# PRD — stl-upload-ui

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](../../CONTEXT.md)
> **Reference module:** `docs/features/stl-upload/` (PRD + OpenAPI contract) — error-code catalog (`upload.invalid_format`, `upload.file_too_large`, `upload.rate_limited`), the file-id/UUIDv4 identifier-as-sole-access-control pattern (AC-04), and the cross-context handoff to quote-engine (AC-05) are reused as traceability context for §1, not copied into §5 AC.
> **External context channels used:** Project docs: `docs/overview.md` (MVP flow, success criteria).

## 1. Context

Today, zero non-technical users can reach the stl-upload backend — the only way to invoke it is curl/Postman, even though the upload step itself is fully implemented and tested (idea-brief §2). This affects every prospective marketplace user, since the upload step is 100% of the funnel's entry point (idea-brief §3); the nearest concrete audience is "the stakeholder/investor watching the upcoming demo, plus early testers."

The upload backend just shipped, so giving it a front door is immediately actionable, and there is an external trigger: a demo for a stakeholder/investor that requires the MVP flow to be shown to an actual person, not just exercised via an API client (idea-brief §4).

The accepted vector is Approach C — Guided Upload with Clear States (idea-brief §13): a single upload page built as a state machine (form → uploading → result) with plain-language, per-error-code messaging and no cosmetic/animated polish. Quote and order-confirmation states are explicitly out of scope until their backends exist.

The stl-upload backend's OpenAPI contract (`docs/features/stl-upload/contracts/openapi.yaml`) defines the complete plain-language error surface this UI must map: format/empty-file rejection, oversized-file rejection, and rate-limiting, plus a generic unreachable/5xx case — closing idea-brief §15's open question on the error-code catalog. The backend's PRD AC-04 pattern (an unguessable system-generated identifier is the sole access control in v1, no accounts/auth) is carried into this UI as a UI-observable constraint: the result screen must never expose state beyond the current session's own submission. The backend's AC-05 cross-context pattern (a valid upload is immediately usable by quote-engine without re-validation) is likewise carried into this UI as confirmation copy, not as a new integration this UI builds.

Step 7.5 critic finding — empty-file/progress-math robustness (idea-brief §9: "UI must not crash or divide-by-zero on progress math" for a 0-byte file) — overridden by author, rationale: the client rejects 0-byte files before upload/progress tracking begins, so the divide-by-zero condition the risk describes cannot occur; no separate AC/NFR line item is needed beyond AC-02's existing empty-file rejection.

## 2. Goals

- User gets an immediate, synchronous yes/no on their STL upload without needing curl/Postman or developer assistance.
- User who submits an invalid file understands in plain language why, without needing mesh-repair or file-format knowledge.
- The upload page is built as a state machine (form → uploading → result) so the quote and order-confirmation states can extend it later without a rewrite, even though those states are not built now.

## 3. Non-goals

- Quote-processing screen — quote-engine has no backend yet, only a plan document (idea-brief §5).
- Order-confirmation screen — backend PRD/SAD exist but all 16 implementation tasks are "Not started" (idea-brief §5).
- 3D model preview in the browser — not built in v1 (idea-brief §5).
- Login/auth — MVP-wide exclusion (idea-brief §5, per `overview.md`).
- Animated/cosmetic progress polish (e.g. a fabricated complexity readout) — this was Approach B, unanimously rated negative across Engineer/Executive/UX perspectives for risking a misleading impression during the stakeholder demo (idea-brief §8, §14).

## 4. User stories

### US-01: Upload a valid model and get confirmation

**As a** user
**I want** to upload an STL file of my model
**So that** I know it was accepted and is ready for a quote

### US-02: Get a clear reason when a file isn't a valid STL

**As a** user
**I want** a plain-language reason when my file is rejected as not a usable STL
**So that** I know what went wrong without needing file-format knowledge

### US-03: Get a clear reason when a file is too large

**As a** user
**I want** a distinct plain-language message when my file exceeds the size limit
**So that** I don't confuse it with a format error

### US-04: Get a clear reason when the server can't be reached

**As a** user
**I want** a distinct message when the connection drops mid-upload
**So that** I know to retry instead of assuming the page is frozen

### US-05: Submit only one model at a time

**As a** user
**I want** the system to reject multiple files or a folder dropped at once
**So that** I understand only a single model is accepted

### US-06: Trust that a filename can't run code on my screen

**As a** user
**I want** any filename shown on screen to be rendered as plain text
**So that** a maliciously crafted filename can't execute in my browser

### US-07: Trust that I only see my own upload's result

**As a** user
**I want** the result screen to reflect only my own current submission
**So that** I never see another user's upload outcome

### US-08: Know my accepted model is ready for the quote step automatically

**As a** user
**I want** confirmation that my successfully uploaded model is immediately usable downstream
**So that** I don't need to take any extra action

### US-09: Select a file when drag-and-drop isn't available

**As a** user
**I want** a click-to-browse fallback
**So that** I can still upload on a browser/OS without full drag-and-drop support

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a user has selected a well-formed STL file
**When** they submit it
**Then** the system shows the user confirmation that their model was accepted and is ready for a quote

### AC-01b (US-09) — happy path variant

**Given** a user's browser doesn't support drag-and-drop
**When** they open the upload page
**Then** the system offers a clickable way to select a file so the upload can still proceed

### AC-02 (US-02) — error

**Given** a user submits a file that isn't declared as an STL or is empty
**When** the system evaluates it
**Then** the system rejects the upload and tells the user, in plain language, that their file couldn't be accepted as an STL

### AC-03 (US-03) — error

**Given** a user submits a file larger than the maximum upload size
**When** the system evaluates it
**Then** the system rejects the upload and tells the user, in plain language, a message distinct from the invalid-format message, explaining the file was too large

### AC-04 (US-04) — error

**Given** a user is uploading and the connection to the server is lost or unreachable
**When** the system detects this
**Then** the system shows the user a distinct message that it couldn't reach the server, rather than continuing to show progress indefinitely

### AC-05 (US-05) — domain invariant

**Given** a user attempts to submit more than one file (multiple files or a dropped folder) at once
**When** they attempt the upload
**Then** the system blocks the submission before contacting the server and tells the user only one model may be uploaded at a time

### AC-06 (US-06) — domain invariant

**Given** the system needs to display the name of a file the user submitted
**When** it renders that name on screen
**Then** it shows it strictly as plain text, never as executable markup, regardless of what the filename contains

### AC-07 (US-07) — authorization

**Given** a user's file has been accepted
**When** the system shows the result
**Then** it shows only the outcome of that user's own current submission, never exposing another user's upload or result

### AC-08 (US-08) — cross-context

**Given** a user's model has been accepted and stored
**When** the upload completes
**Then** the system confirms to the user that their model is ready for the quote step, reflecting state a future quote step will consume without the user taking further action

## 6. Non-functional requirements

| Aspect                              | Target                           | Measurement                                                                     |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| Latency p95 (submit → result shown) | ≤ 10500 ms                       | client-side upload timer; mirrors stl-upload backend NFR ≤10000ms + UI overhead |
| Time-to-first-visible-feedback      | ≤ 2000 ms after file drop/select | client instrumentation                                                          |
| Progress feedback update rate       | ≥ 1 update/sec during upload     | client-side progress-event instrumentation                                      |
| Availability                        | 99.0%                            | inherits stl-upload backend monthly SLO window                                  |
| Max client-side file size pre-check | ≤ 50 MB                          | client-side validation before network call                                      |

## 6.1 Security / privacy

- **Data classification:** internal — uploaded filenames and file bytes pass through this UI to the existing backend; the UI itself stores nothing (no new data at rest).
- **Personal data touched:** none new — no accounts/PII fields are collected; only the file the user chooses to submit, unchanged from the stl-upload backend PRD.
- **AuthZ/AuthN impact:** none — this feature performs no authn/authz of its own; MVP-wide no-auth exclusion (idea-brief §5). The result screen only ever reflects the current session's own upload — no listing, no lookup-by-identifier UI (AC-07).
- **Abuse cases:**
  1. **Filename rendering (XSS)** — a crafted filename must never be interpreted as markup by the result screen; must render as plain text only (AC-06). Idea-brief §10 top devil's-advocate finding — a hard requirement, not optional hardening.
  2. **Multiple-file / folder drop** — used to attempt bypassing single-file validation; the UI must reject extras before contacting the server (AC-05).
  3. **Raw backend error leakage** — the UI must map every backend failure to one of the defined plain-language outcomes, never surfacing raw internal error detail or stack traces (idea-brief §10).
  4. **Spam / rapid resubmission** — the UI relies on the backend's existing rate limit and adds no throttling of its own, but must surface that outcome in plain language rather than a generic failure.
- **State persistence:** none — no upload state is persisted across a page refresh or navigation; a refresh or navigation away during upload simply abandons the in-flight request, and the user restarts from an empty form (idea-brief §9).
- **Security review:** N/A — this is a browser-side rendering layer with no accounts, storage, or file parsing of its own; the only residual risk (unsanitized filename rendering) is a standard client-rendering control, not a new untrusted-parsing boundary (cf. stl-upload backend §6.1, which moved parsing risk to quote-engine per ADR-0006). Recommend a lightweight review pass ahead of the stakeholder demo to confirm the filename-as-text requirement (AC-06) is enforced.

## 7. Metrics / KPIs

- **Successful non-technical upload completion rate** — baseline: 0% (no UI exists today), target: ≥90% in demo/test sessions without developer assistance (idea-brief §7 Approach C outcome metric).
- **Time-to-first-successful-upload** — baseline: impossible (no UI), target: <60 seconds for a first-time user (idea-brief §7 outcome metric, carried into the recommended Approach C).
- **Demo readiness** — baseline: 0% (backend only reachable via curl/Postman), target: 100% of the upload step demoable to a non-technical stakeholder by the demo date (idea-brief §4; exact date tracked in §8 below).

## 8. Open questions

- [ ] Exact demo date? Default: none set yet. — owner: Yakiv Vakoliuk, due: before architecture-design
- [ ] Frontend tooling choice (framework vs. plain HTML/JS)? — explicitly deferred to architecture design per idea-brief §12 Tech feasibility. — owner: Yakiv Vakoliuk, due: architecture-design stage
- [ ] `feature_size` not yet classified — run `sdlc:classify-size` before architecture-design (frontmatter currently TBD). — owner: Yakiv Vakoliuk, due: before architecture-design
