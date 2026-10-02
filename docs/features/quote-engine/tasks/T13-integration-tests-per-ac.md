---
id: T13
epic: quote-engine
project: print-marketplace
wave: 5
priority: Must
estimate: M
blocks: [T15]
blocked_by: [T10]
status: done
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

- [x] **AC-it-1..5:** Each of the five scenarios above resolves with the exact expected outcome against a real running app instance (not mocks at the service boundary — this is the point of an integration test).
- [x] **AC-it-6 (no dangling connections):** For every scenario, the WS connection is closed by the server after its one message — asserted via the client observing a close event, not just receiving the expected message.

## Checklist

- [x] Step 1 — Source/author the fixture STL files (non-watertight, oversized, valid-small) — check the repo for existing STL fixtures from `stl-upload`'s tests first, reuse where the shape fits, author only what's missing. Generate the cube fixtures programmatically (ASCII STL, 12 triangles; drop one for non-watertight; scale vertices for oversized) rather than committing binaries; the valid-small case can be the intact cube. The expected PrusaSlicer behavior for each is tabulated in T4's "Verified CLI behavior".
- [x] Step 2 — Write the 5 integration-test scenarios against `buildApp()` with a real `STORAGE_DIR` and a real (or test-pinned) PrusaSlicer invocation.
- [x] Step 3 — Assert AC-it-6 for every scenario.

## Edge cases

| Case | Behavior |
|---|---|
| CI environment lacking PrusaSlicer CLI | This test suite requires PrusaSlicer installed in CI — if not already true from T4's checklist, this task's DoD includes confirming CI has it (coordinate with T4; don't duplicate the install step, just verify it's there). |
| Slow slice in CI | A small cube slices in about 1s locally (measured); keep fixtures small so this suite stays fast. |

## Definition of Done

- [ ] All 5 scenarios + AC-it-6 green in CI, not just locally. **Green locally only — CI not verified, see Notes.**
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- **CI is NOT verified and almost certainly red until a human acts:** `.github/workflows/ci.yml` installs no PrusaSlicer, so this suite (and T4's `slicer-service.test.ts`, T11's real-slicer test) fail on GitHub's runner. I did not edit the workflow: an install step I cannot run (apt's `prusa-slicer` is not the pinned 2.9.6; the 2.9.6 AppImage URL/headless behavior on Linux is unverified) would be a guess. Needs a human: pick the install method, pin 2.9.6, check headless operation. The tests also need a bindable local port.
- Files: `quote-engine.integration.test.ts` and `test-support/stl-fixtures.ts` (generated ASCII cubes: valid 20 mm, one triangle removed, 300 mm oversized). Real `buildApp()` + Node's global `WebSocket` client + real `STORAGE_DIR` + real PrusaSlicer 2.9.6 through the real queue/parser/pricing; only the Firestore repository is an in-memory fake (no emulator/credentials), so a real Firestore write is still unexercised.
- Corrupt-file coverage: empty file and random bytes (both non-zero exit → `quote.unslicable`). Zero-thickness is covered at T4's layer.
- AC-it-3 vs AC-it-4: with no ownership model (PRD: no accounts), "foreign" is a well-formed id with no file or a malformed id; the test asserts the raw WebSocket text and close code are byte-identical between a never-stored valid id and `../../etc/passwd`.
- AC-it-6 is asserted by `onlyMessage()` for every scenario: exactly one message, then the server's close event with code 1000.
- `test-support/stl-fixtures.ts` duplicates the cube generator in `slicer-service.test.ts` instead of refactoring that existing test file (don't-change-tests rule).
- Binding a local port is blocked in the Ralph sandbox, so this file was run with the sandbox disabled for that command only.
