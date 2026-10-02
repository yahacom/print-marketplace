---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-02"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# Software Architecture Document — quote-engine

<!-- Stages 04-05 → see sdlc/plugin/skills/architecture-design/SKILL.md -->
<!-- 12 Arc42 sections. Empty sections — <!-- N/A: <one-line reason> -->. -->
<!-- C4 Context (L1) lives inline in §3. C4 Container (L2) lives inline in §5. -->
<!-- Заповнений приклад: див examples/course-lesson-mvp/sad.md у sdlc/ toolkit. -->

## 1. Introduction and goals

**Intent.** quote-engine turns a previously uploaded, validated STL model into an exact print quote by actually invoking PrusaSlicer CLI against one fixed printer+material configuration (Approach A, idea-brief §13) — real slice time and real material usage, not a weight-based estimate — then applies a configurable pricing formula to produce a price with a cost breakdown. It blocks clearly, instead of hanging or crashing, when a model can't be sliced, exceeds the fixed printer's build volume, or is no longer available in storage. It is the hard blocking dependency for order-confirmation, the next MVP flow step (PRD §1).

**Top-3 quality goals (1-liners; full scenarios in §10):**

1. Price accuracy — quoted price within ±5% of real print cost (PRD §6 NFR); a miss is a direct financial loss, not a UX defect.
2. Quote turnaround — p95 ≤ 60s end-to-end, including slicer wall-clock (PRD §6 NFR).
3. Graceful handling of bad input — unslicable, oversized, or missing models are blocked with a clear message, never a hang or crash (AC-02, AC-04, AC-05).

**Stakeholders.**

| Role | Interest | Sign-off owner? |
|---|---|---|
| user | gets an exact price/time to decide confirm or decline (US-01) | No |
| Product Owner (Yakiv Vakoliuk) | confirms the pricing formula and rates before launch (PRD §8 open question) | No |
| Tech Lead | SAD approval | Yes |
| Security Lead | reviews untrusted-STL-to-subprocess handling (PRD §6.1) | Yes |
| order-confirmation maintainer (Yakiv Vakoliuk) | owns the rework of ADR-0001/0002/0004 + data-model.md, required after this SAD's ADR-0002 override (§4, §11) | Yes |

## 2. Constraints

