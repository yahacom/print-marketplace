---
id: T13
epic: quote-engine
project: print-marketplace
wave: 5
priority: Must
estimate: M
blocks: [T15]
blocked_by: [T10]
status: todo
prd_refs: [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06]
sad_refs: ["§10 QG-3"]
adr_refs: []
---

# T13 · Integration tests per AC (fixture STLs)

**Epic:** [[_epic|quote-engine]]

## Why

sad.md §10 QG-3's verify method is explicit: "integration tests per AC with fixture files (non-watertight STL, oversized STL, missing file-id, foreign file-id) — assert the correct error code is pushed and no WS connection is left open past the request." Each task so far tested its own layer in isolation with mocks; this task is the end-to-end seam across all of them, backend-only (T12's UI tests are separate).

## Linked artifacts

- PRD: [[../PRD.md]] §5 (all six AC)
- SAD: [[../sad.md]] §10 QG-3 (exact fixture list + verify method)
- Parity ref: `src/modules/stl-upload/stl-upload.integration.test.ts` (existing integration-test pattern in this repo)

## Scope

Build or source the fixture STL files sad.md §10 names and run each through the real `buildApp()` + a real WS client end-to-end, asserting exact AC outcomes:

1. Non-watertight STL → `quote.unslicable` (AC-02). Fixture: a valid ASCII-STL cube with **one triangle removed** (`manifold = no`, `open_edges = 3`). Real PrusaSlicer slices it with exit 0 and wrong stats, so this scenario proves the `--info` manifold check works end-to-end, not just that the slicer fails. Also cover one corrupt-file case (random bytes or empty file → non-zero exit → `quote.unslicable`).
2. Oversized STL (exceeds fixed build volume) → `quote.exceeds_build_volume` (AC-04). Fixture: a valid watertight cube larger than the profile's bed (e.g. 300 mm on a side vs the 250×210×220 bed). Real PrusaSlicer exits 0 and writes no G-code for this — the scenario proves the classification doesn't rely on exit code.
3. Missing file-id (never uploaded) → `quote.not_found` (AC-05).
4. Foreign file-id (valid format, but no matching stored file — simulating "not owned") → `quote.not_found`, byte-identical to case 3 (AC-06).
5. Valid, printable fixture → full success payload with breakdown (AC-01, AC-03).

## Acceptance criteria (GWT)

- [ ] **AC-it-1..5:** Each of the five scenarios above resolves with the exact expected outcome against a real running app instance (not mocks at the service boundary — this is the point of an integration test).
- [ ] **AC-it-6 (no dangling connections):** For every scenario, the WS connection is closed by the server after its one message — asserted via the client observing a close event, not just receiving the expected message.

## Checklist

- [ ] Step 1 — Source/author the fixture STL files (non-watertight, oversized, valid-small) — check the repo for existing STL fixtures from `stl-upload`'s tests first, reuse where the shape fits, author only what's missing. Generate the cube fixtures programmatically (ASCII STL, 12 triangles; drop one for non-watertight; scale vertices for oversized) rather than committing binaries; the valid-small case can be the intact cube. The expected PrusaSlicer behavior for each is tabulated in T4's "Verified CLI behavior".
- [ ] Step 2 — Write the 5 integration-test scenarios against `buildApp()` with a real `STORAGE_DIR` and a real (or test-pinned) PrusaSlicer invocation.
- [ ] Step 3 — Assert AC-it-6 for every scenario.

## Edge cases

| Case | Behavior |
|---|---|
| CI environment lacking PrusaSlicer CLI | This test suite requires PrusaSlicer installed in CI — if not already true from T4's checklist, this task's DoD includes confirming CI has it (coordinate with T4; don't duplicate the install step, just verify it's there). |
| Slow slice in CI | A small cube slices in about 1s locally (measured); keep fixtures small so this suite stays fast. |

## Definition of Done

- [ ] All 5 scenarios + AC-it-6 green in CI, not just locally.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
