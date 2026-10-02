# Sequence coverage audit — quote-engine — 2026-10-02

Run via `sdlc:complete-sequence-diagrams quote-engine`.

## Coverage result

| US | Title | Status | Notes |
|---|---|---|---|
| US-01 | Get an exact print quote | Covered | sad.md §6 "Critical flow 1: Happy path — AC-01" |
| US-02 | See a clear error on unslicable models | Covered | sad.md §6 "Critical flow 2: Blocked quote", `alt` branch (AC-02) |
| US-03 | See the price breakdown | **Trivial — skipped** | Breakdown is a field in flow 1's happy-path response, not a distinct flow; no separate business logic or error branch. User explicitly confirmed Trivial over drawing a near-duplicate of flow 1. |
| US-04 | Be blocked when a model is too big to print | Covered | sad.md §6 "Critical flow 2: Blocked quote", `alt` branch (AC-04) |
| US-05 | Be told when my uploaded model is no longer available | Covered | sad.md §6 "Critical flow 2: Blocked quote", `alt` branch (AC-05, shares the same generic-response branch as AC-06 authorization) |

## Added

None — no new Mermaid blocks were generated this pass.

## Skipped — trivial

- **US-03** — see Notes above. User confirmed; promotable back to Missing in a future run if a distinct breakdown-specific flow becomes warranted (e.g. if breakdown computation gains its own error path).

## New actors flagged

None.

## ADR potential

None — no new architectural decisions surfaced during this audit.

## Structural note for future runs

sad.md §6 groups flows by AC (`Critical flow 1` / `Critical flow 2` bold labels), not by `### US-N:` heading per this skill's default convention. Coverage was established by reading content, not by the skill's default `grep -E "^### .*US-N\b"` match. **User declined** adding `### US-N:` headings alongside the existing bold labels during this run — re-run this audit by reading §6 content directly next time too, not by grepping for headings.