**Technical.**
- Node.js ≥20, TypeScript 6.0.3 (ESM, `"type": "module"`), Fastify 5.12.5.
- `@fastify/multipart`, `@fastify/static` already in use (stl-upload); no new HTTP-layer dependency expected.
- Filesystem-only persistence for model files (`STORAGE_DIR`) — no relational database anywhere in the repo (CLAUDE.md, confirmed by Explore scan: no Prisma/Drizzle/SQL). **Firestore is used for quote/draft-order persistence** (ADR-0002, §4) — a deliberate part of this feature's own architecture, not a deviation to be flagged away; see §9/§11 for the cross-feature follow-up it requires.
- Layered convention: `routes/` → `services/` → `repositories/`, per ADR-0004 (stl-upload).
- New dependency: PrusaSlicer CLI, invoked as an untrusted-input subprocess (stl-parse-feature-plan.md). **Version-pin policy: pin whichever PrusaSlicer CLI release is current-stable at implementation time**, recorded in the Dockerfile/deployment docs at that point — not a fixed version number in this SAD. The wrapper still needs verification against real .stl files regardless of which version is pinned (stl-parse-feature-plan.md human checkpoint #1, tracked in §11).

**Organisational.**
- Solo maintainer (Yakiv Vakoliuk), no on-call (inherited from stl-upload, PRD §6 Availability row).
- No hard external deadline — quote-engine is simply the only remaining blocker before further MVP progress (PRD §1; idea-brief §4).

**Conventions.**
- `CLAUDE.md` — project conventions.
- `{code, message}` error-sentinel shape, e.g. `upload.invalid_format` — quote-engine mints its own `quote.*` codes in the same shape.
- `SAFE_FILE_ID` path-safety regex pattern (`model-repository.ts`) — any file-id touching the filesystem must be validated this way.
- UUID v4 file-id (ADR-0005) — explicitly a cross-module contract; quote-engine reads this id, does not mint its own.

**Regulatory / external.**
- PRD §6.1: STL bytes are untrusted input to a subprocess — no shell interpolation of filenames/paths (same discipline as `SAFE_FILE_ID`).
- PRD §6.1: quote requests for an unrecognized or not-owned file-id get the same generic response as a malformed one (AC-06, enumeration resistance).

## 3. Context and scope

Quote-engine is a module inside the existing Print Marketplace Fastify monolith. A user who already uploaded a valid STL (stl-upload module) requests a quote for it; quote-engine slices that model via a local PrusaSlicer CLI subprocess and returns a price, print time, and material breakdown — or a clear blocking error if the model can't be sliced, exceeds the fixed printer's build volume, or no longer exists.

**External systems (in / out):**

| Actor or system | Type | Interaction |
|---|---|---|
| user | Person | Requests a quote for a previously uploaded model's file-id |
| PrusaSlicer CLI | System (external, local subprocess) | Receives STL + fixed printer/material profile, returns G-code + slicing stats via stdout, or a non-zero exit on unslicable/oversized geometry |

**C4 Context (L1):**

```mermaid
C4Context
    title quote-engine — System Context

    Person(user, "User", "uploaded a model, requests a quote before confirm/decline")
    System(marketplace, "Print Marketplace backend", "Fastify monolith — stl-upload + quote-engine modules")
    System_Ext(slicer, "PrusaSlicer CLI", "third-party slicer binary, invoked as a local subprocess")

    Rel(user, marketplace, "Requests a quote for a file-id", "WebSocket")
    Rel(marketplace, slicer, "Slices STL, reads G-code + stats", "local subprocess")
```

## 4. Solution strategy

**Top-3 strategic choices (the seeds for ADRs):**

1. **WebSocket push for the quote result** (ADR-0001) — the browser opens a WebSocket for a quote request and the server pushes `quote.done` / `quote.error` when the up-to-60s PrusaSlicer subprocess finishes, instead of holding an HTTP connection open or polling. Avoids the HTTP/proxy-timeout risk of a 60s blocking request while staying simpler than building a job-store + polling endpoint. Requires a new `@fastify/websocket` dependency and a new client-side pattern in `src/ui/`.

2. **In-process FIFO queue, single worker, for the shared PrusaSlicer subprocess** (ADR-0003) — resolved after the initial Socratic pass left it open. One async loop holds pending quote requests in memory and runs exactly one PrusaSlicer subprocess at a time; additional requests wait their turn rather than running concurrently. Zero new infrastructure, matches the NFR's "≥1 concurrent, rest queue" literally, and mirrors the existing in-memory rate-limiter pattern. Fixes §7's scaling threshold as a hard single-instance constraint, not a conditional one.

3. **Persist the quote as a Firestore draft order, reusing order-confirmation's shared id** (ADR-0002) — quote-engine writes the computed price/time/breakdown into Firestore keyed by the same UUID v4 file-id that stl-upload minted and order-confirmation already expects to reuse (order-confirmation ADR-0003), so order-confirmation's later confirm step can act on an existing draft instead of re-deriving the quote. **This is a deliberate, explicit override of order-confirmation's own already-Accepted architecture** (ADR-0001 Firestore-for-orders-only, ADR-0002 in-process live recomputation, ADR-0004 exactly-once-via-`create()`, and data-model.md's "No persisted quote snapshot") — the product owner chose to proceed with Firestore-at-quote-time now and revisit order-confirmation's docs afterward, rather than follow the already-accepted "stateless, recompute live" design. Tracked as a High-severity risk in §11, not an open question, because the decision itself is made — the follow-up rework is the open item.

Each tactical decision in later sections should be traceable to one of these strategic seeds. Tactical decisions that *contradict* a strategic choice are red flags — surface them in §11 Risks.

**Decision overrides (¶4):** the Firestore-persistence choice above (strategic choice 3 / ADR-0002) knowingly contradicts order-confirmation's already-Accepted ADR-0001/0002/0004 and data-model.md. Recorded here per the critic-phase override convention so downstream skills (`sdlc:generate-data-model`, `sdlc:break-tasks`) see this was a deliberate choice, not a missed cross-feature read. See §11 for the required order-confirmation follow-up.

## 5. Building block view

Simple layered style (routes → services → repositories), following the precedent set in stl-upload (ADR-0004). quote-engine is a new, self-contained module alongside stl-upload in the same Fastify monolith — no hexagonal/ports-and-adapters split, consistent with the existing single-module-count rationale in that ADR.

**Internal decomposition:**

