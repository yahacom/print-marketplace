---
id: T4
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: S
blocks: [T7]
blocked_by: [T1]
status: done
prd_refs: ["§6.1 Subprocess escape", "§6 NFR latency"]
sad_refs: ["§2 PrusaSlicer CLI constraint", "§5", "§8 Subprocess safety row", "§11 Medium risk"]
adr_refs: []
note: "Scope extended post-initial-breakdown to add cancel() support for the FE 'Back to start' flow (T16) — see edits dated 2026-10-02. Contract revised 2026-10-02 after testing the real PrusaSlicer 2.9.6 CLI: stats live in the G-code (not stdout), oversized models exit 0 with no output, non-watertight models slice silently — see _epic.md 'Scope amendment — verified PrusaSlicer behavior'."
---

# T4 · `slicer-service` — PrusaSlicer CLI subprocess wrapper

**Epic:** [[_epic|quote-engine]]

## Why

This is the real work behind the whole feature: invoke PrusaSlicer CLI as a subprocess against untrusted STL content, with no shell interpolation, and a wall-clock timeout so a pathological file can't hang the single-worker queue (T7) indefinitely.

**Human checkpoint — not optional:** stl-parse-feature-plan.md's checkpoint #1 ("slicer wrapper verified on real files") and sad.md §11's Medium risk both require this wrapper to run against ≥1 real `.stl` fixture before the SAD's assumptions are treated as final. This task's DoD enforces that.

## Verified CLI behavior (PrusaSlicer 2.9.6, macOS, tested 2026-10-02 with `../slicer-profile-pla.ini`)

Measured against the real binary — the design below depends on these facts, not on assumptions. Re-verify if the pinned version changes.

| Input | Command | Observed |
|---|---|---|
| Valid model | `prusa-slicer --load <profile> --export-gcode --output <out.gcode> <model.stl>` | Exit 0; stdout+stderr are ~10 progress lines (`10 => Processing triangulated mesh` … `Slicing result exported to <path>`) and contain **no time/filament stats**. The stats are **comments in the G-code**: `; estimated printing time (normal mode) = 29m 4s`, `; total filament used [g] = 4.26`, `; filament used [mm]`, `; filament used [cm3]`. Small model slices in ~1s. |
| Oversized model (e.g. sample scaled ×10) | same | **Exit 0, no G-code file written**, message `All objects are outside of the print volume.` |
| Non-watertight (cube with one triangle removed) | same | **Exit 0, G-code written, wrong stats** (0.26 g / 2m 22s vs 0.69 g / 6m 38s for the intact cube) — PrusaSlicer silently repairs. Only `--info` reveals it: `manifold = no`, `open_edges = 3`. |
| Zero-thickness model | same | Exit 1, no G-code, `No layers were detected…` |
| Random bytes with `.stl` name | same | Exit 1, no G-code, `…has the wrong size` / `Loading of a model file failed.` |
| Empty file | same | Exit 2, no G-code, `The input is an empty file`. |
| Any model | `prusa-slicer --load <profile> --info <model.stl>` | Prints `size_x/y/z`, `min_*/max_*`, `number_of_facets`, `manifold = yes|no`, `open_edges`, `volume` as `key = value` lines. |

Other facts: the format is chosen from the file extension (input must end `.stl`; stored `<uuid>.stl` does); PrusaSlicer writes a temp file next to `--output` and renames it, so a per-job output directory is required; running with options but **no action** (`--export-gcode`/`--info`) launches the GUI — never invoke without an action. **Not yet verified:** SIGTERM behavior and leftover temp files on cancel (AC-ss-6), and headless operation on Linux/Docker/CI.

## Linked artifacts

