---
id: T11
epic: quote-engine
project: print-marketplace
wave: 4
priority: Must
estimate: S
blocks: [T14]
blocked_by: [T7, T8]
status: done
prd_refs: []
sad_refs: ["§7 Monitoring"]
adr_refs: []
---

# T11 · Prometheus metrics (slice duration, queue depth, exit code)

**Epic:** [[_epic|quote-engine]]

## Why

sad.md §7 names three specific metrics this feature needs for observability of the exact failure modes this architecture accepts (single-instance queue ceiling, 60s latency target): without them, a queue backing up or slices drifting past p95 is invisible until a user complains.

## Linked artifacts

- SAD: [[../sad.md]] §7 (Monitoring — exact metric names, bucket shape, alert thresholds)
- Parity ref: `src/metrics.ts` (existing `http_request_duration_seconds` histogram pattern — mirror its hand-rolled Prometheus text-format approach, no new metrics library)

## Scope

Extend `src/metrics.ts` with:

- `quote_slice_duration_seconds` — histogram, buckets to 60s+Inf (mirrors existing bucket shape), observed from T8's orchestrator around the T7 queue call.
- `quote_slicer_queue_depth` — gauge, read from T7's `getQueueDepth()`.
- `quote_slicer_exit_code` — counter, labeled by exit code, observed from T4's wrapper result.

## Acceptance criteria (GWT)

- [x] **AC-mt-1 (slice duration recorded):** Given a quote request completes (success or failure), when metrics are rendered, then `quote_slice_duration_seconds` includes one observation for that request.
- [x] **AC-mt-2 (queue depth live):** Given N jobs pending in T7's queue, when metrics are rendered, then `quote_slicer_queue_depth` reflects N at that moment (not a stale snapshot).
- [x] **AC-mt-3 (exit code labeled):** Given a slice exits with code 0 and another with a non-zero code, when metrics are rendered, then `quote_slicer_exit_code` shows separate counter series per exit code label.

## Checklist

- [x] Step 1 — Add the three metric definitions to `src/metrics.ts`, following the existing histogram/gauge/counter rendering pattern.
- [x] Step 2 — Wire the observation calls into T8 (duration), T7 (queue depth), T4 (exit code) — minimal, single-line hooks, not a restructuring of those modules.
- [x] Step 3 — Unit tests for AC-mt-1..3, asserting the rendered Prometheus text output.

## Edge cases

| Case | Behavior |
|---|---|
| Metrics endpoint scraped mid-slice | Queue depth gauge must reflect the in-flight state at scrape time — this is why it's a gauge, not a counter. |
| Oversized or non-watertight models (verified PrusaSlicer behavior, see T4) | These exit 0, so `quote_slicer_exit_code{code="0"}` counts them as successes; the exit-code metric alone cannot show blocked-quote rates. Not a defect of this task — AC-mt-3 stays as written — but don't use this metric to infer quote success rate. |

## Definition of Done

- [x] All AC green.
- [x] No new metrics dependency added (hand-rolled, matching `src/metrics.ts`'s existing approach).
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- `src/metrics.ts` gains `createQuoteMetrics()` and a process-wide `quoteMetrics`; `registerMetrics` appends its output to `GET /metrics`. The existing HTTP histogram code is untouched. Hooks: T4 `quoteMetrics.countExitCode(...)` after each subprocess stage, T7 `setQueueDepthSource(defaultQueue.getQueueDepth)` once, T8 `observeSliceDuration(...)` around the queue call. Tests: `src/quote-metrics.test.ts`.
- ASSUMPTION: histogram buckets are 1, 2.5, 5, 10, 20, 30, 45, 60 s + `+Inf` (SAD says "to 60s+Inf, mirrors the existing shape"; existing buckets stop at 30 s, so finer buckets were added around the 60 s p95 target).
- ASSUMPTION: the duration is enqueue → slicer result (queue wait + `--info` + slice), matching "around the T7 queue call" and the PRD's turnaround target. Requests that never reach the queue (`quote.not_found`) and cancelled jobs are not observed, so "one observation per request" means per *sliced* request.
- ASSUMPTION: exit code `null` (killed by signal on timeout/cancel, or the binary failed to start) is labelled `code="none"`. Both stages (`--info` and `--export-gcode`) are counted, so one successful quote adds two `code="0"` samples.
- The exit-code counter cannot show blocked-quote rates (oversized / non-watertight models exit 0) — per the task's edge case, not inferred from it.
- Alert-threshold rules (queue depth > 5 for > 2 min) are not added; no Prometheus rules file exists for quote-engine and the task does not ask for one.
