---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0005 — Use UUID v4 as the unguessable file-id

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** Yakiv Vakoliuk (Architect) during the sad.md §8 Socratic walk

## Context

PRD AC-04 requires that a valid model have a system-generated, unguessable identifier — since the MVP has no accounts, this identifier is the *sole* access control mechanism (PRD §6.1 abuse case #5, identifier-enumeration attack). Both stl-upload and quote-engine (AC-05) address the stored model by this id, so the scheme is a multi-module contract, not an internal implementation detail.

## Decision drivers

- PRD AC-04: identifier must be unguessable; possession of the correct id is sufficient for access.
- PRD §6.1 abuse case #5: identifier-enumeration attack must be infeasible.
- No accounts/auth in MVP (PRD §3 Non-goals) — this id carries the full access-control weight.

## Considered options

1. **UUID v4** — fully random, 122 bits of entropy, no embedded metadata.
2. **UUID v7** — time-ordered prefix + random suffix; sortable but leaks creation-time bits.
3. **Opaque 256-bit random token (non-UUID)** — custom crypto-random generator, base62/hex encoded.

## Decision outcome

**Chosen:** Option 1, UUID v4. Strongest unguessability guarantee among standard UUID formats — no timing information leaks into the identifier — while staying a well-supported standard format (`crypto.randomUUID()` built into Node.js) rather than a bespoke token scheme with no ecosystem support.

## Consequences

**Positive**
- Widely supported, no custom crypto code to write or review under the 2-week deadline (§2).
- No timing side-channel — unlike UUID v7, guessing a valid id can't be narrowed by knowing an approximate upload time.

**Negative**
- Not sortable by creation time — any future need to list/paginate uploads by recency requires a separate `created_at` column, not derivable from the id itself.
- Slightly worse database index locality than UUID v7 (random insert order) — not a concern at MVP scale (single-instance, local filesystem per ADR-0003, no DB index on this field yet).

**Neutral**
- If a future feature needs time-ordered ids for a different purpose, that would be a separate, scoped decision — not a reason to revisit this one, since file-id's job is access control, not ordering.

## Links

- PRD: [[../PRD.md]] AC-04, §6.1 abuse case #5
- SAD: [[../sad.md]] §8
- Related ADR: [[0003-local-filesystem-storage]] (this id is the storage key)
