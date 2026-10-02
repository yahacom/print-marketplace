---
id: T4
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: S
blocks: [T7]
blocked_by: [T1]
status: todo
prd_refs: ["§6.1 Subprocess escape", "§6 NFR latency"]
sad_refs: ["§2 PrusaSlicer CLI constraint", "§5", "§8 Subprocess safety row", "§11 Medium risk"]
adr_refs: []
note: "Scope extended post-initial-breakdown to add cancel() support for the FE 'Back to start' flow (T16) — see edits dated 2026-10-02."
---

# T4 · `slicer-service` — PrusaSlicer CLI subprocess wrapper

**Epic:** [[_epic|quote-engine]]

## Why

This is the real work behind the whole feature: invoke PrusaSlicer CLI as a subprocess against untrusted STL content, with no shell interpolation, and a wall-clock timeout so a pathological file can't hang the single-worker queue (T7) indefinitely.

**Human checkpoint — not optional:** stl-parse-feature-plan.md's checkpoint #1 ("slicer wrapper verified on real files") and sad.md §11's Medium risk both require this wrapper to run against ≥1 real `.stl` fixture before the SAD's assumptions are treated as final. This task's DoD enforces that.

## Linked artifacts

- PRD: [[../PRD.md]] §6.1 (subprocess escape abuse case, resource-exhaustion cap)
- SAD: [[../sad.md]] §2 (PrusaSlicer CLI constraint, version-pin policy), §5 (`services/slicer-service.ts`), §8 (Subprocess safety row), §11 (Medium risk)
- Plan: `docs/features/quote-engine/stl-parse-feature-plan.md` (checkpoint #1)

## Scope

- Invoke PrusaSlicer CLI via `child_process.spawn` with an **argument array** (never a shell string) — fixed printer+material profile path, input STL path, output path.
- Pin whichever PrusaSlicer CLI release is current-stable at implementation time; record the exact version in the Dockerfile/deployment docs (sad.md §2 — not a fixed version number in the SAD itself).
- Enforce a wall-clock timeout (kills the subprocess on expiry) — this is what makes "resource exhaustion via pathological geometry" a `quote.unslicable`-style blocked outcome (AC-02) instead of a hang.
- **Cancellation (new — added for the FE "Back to start" flow, T16):** expose `sliceModel` as cancellable (e.g. accept an `AbortSignal`, or return `{ promise, cancel() }`). Calling cancel SIGTERM/SIGKILLs the live subprocess and resolves the promise with a `cancelled` result, distinct from `timedOut` and from a normal non-zero exit — T7 and T8 need to tell "user walked away" apart from "slice genuinely failed" so they don't write a Firestore draft or push a WS message for a cancelled job.
- Return raw stdout + exit code to the caller; **not** responsible for parsing stats (that's T5) or deciding build-volume exceedance (also T5, from the parsed stats).

## Acceptance criteria (GWT)

- [ ] **AC-ss-1 (successful slice):** Given a watertight STL fixture, when sliced, then the wrapper returns exit code 0 and non-empty stdout/G-code output.
- [ ] **AC-ss-2 (unslicable geometry):** Given a non-watertight/corrupt STL fixture, when sliced, then the wrapper returns a non-zero exit code without throwing an uncaught exception.
- [ ] **AC-ss-3 (timeout):** Given a slice that exceeds the configured wall-clock timeout, when the timeout fires, then the subprocess is killed and the wrapper resolves with a timeout result distinguishable from a normal non-zero exit.
- [ ] **AC-ss-4 (no shell interpolation):** The implementation uses `spawn(cmd, argsArray)`, never `exec` with a concatenated string — confirmed by code review, not just tests.
- [ ] **AC-ss-5 (real-file checkpoint):** At least one real `.stl` fixture (not synthetic/hand-built) is sliced successfully in a test or a documented manual run, closing stl-parse-feature-plan.md checkpoint #1 for this wrapper.
- [ ] **AC-ss-6 (cancellation):** Given a slice is in progress, when `cancel()` is called, then the OS subprocess is killed within a bounded time (e.g. SIGTERM then SIGKILL after a short grace period) and the wrapper resolves with a `cancelled` result — distinguishable from `timedOut` (AC-ss-3) and from a non-zero exit (AC-ss-2).
- [ ] **AC-ss-7 (cancel after completion is a no-op):** Given a slice has already resolved (success or failure) before `cancel()` is called, then calling `cancel()` has no effect and does not throw.

## Checklist

- [ ] Step 1 — Confirm PrusaSlicer CLI is installed/available in the dev + CI environment (document the install step if CI needs it added).
- [ ] Step 2 — Implement `sliceModel(stlPath, outputPath, timeoutMs): Promise<{exitCode, stdout, timedOut}>` using `spawn` + an argument array.
- [ ] Step 3 — Wire the timeout via `AbortController` or a manual `setTimeout` + `kill()`.
- [ ] Step 4 — Unit tests with synthetic fixtures for AC-ss-1/2/3/4.
- [ ] Step 5 — Run against ≥1 real `.stl` file (download or author one) and record the result in the PR description — this satisfies AC-ss-5 / the human checkpoint.
- [ ] Step 6 — Implement `cancel()`/`AbortSignal` support (SIGTERM, with a SIGKILL fallback after a short grace period if the process doesn't exit).
- [ ] Step 7 — Unit tests for AC-ss-6/7.

## Edge cases

| Case | Behavior |
|---|---|
| PrusaSlicer binary missing from `PATH` | Fail fast at module load (like T3's credential check) — not a per-request mystery error. |
| STL file deleted between T2's read and T4's slice (race) | Out of scope here — T2 already returned bytes; T4 operates on a path or buffer T2 handed off, so this race is T8's (orchestrator) concern if it exists at all. |
| Oversized STL (near the 50MB stl-upload cap) slicing slowly | Covered by the timeout (AC-ss-3), not a separate size check in this task. |

## Definition of Done

- [ ] All AC green, including the real-file checkpoint (AC-ss-5) documented in the PR.
- [ ] No `exec`/shell-string usage anywhere in the diff.
- [ ] PrusaSlicer version pin recorded (Dockerfile or deployment docs, per sad.md §2).
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
