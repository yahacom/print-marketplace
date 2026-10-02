---
id: T8
epic: quote-engine
project: print-marketplace
wave: 3
priority: Must
estimate: M
blocks: [T10, T11]
blocked_by: [T2, T3, T5, T6, T7]
status: done
prd_refs: [AC-01, AC-02, AC-04, AC-05, AC-06]
sad_refs: ["§5", "§6 flow 1", "§6 flow 2", "§8 Error handling row"]
adr_refs: ["0002", "0003"]
note: "Scope extended post-initial-breakdown to add cancelQuote() for the FE 'Back to start' flow (T16) — see edits dated 2026-10-02. Failure mapping revised 2026-10-02 to the real PrusaSlicer behavior (T4/T5 notes): non-watertight and oversized are classified by T5, not by exit code."
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
2. File exists → T7.enqueue → T4 run (`--info`, then slice) → feed T4's raw result to T5, then map T5's `kind`:
   - T4 non-zero exit at either stage, `timedOut`, or T5 `non_manifold` or `parse_error` → `quote.unslicable` (AC-02). (`parse_error` is also logged as an operational error — it signals version drift, not user input.)
   - T5 `exceeds_build_volume` → `quote.exceeds_build_volume` (AC-04). Note: an oversized model exits 0 with no G-code, so this must be decided from T5's classification, never from the exit code.
3. T5 `stats` → T6 price → T3 persist → success payload (AC-01). **If T3's persist fails, this must not report success** — see T3's edge cases.
4. In every branch, call T4's `cleanup()` (per-job temp directory) in a `finally` — success, error, timeout and cancel alike.

**Cancellation (new — added for the FE "Back to start" flow, T16):** expose `cancelQuote(jobId)`, a thin pass-through to T7's `cancel(jobId)` — once T2's read has completed and a T7 job exists for this request. T10 calls this when its WS connection closes. If the WS closes *before* T7.enqueue ever happens (still resolving the file-id), `cancelQuote` is a no-op — nothing was queued yet to cancel, and `requestQuote`'s own in-flight promise is simply abandoned by its caller (T10 already stopped listening to it).

## Acceptance criteria (GWT)

- [x] **AC-qs-1 (AC-01 happy path):** Given a valid, owned file-id for a printable model, when `requestQuote` runs, then it resolves with `{ price, timeMinutes, filamentGrams, breakdown }` and the Firestore draft order (T3) was written.
- [x] **AC-qs-2 (AC-02 unslicable):** Given a file-id whose model fails to slice (non-zero exit from T4), or T5 reports `non_manifold`, when `requestQuote` runs, then it resolves with `{ error: "quote.unslicable" }` and no Firestore write occurs — including the case where PrusaSlicer itself slices a non-watertight model "successfully" with exit 0.
- [x] **AC-qs-3 (AC-04 exceeds build volume):** Given a file-id whose model is larger than the fixed build volume — which PrusaSlicer reports as exit 0 with no G-code — when `requestQuote` runs, then it resolves with `{ error: "quote.exceeds_build_volume" }` (T5 `exceeds_build_volume`).
- [x] **AC-qs-4 (AC-05 missing file):** Given a file-id with no corresponding stored file, when `requestQuote` runs, then it resolves with `{ error: "quote.not_found" }`.
- [x] **AC-qs-5 (AC-06 not-owned / malformed, enumeration resistance):** Given a file-id that doesn't match `SAFE_FILE_ID` or belongs to no upload, when `requestQuote` runs, then it resolves with the **exact same** `{ error: "quote.not_found" }` as AC-qs-4 — byte-identical response shape, confirmed by a test asserting equality, not just "both are errors."
- [x] **AC-qs-6 (partial-failure safety):** Given slicing and pricing succeed but T3's Firestore write throws, when `requestQuote` runs, then it does **not** resolve with a success payload — it surfaces an error distinct from the four `quote.*` user-facing codes (an operational failure, not a user input problem).
- [x] **AC-qs-7 (cancel after enqueue):** Given a job is enqueued in T7 but not yet resolved, when `cancelQuote(jobId)` is called, then `requestQuote`'s promise resolves `{ cancelled: true }`, no Firestore write occurs, and no further side effects fire.
- [x] **AC-qs-8 (cancel race with completion):** Given the slice finishes (success or error) in the same tick `cancelQuote` is called, then exactly one outcome wins — either the real result or `cancelled` — never both, and never a write to Firestore followed by a `cancelled` result (no orphaned draft for a quote the user never saw).

