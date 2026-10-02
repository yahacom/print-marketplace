---
id: T15
epic: quote-engine
project: print-marketplace
wave: 5
priority: Must
estimate: XS
blocks: []
blocked_by: [T12, T13, T14]
status: todo
prd_refs: []
sad_refs: []
adr_refs: []
---

# T15 · CHANGELOG + KB note

**Epic:** [[_epic|quote-engine]]

## Why

CLAUDE.md names `CHANGELOG.md` as the record of what shipped, and per-feature KB notes as the convention for capturing non-obvious knowledge (e.g. `docs/features/stl-upload-ui/kb-extending-state-machine.md`, `docs/features/stl-upload/kb-upload-contract.md`). This closes out the epic with both, plus flags the two open follow-ups this feature deliberately didn't resolve.

## Scope

- Append a `CHANGELOG.md` entry for quote-engine's v1 release (reuse stl-upload's entry style/format).
- Write `docs/features/quote-engine/kb-quote-contract.md` (mirroring `stl-upload`'s `kb-upload-contract.md`) documenting: the WS protocol shape (request/response message formats from T10), the `quote.*` error codes, and the Firestore draft-order document shape (from T3) — this is the contract order-confirmation's future rework will need to read.
- Update this epic's tracker and `README.md` (if the feature has one, per the repo convention — `docs/features/quote-engine/README.md` exists) to reflect "implemented," not "planned."
- **Explicitly restate, don't re-solve, in the KB note:** the order-confirmation rework (sad.md §11 High risk) and the real-file slicer verification being now closed (T4's AC-ss-5) — both so the next reader doesn't have to re-derive status from git history.

## Acceptance criteria (GWT)

- [ ] **AC-kb-1:** `CHANGELOG.md` has a new entry for quote-engine's shipped version.
- [ ] **AC-kb-2:** `kb-quote-contract.md` exists and documents the WS message shapes + error codes + Firestore document shape, each with a concrete example.
- [ ] **AC-kb-3:** `docs/features/quote-engine/README.md` no longer describes quote-engine as "not implemented."

## Checklist

- [ ] Step 1 — Write the CHANGELOG entry.
- [ ] Step 2 — Write `kb-quote-contract.md`.
- [ ] Step 3 — Update `README.md`.
- [ ] Step 4 — Confirm `tracker.md` shows all 15 tasks `done`.

## Definition of Done

- [ ] All 3 AC done.
- [ ] PR linked back to this file; `tracker.md` updated to `done`; epic closed.
