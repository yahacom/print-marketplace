---
id: T8
epic: quote-engine
project: print-marketplace
wave: 3
priority: Must
estimate: M
blocks: [T10, T11]
blocked_by: [T2, T3, T5, T6, T7]
status: todo
prd_refs: [AC-01, AC-02, AC-04, AC-05, AC-06]
sad_refs: ["§5", "§6 flow 1", "§6 flow 2", "§8 Error handling row"]
adr_refs: ["0002", "0003"]
note: "Scope extended post-initial-breakdown to add cancelQuote() for the FE 'Back to start' flow (T16) — see edits dated 2026-10-02."
---

# T8 · `quote-service` orchestrator

**Epic:** [[_epic|quote-engine]]

## Why

This is the single place that wires T2 (read model) → T7/T4 (slice) → T5 (parse) → T6 (price) → T3 (persist) into one flow and maps every failure mode onto the `quote.*` error-code sentinels (sad.md §8). Every AC in the PRD except AC-03 (pure display) is this task's responsibility to get right end-to-end.

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-01, AC-02, AC-04, AC-05, AC-06
- SAD: [[../sad.md]] §5 (`services/quote-service.ts`), §6 flow 1 (happy path) + flow 2 (blocked quote), §8 (`quote.*` error codes: `quote.not_found`, `quote.unslicable`, `quote.exceeds_build_volume`, `quote.rate_limited`)
- ADR: [[../adr/0002-persist-quote-as-firestore-draft-order.md]], [[../adr/0003-in-process-fifo-queue-single-slicer-worker.md]]

## Scope

Implement `requestQuote(fileId): { jobId, promise: Promise<QuoteResult> }` where `QuoteResult` is either a success payload (price, time, breakdown), one of the typed `quote.*` errors, or `{ cancelled: true }`, following sad.md §6's two sequence diagrams exactly:

1. T2 read → not found or not-owned → `quote.not_found` (generic, no existence leak — AC-05/AC-06 collapse to the *same* code and message).
2. File exists → T7.enqueue → T4 slice → non-zero exit → `quote.unslicable` (AC-02).
3. Slice succeeds → T5 parse → `exceedsBuildVolume: true` → `quote.exceeds_build_volume` (AC-04).
4. Slice + parse succeed → T6 price → T3 persist → success payload (AC-01). **If T3's persist fails, this must not report success** — see T3's edge cases.

**Cancellation (new — added for the FE "Back to start" flow, T16):** expose `cancelQuote(jobId)`, a thin pass-through to T7's `cancel(jobId)` — once T2's read has completed and a T7 job exists for this request. T10 calls this when its WS connection closes. If the WS closes *before* T7.enqueue ever happens (still resolving the file-id), `cancelQuote` is a no-op — nothing was queued yet to cancel, and `requestQuote`'s own in-flight promise is simply abandoned by its caller (T10 already stopped listening to it).

## Acceptance criteria (GWT)

- [ ] **AC-qs-1 (AC-01 happy path):** Given a valid, owned file-id for a printable model, when `requestQuote` runs, then it resolves with `{ price, timeMinutes, filamentGrams, breakdown }` and the Firestore draft order (T3) was written.
- [ ] **AC-qs-2 (AC-02 unslicable):** Given a file-id whose model fails to slice, when `requestQuote` runs, then it resolves with `{ error: "quote.unslicable" }` and no Firestore write occurs.
- [ ] **AC-qs-3 (AC-04 exceeds build volume):** Given a file-id whose model slices but exceeds the fixed build volume, when `requestQuote` runs, then it resolves with `{ error: "quote.exceeds_build_volume" }`.
- [ ] **AC-qs-4 (AC-05 missing file):** Given a file-id with no corresponding stored file, when `requestQuote` runs, then it resolves with `{ error: "quote.not_found" }`.
- [ ] **AC-qs-5 (AC-06 not-owned / malformed, enumeration resistance):** Given a file-id that doesn't match `SAFE_FILE_ID` or belongs to no upload, when `requestQuote` runs, then it resolves with the **exact same** `{ error: "quote.not_found" }` as AC-qs-4 — byte-identical response shape, confirmed by a test asserting equality, not just "both are errors."
- [ ] **AC-qs-6 (partial-failure safety):** Given slicing and pricing succeed but T3's Firestore write throws, when `requestQuote` runs, then it does **not** resolve with a success payload — it surfaces an error distinct from the four `quote.*` user-facing codes (an operational failure, not a user input problem).
- [ ] **AC-qs-7 (cancel after enqueue):** Given a job is enqueued in T7 but not yet resolved, when `cancelQuote(jobId)` is called, then `requestQuote`'s promise resolves `{ cancelled: true }`, no Firestore write occurs, and no further side effects fire.
- [ ] **AC-qs-8 (cancel race with completion):** Given the slice finishes (success or error) in the same tick `cancelQuote` is called, then exactly one outcome wins — either the real result or `cancelled` — never both, and never a write to Firestore followed by a `cancelled` result (no orphaned draft for a quote the user never saw).

## Checklist

- [ ] Step 1 — Implement the orchestration function wiring T2→T7→T5→T6→T3 per sad.md §6's two flows.
- [ ] Step 2 — Map each failure branch to its `quote.*` code; confirm AC-qs-4 and AC-qs-5 produce identical response objects (not just identical codes — the full shape, per PRD §6.1's enumeration-resistance requirement).
- [ ] Step 3 — Integration-style unit tests (mocking T2/T4/T5/T6/T3 at their boundaries) for AC-qs-1..6.
- [ ] Step 4 — Implement `cancelQuote(jobId)` and the race-safety guard for AC-qs-8 (e.g. a single-resolution guard so whichever of "T7 resolved" or "cancel requested" happens first wins, and T3's write is skipped once cancellation has won).
- [ ] Step 5 — Unit tests for AC-qs-7/8.

## Edge cases

| Case | Behavior |
|---|---|
| T7's queue times out a job (T4's AC-ss-3) | Maps to `quote.unslicable` — a timeout is treated the same as an unslicable geometry outcome from the user's perspective (PRD §6.1: "resource exhaustion... treated as a blocked quote, not a hang"). |
| Two near-simultaneous requests for the *same* file-id | Both proceed independently through the queue (no request-level dedup) — PRD §3 non-goal explicitly rules out caching/dedup of repeated uploads; same logic applies here, not re-litigated. |

## Definition of Done

- [ ] All AC green, especially AC-qs-5's exact-shape equality check.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