```
src/modules/quote-engine/
├── module.ts                  <FastifyPluginAsync — registers WS route + rate limit>
├── routes/
│   ├── quote-routes.ts        <WS handshake, delegates to quote-service>
│   └── rate-limit.ts          <reuse stl-upload's pattern, own counter>
├── services/
│   ├── quote-service.ts       <orchestrates: validate file-id → slice → parse → price → persist>
│   ├── slicer-queue.ts        <in-process FIFO queue, single worker, ADR-0003>
│   ├── slicer-service.ts      <PrusaSlicer CLI subprocess wrapper, timeout>
│   ├── gcode-parser.ts        <stdout/G-code → {time_minutes, filament_grams}>
│   └── pricing-service.ts     <reads config/pricing.json → {total_price, breakdown}>
├── config/
│   └── pricing.json           <rate_per_hour, price_per_gram, margin_pct — see pricing-config.json>
└── repositories/
    ├── model-reader.ts        <reads <file-id>.stl from shared STORAGE_DIR, SAFE_FILE_ID-checked>
    └── quote-repository.ts    <Firestore draft-order writes, ADR-0002>
```

**C4 Container (L2):**

```mermaid
C4Container
    title quote-engine — Containers

    Person(user, "User")

    Container_Boundary(marketplace, "Print Marketplace backend (Fastify monolith)") {
        Container(stlupload, "stl-upload module", "Node/TS", "Format/size validation, stores STL by file-id")
        Container(quoteengine, "quote-engine module", "Node/TS", "WS endpoint, slicer invocation, pricing, Firestore writes")
    }

    ContainerDb(fs, "Local filesystem", "STORAGE_DIR", "model files, <file-id>.stl")
    ContainerDb(firestore, "Firestore", "Google Cloud managed NoSQL", "draft-order documents, keyed by shared file-id (ADR-0002)")
    System_Ext(slicer, "PrusaSlicer CLI", "third-party slicer binary, local subprocess")

    Rel(user, quoteengine, "Opens WS, requests a quote for a file-id", "WebSocket")
    Rel(stlupload, fs, "Writes validated STL", "fs")
    Rel(quoteengine, fs, "Reads STL directly, no API call to stl-upload", "fs")
    Rel(quoteengine, slicer, "Slices STL, reads G-code + stats", "local subprocess")
    Rel(quoteengine, firestore, "Writes draft order (price/time/breakdown)", "firebase-admin SDK")
```

## 6. Runtime view

**Critical flow 1: Happy path — AC-01 (exact quote returned)**

```mermaid
sequenceDiagram
    actor User
    participant quote-engine
    participant Local filesystem
    participant PrusaSlicer CLI
    participant Firestore

    User->>quote-engine: Opens WebSocket, requests a quote for file-id
    quote-engine->>Local filesystem: Reads <file-id>.stl
    Local filesystem-->>quote-engine: STL bytes
    quote-engine->>PrusaSlicer CLI: Slices STL (local subprocess, fixed printer/material profile)
    PrusaSlicer CLI-->>quote-engine: G-code + stats (time, filament grams)
    quote-engine->>quote-engine: Applies pricing formula → price + breakdown
    quote-engine->>Firestore: Writes draft order (price, time, breakdown), keyed by file-id
    Firestore-->>quote-engine: ok
    quote-engine-->>User: WS push quote.done {price, time, breakdown}
```

**Critical flow 2: Blocked quote — AC-02 / AC-04 / AC-05 / AC-06 (generic blocking error)**

```mermaid
sequenceDiagram
    actor User
    participant quote-engine
    participant Local filesystem
    participant PrusaSlicer CLI

    User->>quote-engine: Opens WebSocket, requests a quote for file-id
    quote-engine->>Local filesystem: Reads <file-id>.stl

    alt file missing or not owned by this requester (AC-05 / AC-06)
        Local filesystem-->>quote-engine: not found
        quote-engine-->>User: WS push quote.error {code: quote.not_found} — same generic response either way, no existence leak
    else file exists
        Local filesystem-->>quote-engine: STL bytes
        quote-engine->>PrusaSlicer CLI: Slices STL
        alt unslicable geometry (AC-02) or exceeds fixed build volume (AC-04)
            PrusaSlicer CLI-->>quote-engine: non-zero exit, or stats exceeding build-volume limits
            quote-engine-->>User: WS push quote.error {code: quote.unslicable | quote.exceeds_build_volume}
        end
    end
```

<!-- Only 2 of the 5 AC-mapped flows drawn, per explicit user choice during the Socratic walk — on the low end of the 3-5 range typical for M-size, but still meets the "happy-path + ≥1 failure-mode flow" floor. -->

