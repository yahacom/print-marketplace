---
id: T5
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: S
blocks: [T8]
blocked_by: [T1]
status: todo
prd_refs: [AC-04]
sad_refs: ["§5", "§6 flow 2"]
adr_refs: []
---

# T5 · `gcode-parser` — stdout/G-code → `{time_minutes, filament_grams}`

**Epic:** [[_epic|quote-engine]]

## Why

PrusaSlicer's stdout/G-code carries the real print-time and filament-usage stats this feature's entire value proposition depends on (PRD §1 — "a real slice, not a weight-based guess"). This task also owns detecting build-volume exceedance (AC-04), since that's a property of the sliced stats, not of the subprocess's exit code (a model can slice successfully yet still be too big for the fixed printer).

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-04
- SAD: [[../sad.md]] §5 (`services/gcode-parser.ts`), §6 flow 2 (build-volume-exceeded branch)

## Scope

- Parse PrusaSlicer's stdout (or the G-code header comments it emits, depending on which the CLI actually produces — confirm against T4's real-file output) into `{ timeMinutes: number, filamentGrams: number }`.
- Compare the sliced model's bounding box / stats against the fixed printer configuration's build volume; return a distinct `exceedsBuildVolume: true` result when over.
- **Explicitly out of scope:** invoking the subprocess (T4) or pricing math (T6) — pure parsing + one domain check.

## Acceptance criteria (GWT)

- [ ] **AC-gp-1 (happy path):** Given real PrusaSlicer stdout from a successful slice (from T4's AC-ss-5 fixture), when parsed, then `timeMinutes` and `filamentGrams` are extracted as positive numbers.
- [ ] **AC-gp-2 (build volume exceeded, AC-04):** Given stats indicating the model exceeds the fixed printer's build volume, when parsed, then the result is `{ exceedsBuildVolume: true }` distinct from a normal stats result.
- [ ] **AC-gp-3 (malformed/unexpected stdout):** Given stdout that doesn't match the expected PrusaSlicer output shape (version drift, unexpected flags), when parsed, then a typed parse-error result is returned, not an uncaught exception or silently wrong numbers.

## Checklist

- [ ] Step 1 — Capture real stdout from T4's AC-ss-5 real-file run; use it as the canonical fixture for this parser (do not hand-write a fixture that might not match real output).
- [ ] Step 2 — Implement the stdout parser (regex or line-scan, whichever the real PrusaSlicer output format calls for).
- [ ] Step 3 — Implement the build-volume comparison against the fixed printer config's dimensions.
- [ ] Step 4 — Unit tests for AC-gp-1/2/3.

## Edge cases

| Case | Behavior |
|---|---|
| PrusaSlicer version bump changes stdout format (sad.md §2 version-pin policy — pin is "current-stable at implementation time," so a later bump is expected eventually) | AC-gp-3's typed parse-error is the safety net; a future task re-pins and updates this parser, not silently misreads stats. |
| Filament grams reported as 0 (edge-case geometry) | Treat as a valid stat, not an error — zero-mass models are a pricing-formula concern (T6), not a parser concern. |

## Definition of Done

- [ ] All AC green, using a real-stdout fixture (not synthetic) for the happy path.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