## Checklist

- [x] Step 1 — Implement the orchestration function wiring T2→T7→T5→T6→T3 per sad.md §6's two flows.
- [x] Step 1b — Ensure T4's `cleanup()` runs in a `finally` for every outcome (assert in tests that the temp directory is gone after success, error, and cancel).
- [x] Step 2 — Map each failure branch to its `quote.*` code; confirm AC-qs-4 and AC-qs-5 produce identical response objects (not just identical codes — the full shape, per PRD §6.1's enumeration-resistance requirement).
- [x] Step 3 — Integration-style unit tests (mocking T2/T4/T5/T6/T3 at their boundaries) for AC-qs-1..6.
- [x] Step 4 — Implement `cancelQuote(jobId)` and the race-safety guard for AC-qs-8 (e.g. a single-resolution guard so whichever of "T7 resolved" or "cancel requested" happens first wins, and T3's write is skipped once cancellation has won).
- [x] Step 5 — Unit tests for AC-qs-7/8.

## Edge cases

| Case | Behavior |
|---|---|
| T7's queue times out a job (T4's AC-ss-3) | Maps to `quote.unslicable` — a timeout is treated the same as an unslicable geometry outcome from the user's perspective (PRD §6.1: "resource exhaustion... treated as a blocked quote, not a hang"). |
| T5 returns `parse_error` (unexpected PrusaSlicer output) | User sees `quote.unslicable` (no new user-facing code); the cause is logged distinctly so version drift is visible to the operator rather than looking like bad user input. |
| Two near-simultaneous requests for the *same* file-id | Both proceed independently through the queue (no request-level dedup) — PRD §3 non-goal explicitly rules out caching/dedup of repeated uploads; same logic applies here, not re-litigated. |

## Definition of Done

- [x] All AC green, especially AC-qs-5's exact-shape equality check.
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- API: `createQuoteService(deps)` → `{ requestQuote(fileId) → { jobId, promise }, cancelQuote(jobId) }`. It is a factory (not a module-level `requestQuote` as in the T1 stub) because the real Firestore repository throws at construction without credentials; **T10 must wire it**: `getModelPath`, the T7 queue (`enqueueSlice`/`cancelSlice` or a `createSlicerQueue()`), `parseSliceOutput`, `computePrice`, `createQuoteRepository()`, and `app.log` as `log`.
- `jobId` is a request-level id minted by `requestQuote` (T7's queue id only exists after the file is resolved); `cancelQuote` maps it to the queue job.
- ASSUMPTION: the slicer needs a file path but T2's `readModel` returns bytes (up to 50 MB). Added `getModelPath(fileId)` to `repositories/model-reader.ts` (same SAFE_FILE_ID check and notFound semantics, `access()` instead of `readFile`) and T8 uses it; `readModel` is unchanged in behavior (shared `storagePath` helper only).
- ASSUMPTION: cancelling *before* the file is resolved is not a pure no-op as the task text says: the request is marked cancelled and never enqueued, and its promise resolves `{ cancelled: true }`. Same observable result for T10, but it avoids burning a worker slot on an abandoned request.
- Race rule (AC-qs-8): cancel wins only if it lands before the Firestore write starts (checked synchronously right before `writeDraftOrder`); once the write has started the quote is reported as success even if cancel arrives, since the draft already exists. Error outcomes that were already decided are not overridden by a late cancel.
- Operational failures (read EACCES, Firestore write, slicer crash) reject the promise; T10 should map a rejection to a generic non-`quote.*` error. `cleanup()` runs in a `finally` for every result that reached a `SliceResult`.
- `breakdown` is `{ timeCost, materialCost, margin }` and `price` is `totalPrice`; the same object is written to Firestore and returned.
