# Sequence coverage audit — stl-upload-ui — 2026-09-30

## Result

All 9 PRD user stories are accounted for. No new Mermaid blocks were added this run — no diagram was missing coverage.

## Coverage table

| US | Title | Status |
|----|-------|--------|
| US-01 | Upload a valid model and get confirmation | Covered (content match: "Critical flow 1" in §6) |
| US-02 | Clear reason for invalid STL | Covered (content match: "Critical flow 2" in §6) |
| US-03 | Clear reason for too-large file | Covered (content match: "Critical flow 2" in §6, alt branch) |
| US-04 | Clear reason when server unreachable | Covered (content match: "Critical flow 3" in §6) |
| US-05 | Reject multiple files/folder before contacting server | Trivial — user confirmed skip (client-only guard, no network hop) |
| US-06 | Filename rendered as plain text (no XSS) | Trivial — user confirmed skip (rendering constraint, not a flow) |
| US-07 | Only see own submission's result | Trivial — user confirmed skip (already documented as crosscutting concept, SAD §8) |
| US-08 | Accepted model ready for quote automatically | Covered (folded into "Critical flow 1" final confirmation step, SAD §6) |
| US-09 | Click-to-browse fallback | Trivial — user confirmed skip (single client-side branch, no second actor) |

## Added

None.

## Skipped (trivial)

- US-05 — client-side-only guard; no network hop to sequence.
- US-06 — rendering rule, not a multi-actor flow.
- US-07 — already documented as a crosscutting concept (SAD §8), not a flow.
- US-09 — single client-side branch, no second actor.

## New actors flagged

None — no new actors required; all flows stay within User / upload-ui / stl-upload API (existing §5 Container view).

## ADR potential

None — no new architectural decisions surfaced by this pass.

## Naming convention note (not fixed — additive-only rule)

The three existing sequences in SAD §6 use headings `**Critical flow N: ...**` rather than the `### US-N: <title>` convention this skill expects. They were matched to US-01–04/08 by content, not by heading grep. Since this skill is additive-only and must not modify existing covered sequences, the headings were left as-is. If the team wants heading-per-US traceability going forward, that's a manual edit to SAD §6, not something this run should do.

## Self-check against DoD

- Every PRD US is either Covered or explicitly Trivial (user-confirmed). ✅
- No new Mermaid blocks were added, so no `mmdc --parse-only` validation was needed this run.
