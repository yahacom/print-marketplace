---
id: T14
epic: quote-engine
project: print-marketplace
wave: 5
priority: Must
estimate: S
blocks: [T15]
blocked_by: [T10, T11]
status: todo
prd_refs: ["§6 NFR latency", "§6 NFR throughput"]
sad_refs: ["§10 QG-2", "§7 Alerts"]
adr_refs: []
---

# T14 · k6 load test — p95 ≤60s, queue-depth alert threshold

**Epic:** [[_epic|quote-engine]]

## Why

sad.md §10 QG-2's verify method names a k6 load test "matching the existing CI smoke-test pattern," asserting the p95 bucket against the 60s NFR target. CI already runs a k6 smoke test against `stl-upload` (CLAUDE.md "Commands" section); this extends that same pattern to quote-engine rather than inventing new load-test tooling.

## Linked artifacts

- PRD: [[../PRD.md]] §6 NFR (latency p95 ≤60s, throughput ≥1 concurrent/instance)
- SAD: [[../sad.md]] §10 QG-2, §7 (alert threshold: queue depth >5 for >2min)
- CI: `.github/workflows/ci.yml` (existing k6 smoke-test job — extend, don't fork)

## Scope

- Add a k6 scenario exercising quote-engine's WS endpoint with concurrent quote requests, asserting `quote_slice_duration_seconds`'s p95 stays ≤60s under the test's load profile.
- Confirm queue-depth behavior under load matches the "additional requests queue rather than fail" NFR (no requests dropped, all eventually resolve).
- **Not in scope:** real production alerting wiring (Prometheus alert rules) — this task proves the metric and threshold are measurable, not that an alert fires in prod.

## Acceptance criteria (GWT)

- [ ] **AC-k6-1 (p95 target):** Given the k6 scenario's load profile, when run, then `quote_slice_duration_seconds` p95 (scraped via `/metrics` or the k6 run's own timing) is ≤60s.
- [ ] **AC-k6-2 (no dropped requests):** Given N concurrent quote requests exceeding T7's single-worker capacity, when run, then all N eventually resolve (success or a legitimate `quote.*` error) — none time out unaccounted-for or silently vanish.
- [ ] **AC-k6-3 (CI-integrated):** The scenario runs as part of the existing CI k6 job, not a separate manual script.

## Checklist

- [ ] Step 1 — Extend the existing k6 script/job to include a quote-engine WS scenario (reuse the valid-small STL fixture from T13).
- [ ] Step 2 — Assert p95 threshold (AC-k6-1) and completion count (AC-k6-2).
- [ ] Step 3 — Wire into `.github/workflows/ci.yml`'s existing k6 step.

## Edge cases

| Case | Behavior |
|---|---|
| CI runner's CPU is slower than production, risking a false p95 failure | If this bites, document the chosen load profile's conservatism in the PR rather than silently loosening the threshold below 60s — flag to the human if CI noise becomes a real problem, don't just raise the number quietly. |

## Definition of Done

- [ ] All AC green in CI.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
