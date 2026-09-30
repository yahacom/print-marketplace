---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "04-05"
ticket: "<TBD>"
---

# 0003 — Use XMLHttpRequest for upload progress

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Yakiv Vakoliuk (Architect), during Socratic walk of sdlc:architecture-design

## Context

PRD §6 NFR requires progress feedback updates at ≥1/sec during upload, verified by client-side progress-event instrumentation. The upload page must submit the STL file to `POST /api/v1/uploads` (multipart/form-data) and surface upload progress to satisfy this NFR and QG-1 (fast, honest feedback, §1).

## Decision drivers

- PRD §6 NFR — progress feedback update rate ≥1 update/sec during upload (measured by client-side progress-event instrumentation).
- QG-1 (§1) — time-to-first-visible-feedback ≤2000ms and honest progress feedback are the top-ranked quality goal.
- No cosmetic/fabricated progress polish (PRD §3 non-goal) — progress shown must reflect real transfer bytes, not a fabricated animation.

## Considered options

1. **XMLHttpRequest** — use `xhr.upload.onprogress` to drive real byte-level progress updates for the multipart submit.
2. **fetch()** — use the modern `fetch()` API; upload-body progress is not natively/reliably exposed across all current browsers.

## Decision outcome

**Chosen:** XMLHttpRequest. It is the only option with a standardized, broadly-supported event (`xhr.upload.onprogress`) for real upload-byte progress, which the PRD non-goal on fabricated progress explicitly requires to be genuine (not animated/cosmetic). `fetch()`'s upload-progress story is inconsistent across browsers today, which risks silently violating the ≥1 update/sec NFR on some clients during the stakeholder demo.

## Consequences

**Positive**
- Real, standardized byte-level progress across all current browsers satisfies PRD NFR §6 (≥1 update/sec) without fallback logic.
- Directly supports the non-goal constraint against fabricated/animated progress — the progress bar reflects true transfer state.

**Negative**
- XHR's callback-based API is older and more verbose than `fetch()`'s Promise-based API; the upload client module needs a thin Promise wrapper around it.

**Neutral**
- If a future need arises for streaming response bodies or other `fetch()`-only capabilities, the upload client module can be revisited independently of this decision.

## Links

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §4
- Related ADR: none
