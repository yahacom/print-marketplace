---
id: T5
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: S
blocks: [T8]
blocked_by: [T1]
status: done
prd_refs: [AC-04]
sad_refs: ["§5", "§6 flow 2"]
adr_refs: []
note: "Contract revised 2026-10-02 after testing the real PrusaSlicer 2.9.6 CLI (see T4 'Verified CLI behavior' and _epic.md 'Scope amendment — verified PrusaSlicer behavior'): stats come from G-code comments not stdout; oversized = exit 0 with no output; non-watertight = silent success, detectable only via --info."
---

# T5 · `gcode-parser` — `--info` output + G-code comments → `{time_minutes, filament_grams}` or a classified failure

**Epic:** [[_epic|quote-engine]]

## Why

The real print-time and filament-usage stats this feature depends on (PRD §1 — "a real slice, not a weight-based guess") are **comments inside the G-code file**, not stdout (verified — see T4's "Verified CLI behavior"). This task also owns classifying the two cases PrusaSlicer does *not* signal with a non-zero exit: an oversized model (AC-04: exit 0, no G-code written) and a non-watertight model (AC-02: slices "successfully" but with silently-repaired, wrong stats — only `--info`'s `manifold = no` reveals it).

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-04
- SAD: [[../sad.md]] §5 (`services/gcode-parser.ts`), §6 flow 2 (build-volume-exceeded branch)

## Scope

- Take T4's raw result and return exactly one of: `{ kind: "stats", timeMinutes, filamentGrams }`, `{ kind: "non_manifold" }`, `{ kind: "exceeds_build_volume" }`, `{ kind: "parse_error", reason }`.
- **Stats:** read the G-code at `gcodePath` and parse the `; estimated printing time (normal mode) = …` line (formats like `29m 4s`, `1h 2m 3s`, `1d 2h 3m 4s`; **not** the `silent mode` line) and `; total filament used [g] = …`. A missing line → `parse_error`.
- **Non-manifold (AC-02):** parse `T4.info.stdout`; `manifold = no` → `non_manifold` (mapped to `quote.unslicable` by T8 — decided 2026-10-02: reject rather than quote a silently-repaired mesh).
- **Build volume (AC-04), two signals, either one suffices:** (a) `gcodePath` is null with exit 0 and the slicer text contains `outside of the print volume`; (b) the `--info` `size_x/y/z` exceeds the bed dimensions. Read the build volume from `config/slicer-profile-pla.ini` (`bed_shape` bounding box and `max_print_height`) — do not hard-code a second copy. Signal (b) lets the check fire without relying on message wording.
- **Explicitly out of scope:** invoking the subprocess (T4) or pricing math (T6) — parsing plus classification only.

## Acceptance criteria (GWT)

- [x] **AC-gp-1 (happy path):** Given the real G-code (and `--info` output) from a successful slice of a real model (T4's AC-ss-5 run), when parsed, then the result is `{ kind: "stats" }` with `timeMinutes` and `filamentGrams` as positive numbers matching the file's comment lines (e.g. `29m 4s` → 29.07 min, `4.26` g for the sample model).
- [x] **AC-gp-2 (build volume exceeded, AC-04):** Given (a) T4's oversized-model result (exit 0, `gcodePath: null`, `All objects are outside of the print volume.`) or (b) `--info` sizes larger than the profile's bed, when parsed, then the result is `{ kind: "exceeds_build_volume" }`, distinct from a stats result — each signal tested independently.
- [x] **AC-gp-3 (malformed/unexpected output):** Given G-code lacking the expected comment lines, or an unrecognized time format (version drift), when parsed, then `{ kind: "parse_error" }` is returned, not an uncaught exception or silently wrong numbers.
- [x] **AC-gp-4 (non-watertight, AC-02):** Given `--info` output with `manifold = no` (and a G-code that would otherwise parse fine), when parsed, then the result is `{ kind: "non_manifold" }` — never `stats`.

## Checklist

- [x] Step 1 — Capture real `--info` output and real G-code from T4's AC-ss-5 real-file run (and from the generated non-watertight fixture); use them as the canonical fixtures — for G-code, the trailing comment block with the stats lines is enough. Do not hand-write fixtures that might not match real output.
- [x] Step 2 — Implement the `--info` parser (`key = value` lines) and the G-code comment parser (regex or line-scan).
- [x] Step 3 — Implement the build-volume comparison, reading bed size and `max_print_height` from `config/slicer-profile-pla.ini`.
- [x] Step 4 — Unit tests for AC-gp-1/2/3/4.

## Edge cases

| Case | Behavior |
|---|---|
| PrusaSlicer version bump changes the G-code comment format or the `--info` / out-of-volume wording (sad.md §2 version-pin policy — pin is "current-stable at implementation time," so a later bump is expected eventually) | AC-gp-3's typed parse-error is the safety net; a future task re-pins and updates this parser, not silently misreads stats. The size-based build-volume signal (b) keeps AC-04 working even if the message wording changes. |
| Filament grams reported as 0 (edge-case geometry) | Treat as a valid stat, not an error — zero-mass models are a pricing-formula concern (T6), not a parser concern. |

## Definition of Done

- [x] All AC green, using a real-output fixture (real G-code and `--info` output, not synthetic) for the happy path.
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- API: `parseSliceOutput({ info, slice, gcodePath })` (a `Pick` of T4's `SliceResult`) is async because it reads the G-code file; it returns `ParsedSlice`. T8 decides what to do with non-zero exits / `timedOut` / `cancelled` *before* calling it; if `info` or `slice` is `null` it returns `parse_error`.
- Fixtures in `services/fixtures/` are real output of PrusaSlicer 2.9.6 via T4's `sliceModel`: `info-real.txt` and `gcode-real-stats.gcode` (the stats comment block only, verbatim) from a real stored upload (29m 4s / 4.26 g); `info-non-manifold.txt` and `info-oversized.txt` from generated cubes (open cube; 400 mm cube); `slice-oversized-stderr.txt` is the slicer's actual message (it goes to stderr, not stdout).
- ASSUMPTION: precedence is `exceeds_build_volume` → `non_manifold` → stats, so a model that is both is reported as too big.
- ASSUMPTION: a missing `manifold = ` line in `--info` is `parse_error` (version drift) rather than assumed-watertight, so a format change can't silently let a bad mesh through.
- ASSUMPTION: `timeMinutes` is unrounded (`29m 4s` → 29.0667); rounding is T6's/T8's call.
- Build volume comes from `config/slicer-profile-pla.ini` (250×210 bed, `max_print_height` 220), compared against `--info` `size_x/y/z` (size, not position). T4's profile path is now exported as `SLICER_PROFILE_PATH` so there is a single copy.