## 7. Deployment view

quote-engine deploys inside the same single Fastify process as stl-upload — no new deploy unit. **Scaling threshold: single instance only** (ADR-0003) — the in-memory FIFO queue bounding PrusaSlicer concurrency lives in one process's memory, so a second instance would run its own independent queue with no visibility into the first instance's in-flight slice, defeating the "≥1 concurrent, rest queue" NFR guarantee across instances. Lifting this requires superseding ADR-0003 with an external job queue — not planned for this MVP.

**Monitoring:**
- Metrics — extend `src/metrics.ts`'s existing Prometheus pattern with: `quote_slice_duration_seconds` (histogram, buckets to 60s+Inf, mirrors the existing `http_request_duration_seconds` bucket shape), `quote_slicer_queue_depth` (gauge), `quote_slicer_exit_code` (counter, labeled by exit code).
- Alerts — queue depth sustained >5 for >2 min (approaching the "additional requests queue rather than fail" NFR's breaking point); slicer wall-clock p95 approaching the 60s NFR target.
- Tracing — none beyond existing Fastify request logging (`src/request-logging.ts`); no OpenTelemetry in this repo.

**Scaling thresholds:**
- Single instance only (ADR-0003) — fixed, not conditional.
- No table/row-count scaling concern — quote-engine has no relational storage; Firestore draft-order writes scale with request volume, not with any schema-level ceiling.

<!-- Not N/A — this feature does change deployment-relevant scaling guidance (single-instance ceiling), even though the deploy unit itself is unchanged. -->

## 8. Crosscutting concepts

| Concept | Convention | Where defined |
|---|---|---|
| Logging | Fastify built-in logger, same as stl-upload; silenced in tests unless a logStream is passed | `src/request-logging.ts` |
| Authentication | None — no accounts in MVP; the UUID v4 file-id is the sole access control (stl-upload ADR-0005) | CLAUDE.md, stl-upload ADR-0005 |
| Error handling | `{code, message}` sentinel, quote-engine mints `quote.*` codes (`quote.not_found`, `quote.unslicable`, `quote.exceeds_build_volume`, `quote.rate_limited`) | stl-upload `routes/upload-routes.ts` pattern |
| ID strategy | No new id minted — reuses stl-upload's UUID v4 file-id end-to-end as quoteId (order-confirmation ADR-0003) | stl-upload ADR-0005, order-confirmation ADR-0003 |
| Rate limiting | In-memory per-IP fixed-window limiter, own counter instance, same shape as `rate-limit.ts` | stl-upload `routes/rate-limit.ts` pattern |
| Subprocess safety | PrusaSlicer invoked via `child_process` with an argument array (never a shell string) — no shell interpolation of filenames/paths, same discipline as `SAFE_FILE_ID` | PRD §6.1 |
| Credential management | **New in this repo**: Firestore service-account key loaded from an env var (e.g. `FIRESTORE_CREDENTIALS_JSON`), never committed; first credential-bearing dependency in the codebase | CLAUDE.md security rules (secrets never hardcoded) |
| Internationalisation | N/A, English only | — |
| Observability | Prometheus metrics only (no OpenTelemetry anywhere in repo) — see §7 | `src/metrics.ts` |

## 9. Architecture decisions

| # | Title | Status | Section |
|---|---|---|---|
| 0001 | Push the quote result to the browser over WebSocket instead of a blocking HTTP request | Accepted | §4 |
| 0002 | Persist the computed quote to Firestore as a draft order, keyed by the shared file-id | Accepted | §4 |
| 0003 | Use an in-process FIFO queue with a single worker to bound concurrent PrusaSlicer invocations | Accepted | §4 |

ADR files live under `docs/features/quote-engine/adr/NNNN-<title>.md`.

## 10. Quality requirements

Each top-3 goal from §1 expanded into a full scenario:

**QG-1. Price accuracy**
- **When:** a valid model receives a quote from the fixed printer+material configuration.
- **Then:** the quoted price deviates ≤ ±5% from real print cost (PRD §6 NFR, verbatim).
- **How verify:** calibration sample of fixed-configuration prints (PRD §6 NFR measurement column) — compare quoted vs. actual material/time cost per sample print, assert deviation ≤5%. **Sample size TBD** — not specified in PRD; a concrete number is a `sdlc:plan-tests` detail, not an architectural decision.

**QG-2. Quote turnaround**
- **When:** a valid model requests a quote.
- **Then:** end-to-end latency (including real PrusaSlicer wall-clock) is p95 ≤ 60s (PRD §6 NFR, verbatim).
- **How verify:** `quote_slice_duration_seconds` Prometheus histogram (§7); k6 load test matching the existing CI smoke-test pattern (`.github/workflows/ci.yml`), asserting the p95 bucket.

**QG-3. Graceful handling of bad input**
- **When:** a quote is requested for a model that is unslicable, exceeds the fixed build volume, no longer exists, or isn't owned by the requester (AC-02, AC-04, AC-05, AC-06).
- **Then:** the system pushes a `quote.error` WS message with the matching `quote.*` code — never a hang, timeout, or crash.
- **How verify:** integration tests per AC with fixture files (non-watertight STL, oversized STL, missing file-id, foreign file-id) — assert the correct error code is pushed and no WS connection is left open past the request.

## 11. Risks and technical debt

Resolved since the initial Socratic pass (see §4, §7, ADR-0003, `pricing-config.json`): concurrency model (in-process FIFO queue, ADR-0003), PrusaSlicer version-pin policy (§2: pin current-stable at implementation time), pricing formula rates (rate_per_hour=2.5 USD, price_per_gram=0.02 USD, margin_pct=20 — `../pricing-config.json`), UI config indicator (PRD §8 default confirmed: no indicator), Firestore draft-order retention (confirmed: no automatic cleanup for MVP — moved to Accepted debt below).

| Risk / debt | Severity | Mitigation | Owner |
|---|---|---|---|
| order-confirmation's already-Accepted architecture (ADR-0001/0002/0004, data-model.md) is now stale — it assumed quote-engine persists nothing and recomputes live; ADR-0002 here persists a draft order instead | High | **Scoped as a separate `sdlc:architecture-design` pass for order-confirmation** — not resolved within this SAD. Must run before either feature is implemented. | Yakiv Vakoliuk |
| PrusaSlicer wrapper has not been verified against real .stl files yet (stl-parse-feature-plan.md human checkpoint #1) — independent of which version gets pinned | Medium | Run the wrapper against a real-file corpus before this SAD's decisions are treated as final | Yakiv Vakoliuk |

**Accepted debt (acceptable in v1, plan to fix later):**
- No multi-instance scaling for quote-engine — ADR-0003's in-process queue is a hard single-instance ceiling (§7). Acceptable for a solo-maintainer MVP with no stated multi-instance requirement; superseding ADR-0003 is the escape hatch if that changes.
- No automatic cleanup of unconfirmed Firestore draft orders (ADR-0002) — drafts accumulate indefinitely if never confirmed. Acceptable for MVP; a TTL policy is a cheap follow-up once real usage data shows it's needed.
- Quote determinism between the browser-facing quote and any later re-derivation is assumed, not verified — if PrusaSlicer or the pricing formula ever produce a different result for the same input between two calls, nothing in this SAD currently detects that drift.

## 12. Glossary

| Term | Meaning |
|---|---|
| model | The 3D object a user wants printed (CONTEXT.md). Not the STL file — the file is one encoding of it. |
| STL file | File format encoding a model's surface as triangles (CONTEXT.md). |
| watertight mesh | A model surface with no holes — required for PrusaSlicer to slice it (CONTEXT.md). Checked by quote-engine, not stl-upload (ADR-0006). |
| valid model | A model that passed stl-upload's format/size checks and is fit for the slicer (CONTEXT.md). |
| quote | A price proposal (print time + material usage + price) produced by slicing a valid model (CONTEXT.md). |
| cost breakdown | The decomposition of a quote's price into components — time cost, material cost, margin (CONTEXT.md). |
| order | A record of the user's confirm/decline decision on a quote (CONTEXT.md) — owned by order-confirmation, not this feature. |
| file-id | The UUID v4 stl-upload mints at upload time (stl-upload ADR-0005); threaded unchanged through quote-engine and order-confirmation as the shared identifier (order-confirmation ADR-0003). Not a CONTEXT.md domain term — technical identifier. |
| **draft order** *(new — not yet in CONTEXT.md)* | The Firestore document quote-engine writes at quote time (ADR-0002), holding price/time/breakdown before any confirm/decline decision exists. Flagged here for a `sdlc:fix-term` follow-up — this concept didn't exist before this SAD's §4 override and isn't yet in the domain glossary. |
