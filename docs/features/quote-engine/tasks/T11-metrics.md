---
id: T11
epic: quote-engine
project: print-marketplace
wave: 4
priority: Must
estimate: S
blocks: [T14]
blocked_by: [T7, T8]
status: todo
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

- [ ] **AC-mt-1 (slice duration recorded):** Given a quote request completes (success or failure), when metrics are rendered, then `quote_slice_duration_seconds` includes one observation for that request.
- [ ] **AC-mt-2 (queue depth live):** Given N jobs pending in T7's queue, when metrics are rendered, then `quote_slicer_queue_depth` reflects N at that moment (not a stale snapshot).
- [ ] **AC-mt-3 (exit code labeled):** Given a slice exits with code 0 and another with a non-zero code, when metrics are rendered, then `quote_slicer_exit_code` shows separate counter series per exit code label.

## Checklist

- [ ] Step 1 — Add the three metric definitions to `src/metrics.ts`, following the existing histogram/gauge/counter rendering pattern.
- [ ] Step 2 — Wire the observation calls into T8 (duration), T7 (queue depth), T4 (exit code) — minimal, single-line hooks, not a restructuring of those modules.
- [ ] Step 3 — Unit tests for AC-mt-1..3, asserting the rendered Prometheus text output.

## Edge cases

| Case | Behavior |
|---|---|
| Metrics endpoint scraped mid-slice | Queue depth gauge must reflect the in-flight state at scrape time — this is why it's a gauge, not a counter. |

## Definition of Done

- [ ] All AC green.
- [ ] No new metrics dependency added (hand-rolled, matching `src/metrics.ts`'s existing approach).
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
