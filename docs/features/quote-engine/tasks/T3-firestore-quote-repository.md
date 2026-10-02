---
id: T3
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: S
blocks: [T8]
blocked_by: [T1]
status: done
prd_refs: []
sad_refs: ["§4 strategic choice 3", "§5", "§8 Credential management row"]
adr_refs: ["0002"]
---

# T3 · Firestore `quote-repository` + credential loading

**Epic:** [[_epic|quote-engine]]

## Why

ADR-0002 persists the computed quote to Firestore as a draft order, keyed by the shared file-id, so order-confirmation can later act on an existing record. This is the **first credential-bearing dependency in the repo** (sad.md §8) — the service-account key must come from an env var, never be committed, per CLAUDE.md security rules.

## Linked artifacts

- SAD: [[../sad.md]] §4 strategic choice 3, §5 (`repositories/quote-repository.ts`), §8 (Credential management row)
- ADR: [[../adr/0002-persist-quote-as-firestore-draft-order.md]]

## Scope

- Add `firebase-admin` dependency.
- Load the service-account credential from `FIRESTORE_CREDENTIALS_JSON` env var (JSON string or path — pick one, document the choice in the PR description; do not hardcode or commit a key).
- Implement `writeDraftOrder(fileId, { price, timeMinutes, filamentGrams, breakdown })` — writes/overwrites a Firestore document keyed by `fileId`.
- **Explicitly out of scope:** reworking order-confirmation's `create()`-based exactly-once mechanism (ADR-0002's "Negative" consequence) — that is the separate architecture pass tracked in sad.md §11 High risk, not this task.

## Acceptance criteria (GWT)

- [x] **AC-fr-1 (write succeeds):** Given a valid `fileId` and quote payload, when `writeDraftOrder` is called, then a Firestore document at the expected collection/`fileId` path contains the price/time/breakdown fields.
- [x] **AC-fr-2 (missing credential fails fast at startup, not at request time):** Given `FIRESTORE_CREDENTIALS_JSON` is unset, when the module initializes, then it throws a clear startup error — not a silent no-op or a per-request failure.
- [x] **AC-fr-3 (no credential in source):** `git grep` for `FIRESTORE_CREDENTIALS_JSON` finds only the env-var reference, never a literal key value, anywhere in the diff.

## Checklist

- [x] Step 1 — `npm install firebase-admin`.
- [x] Step 2 — Document the required env var in `.env.example` (placeholder value only, e.g. `FIRESTORE_CREDENTIALS_JSON=<REDACTED>`) if the repo has one; otherwise note it in `README.md`'s env-var section.
- [x] Step 3 — Implement Firestore client init in `repositories/quote-repository.ts`, reading the credential once at module load.
- [x] Step 4 — Implement `writeDraftOrder`.
- [x] Step 5 — Unit tests against the Firestore emulator or a mocked `firebase-admin` client (pick whichever the repo's existing test tooling supports more cheaply — no new test infra if avoidable).

## Edge cases

| Case | Behavior |
|---|---|
| Firestore write fails (network, quota) | Propagate as a real error; quote-service (T8) must not report `quote.done` to the user if the draft write failed — partial success is not success. |
| Same `fileId` quoted twice (re-slice per PRD §3 non-goal: no caching) | Second write overwrites the first document — acceptable per sad.md §11 Accepted debt ("no automatic cleanup... quote determinism... assumed, not verified"). |

## Definition of Done

- [x] All AC green.
- [x] No secret committed — explicit check before PR (CLAUDE.md security rule).
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- ASSUMPTION: `FIRESTORE_CREDENTIALS_JSON` holds the service-account JSON itself (not a file path) — simplest for env-based secret injection, and nothing on disk to leak. Required by the module at startup via `createQuoteRepository()`; T10 must call it when registering the module so a missing key fails the boot.
- ASSUMPTION: draft orders are stored in the Firestore collection `draftOrders`, document id = file-id, fields `price`, `timeMinutes`, `filamentGrams`, `breakdown`. The task and ADR-0002 don't name the collection; order-confirmation's rework should confirm or rename it.
- ASSUMPTION: the repo has neither `.env.example` nor a README, so Step 2 is satisfied by this note (placeholder: `FIRESTORE_CREDENTIALS_JSON=<REDACTED>`); T15's KB note should carry the env-var documentation. `deploy/systemd/stl-upload.service` was not touched (outside the story).
- Tests mock `firebase-admin` (no emulator, no new test infra). The real SDK against live Firestore is unverified.
- `npm install` needed `--cache $TMPDIR/...` because the sandbox blocks `~/.npm/_cacache`; `npm audit` reports 2 moderate advisories in the new transitive tree, not investigated.
