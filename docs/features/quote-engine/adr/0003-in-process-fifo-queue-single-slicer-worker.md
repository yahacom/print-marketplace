---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-02"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0003 — Use an in-process FIFO queue with a single worker to bound concurrent PrusaSlicer invocations

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Yakiv Vakoliuk (Architect) — resolved as a follow-up to the sad.md §4 Socratic walk, which originally left this open (§11)

## Context

PrusaSlicer is CPU-heavy. If multiple quote requests invoke it concurrently, they compete for the same CPU cores and can blow the p95 ≤60s turnaround target (PRD §6 NFR) for all of them at once. PRD §6 NFR is explicit: "≥1 concurrent slicing job per instance; additional requests queue rather than fail." This decision was deliberately deferred during the initial §4 Socratic pass (tracked as an Open architectural decision in §11) and is resolved here.

## Decision drivers

- PRD §6 NFR: ≥1 concurrent slicing job per instance; additional requests queue, not fail.
- §1 QG-2 (quote turnaround, p95 ≤60s) — concurrent slicer runs would make this unpredictable.
- §2 Organisational: solo maintainer, no infra budget for a new service.
- Existing precedent: stl-upload's in-memory per-IP rate limiter (`rate-limit.ts`) is the same "simple in-memory mechanism, single instance" shape.

## Considered options

1. **In-process FIFO queue, single worker** — one async loop in `quote-engine`'s process holds pending requests in memory and runs exactly one PrusaSlicer subprocess at a time.
2. **Bounded worker pool (N workers)** — up to N PrusaSlicer subprocesses run concurrently, N configured (e.g. to CPU core count).
3. **External job queue (BullMQ + Redis)** — quote requests become jobs in a Redis-backed queue, processed by one or more workers, potentially across instances.

## Decision outcome

**Chosen:** Option 1. The NFR only requires ≥1 concurrent slicing job per instance — a single-worker FIFO queue satisfies that literally, with zero new infrastructure and zero new dependencies, consistent with the solo-maintainer effort budget (§2). Options 2 and 3 solve a throughput problem the NFR does not currently ask to solve.

## Consequences

**Positive**
- Zero new infrastructure or dependencies — implemented as plain in-memory state in the `quote-engine` module.
- Directly matches the NFR's literal wording; no interpretation gap.
- Reuses an already-familiar pattern in this codebase (stl-upload's in-memory rate limiter).

**Negative**
- **Hard single-instance ceiling** (§7): the queue lives in one process's memory, so a second instance would run its own independent queue with no visibility into the first instance's in-flight slice — defeating the "≥1 concurrent, rest queue" guarantee across instances. Multi-instance deployment is not possible without replacing this mechanism.
- Lower throughput ceiling than a worker pool under concurrent load — acceptable today because the NFR doesn't ask for more.

**Neutral**
- If a future revision needs multi-instance scaling, this ADR would be superseded by Option 3 (external job queue) — not a simple config change, a real migration.

## Links

- PRD: [[../PRD.md]] §6 NFR
- SAD: [[../sad.md]] §4, §7, §11
- Related ADR: none in this feature yet
