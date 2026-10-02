---
id: T7
epic: quote-engine
project: print-marketplace
wave: 3
priority: Must
estimate: S
blocks: [T8, T11]
blocked_by: [T4]
status: todo
prd_refs: ["§6 NFR throughput"]
sad_refs: ["§4 strategic choice 2", "§7"]
adr_refs: ["0003"]
note: "Scope extended post-initial-breakdown to add cancel(jobId) for the FE 'Back to start' flow (T16) — see edits dated 2026-10-02."
---

# T7 · `slicer-queue` — in-process FIFO, single worker

**Epic:** [[_epic|quote-engine]]

## Why

PrusaSlicer is CPU-heavy; running two slices concurrently blows the p95 ≤60s target for both (ADR-0003). This task implements the queue ADR-0003 chose: one async loop, one PrusaSlicer subprocess at a time, everything else waits its turn in memory.

## Linked artifacts

- PRD: [[../PRD.md]] §6 NFR ("≥1 concurrent slicing job per instance; additional requests queue rather than fail")
- SAD: [[../sad.md]] §4 strategic choice 2, §7 (hard single-instance ceiling — this queue's memory lives in one process)
- ADR: [[../adr/0003-in-process-fifo-queue-single-slicer-worker.md]]

## Scope

- Wrap T4's `sliceModel` behind a FIFO queue: `enqueue(job): { id, promise: Promise<SliceResult> }` resolves in submission order, one job running at a time. The job id is returned so a caller (T8/T10) can cancel it later.
- Expose current queue depth (consumed by T11's `quote_slicer_queue_depth` gauge).
- **Cancellation (new — added for the FE "Back to start" flow, T16):** `cancel(jobId)` — if the job is still pending (not yet started), remove it from the queue without ever invoking T4; if it's the one currently running, call T4's `cancel()` on it. Either way the job's promise resolves with a `cancelled` result and the worker loop immediately moves on to the next pending job (no idle wait for a job nobody wants).
- **Explicitly out of scope:** multi-instance coordination — ADR-0003 is a deliberate hard single-instance ceiling (sad.md §7), not a bug to work around here.

## Acceptance criteria (GWT)

- [ ] **AC-sq-1 (single worker):** Given 3 jobs enqueued near-simultaneously, when processed, then PrusaSlicer subprocesses never run concurrently — confirmed by instrumenting T4's wrapper calls in a test (e.g. asserting no overlap in start/end timestamps).
- [ ] **AC-sq-2 (FIFO order):** Given jobs A, B, C enqueued in that order, when processed, then they complete in submission order (not reordered by slice duration).
- [ ] **AC-sq-3 (queue depth readable):** Given N jobs are pending (not yet started) plus 1 running, when queried, then the depth reflects the pending count accurately at any point mid-processing.
- [ ] **AC-sq-4 (one job's failure doesn't block the queue):** Given job A fails (non-zero exit or timeout, from T4), when the queue continues, then job B still runs — a failed slice doesn't wedge the worker loop.
- [ ] **AC-sq-5 (cancel a pending job):** Given job B is still waiting behind running job A, when `cancel(B.id)` is called, then B's promise resolves `cancelled` immediately, B never reaches T4's `sliceModel`, and the queue depth drops accordingly.
- [ ] **AC-sq-6 (cancel the running job):** Given job A is currently slicing, when `cancel(A.id)` is called, then T4's `cancel()` is invoked for A, A's promise resolves `cancelled`, and the worker immediately starts the next pending job without waiting for A's original timeout.

## Checklist

- [ ] Step 1 — Implement an in-memory array/linked-list job queue + a single always-running worker loop (`while (true) { await processNext() }` shape, or an async generator — match whatever's idiomatic for this codebase's existing in-memory rate-limiter in `routes/rate-limit.ts` from `stl-upload`).
- [ ] Step 2 — Implement `enqueue` returning a Promise resolved/rejected by the worker once that job's slice completes.
- [ ] Step 3 — Expose `getQueueDepth(): number`.
- [ ] Step 4 — Implement `cancel(jobId)` per the two branches above (pending-removal vs. running-cancel-via-T4).
- [ ] Step 5 — Unit tests for AC-sq-1..6, mocking T4's `sliceModel` with controllable delays to simulate concurrency, ordering, and cancellation.

## Edge cases

| Case | Behavior |
|---|---|
| Queue depth sustained >5 for >2min (sad.md §7 alert threshold) | Out of scope for this task's code — that's an alerting-config concern for T11/ops, not a queue behavior change. |
| Process restart with jobs mid-flight | In-memory queue is lost on restart — acceptable per ADR-0003's "zero new infrastructure" tradeoff; callers (WS clients in T10) see a dropped connection, handled as a quote failure per ADR-0001's consequence. |
| `cancel()` called twice for the same jobId, or for an already-resolved job | No-op the second time — mirrors T4's AC-ss-7 no-throw-on-already-resolved contract. |

## Definition of Done

- [ ] All AC green, including a concurrency-assertion test (not just "it ran successfully").
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