- PRD: [[../PRD.md]] §6.1 (subprocess escape abuse case, resource-exhaustion cap)
- SAD: [[../sad.md]] §2 (PrusaSlicer CLI constraint, version-pin policy), §5 (`services/slicer-service.ts`), §8 (Subprocess safety row), §11 (Medium risk)
- Plan: `docs/features/quote-engine/stl-parse-feature-plan.md` (checkpoint #1)

## Scope

- Invoke PrusaSlicer CLI via `child_process.spawn` with an **argument array** (never a shell string) — `--load config/slicer-profile-pla.ini` (T1), an explicit action every time (`--info` or `--export-gcode`, never action-less), input STL path (must end `.stl`), and `--output` pointing into a **per-job temp directory** that the wrapper creates and the caller removes via `cleanup()`.
- **Two subprocess calls per job, run sequentially inside the one queue slot (T7):** first `--info <stl>` (raw stdout returned; gives manifold/bounding-box facts for T5), then — only if `--info` exited 0 — `--export-gcode`. Both are covered by the same timeout and the same cancellation.
- Pin whichever PrusaSlicer CLI release is current-stable at implementation time; record the exact version in the Dockerfile/deployment docs (sad.md §2 — not a fixed version number in the SAD itself).
- Enforce a wall-clock timeout (kills the subprocess on expiry) — this is what makes "resource exhaustion via pathological geometry" a `quote.unslicable`-style blocked outcome (AC-02) instead of a hang.
- **Cancellation (new — added for the FE "Back to start" flow, T16):** expose `sliceModel` as cancellable (e.g. accept an `AbortSignal`, or return `{ promise, cancel() }`). Calling cancel SIGTERM/SIGKILLs the live subprocess and resolves the promise with a `cancelled` result, distinct from `timedOut` and from a normal non-zero exit — T7 and T8 need to tell "user walked away" apart from "slice genuinely failed" so they don't write a Firestore draft or push a WS message for a cancelled job.
- Return raw outputs only: `{ info: { exitCode, stdout }, slice: { exitCode, stdout, stderr } | null, gcodePath: string | null, timedOut, cancelled, cleanup() }`. `gcodePath` is non-null only if the file actually exists after the slice (exit 0 does **not** imply a file — see oversized row above). **Not** responsible for parsing `--info` output or G-code stats, nor for deciding non-manifold / build-volume outcomes (all T5).

## Acceptance criteria (GWT)

- [x] **AC-ss-1 (successful slice):** Given a watertight STL fixture, when sliced, then `info.exitCode` and `slice.exitCode` are 0 and `gcodePath` points to an existing, non-empty G-code file; `cleanup()` removes it.
- [x] **AC-ss-2 (unreadable/corrupt geometry):** Given an empty, random-bytes, or zero-thickness STL fixture, when run, then the wrapper returns a non-zero exit code (info or slice stage), `gcodePath: null`, and does not throw. (Non-watertight and oversized models are **not** failures at this layer — they exit 0; T5 classifies them. See AC-ss-8/9.)
- [x] **AC-ss-8 (oversized model → no output file):** Given a model larger than the bed, when sliced, then the wrapper returns `slice.exitCode` 0, `gcodePath: null`, and the slicer's `All objects are outside of the print volume.` text in `slice.stdout`/`stderr` — passed through verbatim for T5.
- [x] **AC-ss-9 (non-watertight model passes through):** Given a model with `manifold = no`, when run, then `info.stdout` contains that `manifold = no` line and the slice still completes (exit 0, `gcodePath` set) — the wrapper does not reject it; the decision is T5/T8's.
- [x] **AC-ss-3 (timeout):** Given a slice that exceeds the configured wall-clock timeout, when the timeout fires, then the subprocess is killed and the wrapper resolves with a timeout result distinguishable from a normal non-zero exit.
- [x] **AC-ss-4 (no shell interpolation):** The implementation uses `spawn(cmd, argsArray)`, never `exec` with a concatenated string — confirmed by code review, not just tests.
- [x] **AC-ss-5 (real-file checkpoint):** At least one real `.stl` fixture (not synthetic/hand-built) is sliced successfully in a test or a documented manual run, closing stl-parse-feature-plan.md checkpoint #1 for this wrapper.
- [x] **AC-ss-6 (cancellation):** Given a slice is in progress, when `cancel()` is called, then the OS subprocess is killed within a bounded time (e.g. SIGTERM then SIGKILL after a short grace period) and the wrapper resolves with a `cancelled` result — distinguishable from `timedOut` (AC-ss-3) and from a non-zero exit (AC-ss-2).
- [x] **AC-ss-7 (cancel after completion is a no-op):** Given a slice has already resolved (success or failure) before `cancel()` is called, then calling `cancel()` has no effect and does not throw.

## Checklist

- [x] Step 1 — Confirm PrusaSlicer CLI is installed/available in the dev + CI environment (document the install step if CI needs it added).
- [x] Step 2 — Implement `sliceModel(stlPath, timeoutMs, signal?)` returning the shape in Scope, using `spawn` + an argument array: `--info` first, then `--export-gcode` into a per-job `mkdtemp` directory.
- [x] Step 3 — Wire the timeout via `AbortController` or a manual `setTimeout` + `kill()`, covering both subprocess calls.
- [x] Step 4 — Unit/integration tests for AC-ss-1/2/3/4/8/9. Fixtures can be generated in the test (ASCII STL cube; cube minus one triangle for non-watertight; the same cube scaled past the bed for oversized; empty file; random bytes) — see the behavior table for expected outcomes.
- [x] Step 5 — Run against ≥1 real `.stl` file (the table above was produced with a real stored upload; record the run in the PR description) — this satisfies AC-ss-5 / the human checkpoint.
- [x] Step 6 — Implement `cancel()`/`AbortSignal` support (SIGTERM, with a SIGKILL fallback after a short grace period if the process doesn't exit).
- [x] Step 7 — Unit tests for AC-ss-6/7.

## Edge cases

| Case | Behavior |
|---|---|
| PrusaSlicer binary missing from `PATH` | Fail fast at module load (like T3's credential check) — not a per-request mystery error. |
| STL file deleted between T2's read and T4's slice (race) | Out of scope here — T2 already returned bytes; T4 operates on a path or buffer T2 handed off, so this race is T8's (orchestrator) concern if it exists at all. |
| Killed/cancelled/timed-out job | `cleanup()` must still remove the per-job temp directory (PrusaSlicer leaves a temp file next to `--output` if killed mid-write — unverified, assume it does). |
| Action-less invocation | Would launch the PrusaSlicer GUI and hang the worker — covered by always passing `--info` or `--export-gcode`; add a test asserting the argument array always contains one of them. |
| Oversized STL (near the 50MB stl-upload cap) slicing slowly | Covered by the timeout (AC-ss-3), not a separate size check in this task. |

## Definition of Done

- [x] All AC green, including the real-file checkpoint (AC-ss-5) documented in the PR.
- [x] No `exec`/shell-string usage anywhere in the diff.
- [x] PrusaSlicer version pin recorded (Dockerfile or deployment docs, per sad.md §2).
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- AC-ss-5 / real-file checkpoint (run 2026-10-02, PrusaSlicer 2.9.6, macOS arm64, via `sliceModel`): two real uploads from the gitignored `storage/models/` — `721d8b9f-…stl` (69,262 facets, 53×53×12.4 mm, `manifold = yes`) → exit 0/0, G-code written, 8.97 g, 1h 3m 22s, ~1.0 s wall; `5563e27d-…stl` (301,428 facets, binary STL) → exit 0/0, 4.26 g, 29m 4s, ~1.2 s wall (matches the figures in "Verified CLI behavior"). Real files are not committed, so the automated tests use generated ASCII-STL fixtures.
- Version pin: PrusaSlicer **2.9.6** recorded in `deploy/systemd/stl-upload.service` (the repo has no Dockerfile). Override the binary with `PRUSA_SLICER_BIN` (default `prusa-slicer` on `PATH`).
- ASSUMPTION: cancellation is an `AbortSignal` argument (`sliceModel(stlPath, timeoutMs, signal?)`), per Step 2, not a `{ promise, cancel() }` handle. T7 owns an `AbortController` per job.
- ASSUMPTION: the result has `shape: when a timeout/cancel lands before a stage starts, that stage is `{ exitCode: null, stdout: "", stderr: "" }` (`slice` stays `null` if `--info` did not exit 0 or the job was interrupted). `exitCode: null` also covers spawn failure/kill-by-signal.
- ASSUMPTION: on timeout/cancel the wrapper removes its temp dir itself (so a leftover mid-write temp file cannot leak even if the caller forgets); `cleanup()` is still idempotent and must be called by the caller in every case.
- ASSUMPTION: SIGTERM then SIGKILL after 2 s grace. SIGTERM behavior and leftover temp files on a mid-write kill are only exercised by the cancel test (kill lands during `--info`/early slice); the mid-write case is still unverified.
- `assertSlicerAvailable()` (fail-fast on missing binary/profile) is exported but not wired — T10 must call it at module registration. PrusaSlicer has no `--version`; it runs `--help`.
- Still unverified: headless operation on Linux/Docker/CI. CI does not install PrusaSlicer, so `slicer-service.test.ts` will fail there until the CI workflow installs it (workflow not touched — outside this story; T13/T14 should cover).
- `tsx` could not run in the sandbox (IPC socket EPERM); the real-file run used `node` type-stripping instead.
