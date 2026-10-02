---
type: tracker
feature: quote-engine
iteration: 1
updated_at: 2026-10-02
---

# Tracker — quote-engine

Flat status for impl-agent polling. Pick the lowest-ID task in wave order with `status: todo` and `blocked_by` clear of any non-`done` task.

| Task | Wave | Status | Blocked by | Estimate | Owner |
|---|---|---|---|---|---|
| [[T1-module-scaffold\|T1]] | 1 | done | — | XS | Yakiv Vakoliuk |
| [[T2-model-reader-repository\|T2]] | 2 | done | T1 | S | Yakiv Vakoliuk |
| [[T3-firestore-quote-repository\|T3]] | 2 | done | T1 | S | Yakiv Vakoliuk |
| [[T4-slicer-service-subprocess\|T4]] | 2 | done | T1 | S | Yakiv Vakoliuk |
| [[T5-gcode-parser\|T5]] | 2 | done | T1 | S | Yakiv Vakoliuk |
| [[T6-pricing-service\|T6]] | 2 | done | T1 | XS | Yakiv Vakoliuk |
| [[T9-rate-limit\|T9]] | 2 | done | T1 | XS | Yakiv Vakoliuk |
| [[T7-slicer-queue\|T7]] | 3 | done | T4 | S | Yakiv Vakoliuk |
| [[T8-quote-service-orchestrator\|T8]] | 3 | todo | T2, T3, T5, T6, T7 | M | Yakiv Vakoliuk |
| [[T10-quote-routes-websocket\|T10]] | 4 | todo | T8, T9 | M | Yakiv Vakoliuk |
| [[T11-metrics\|T11]] | 4 | todo | T7, T8 | S | Yakiv Vakoliuk |
| [[T12-ui-websocket-quote-client\|T12]] | 5 | todo | T10 | M | Yakiv Vakoliuk |
| [[T13-integration-tests-per-ac\|T13]] | 5 | todo | T10 | M | Yakiv Vakoliuk |
| [[T14-k6-load-test\|T14]] | 5 | todo | T10, T11 | S | Yakiv Vakoliuk |
| [[T16-ui-slicing-wait-state-and-cancel\|T16]] | 5 | todo | T10, T12 | S | Yakiv Vakoliuk |
| [[T15-changelog-kb-note\|T15]] | 5 | todo | T12, T13, T14, T16 | XS | Yakiv Vakoliuk |

## Status legend

- `todo` — ready to claim once `blocked_by` clears.
- `wip` — claimed; do not pick.
- `done` — merged. Unblocks anything listing this task in `blocked_by`.
- `blocked` — issue reported; see task file footer for note.

## Progress

- Total: 8/16 done
- Wave 1: 1/1 (T1)
- Wave 2: 6/6 (T2, T3, T4, T5, T6, T9)
- Wave 3: 1/2 (T7, T8)
- Wave 4: 0/2 (T10, T11)
- Wave 5: 0/5 (T12, T13, T14, T15, T16)

## Next runnable

**T1** only — everything else blocks on the module scaffold existing.

After T1 merges, Wave 2 fans out to 6 parallel tasks (T2, T3, T4, T5, T6, T9) — no cross-dependencies among them.

## Notes

- **Human checkpoint (sad.md §11, Medium risk):** T4's DoD requires running the PrusaSlicer wrapper against ≥1 real `.stl` fixture before merge — this is stl-parse-feature-plan.md's unresolved checkpoint #1, now tracked at task level instead of left open.
- **order-confirmation rework** (sad.md §11, High risk, ADR-0002 override) is explicitly **not** a task in this tracker — it is a separate epic/architecture pass owned by Yakiv Vakoliuk, gating order-confirmation's own implementation, not this one.
- T12 and T16 (UI) are derived from ADR-0001's consequence + AC-01/03/04, not from an SAD §5 building block — see `_epic.md` scope note.
- **Amended 2026-10-02 (verified PrusaSlicer behavior):** T1/T4/T5/T8/T11/T13 revised after testing the real CLI — stats are in the G-code, oversized models exit 0 with no output, non-watertight models are rejected via `--info`. See `_epic.md`'s "Scope amendment 2026-10-02 — verified PrusaSlicer behavior" and T4's "Verified CLI behavior". T4's real-file checkpoint (AC-ss-5) still has to be recorded when T4 is implemented.
- **Added 2026-10-02:** T16 (FE slicing wait-state + cancel) plus cancellation amendments to T4/T7/T8/T10 — see `_epic.md`'s "Scope addition 2026-10-02" note. The server-side hard-kill-on-close behavior was an explicit user decision (not a SAD/ADR-sourced requirement), confirmed via AskUserQuestion before implementation.
