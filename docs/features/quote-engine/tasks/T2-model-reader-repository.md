---
id: T2
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: S
blocks: [T8]
blocked_by: [T1]
status: todo
prd_refs: [AC-05, AC-06]
sad_refs: ["§5", "§6 flow 2", "§8 Subprocess safety row"]
adr_refs: []
---

# T2 · `model-reader` repository (SAFE_FILE_ID read)

**Epic:** [[_epic|quote-engine]]

## Why

quote-engine reads `<file-id>.stl` directly from the shared `STORAGE_DIR` (sad.md §5 Container view: "no API call to stl-upload"). The same file-id must resolve a missing *or* not-owned file to one generic "not found" outcome (AC-05, AC-06 — enumeration resistance), so this repository is the single point that enforces `SAFE_FILE_ID` path safety and the existence-hiding contract, not the service layer above it.

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-05, AC-06; §6.1 (file-id guessing/enumeration abuse case)
- SAD: [[../sad.md]] §5 (`repositories/model-reader.ts`), §6 flow 2 (blocked-quote sequence), §8 (`SAFE_FILE_ID` row)
- Parity ref: `src/modules/stl-upload/repositories/model-repository.ts`, `src/modules/stl-upload/file-id.ts` (existing `SAFE_FILE_ID` regex — reuse, do not redefine)

## API contract

Internal only — no HTTP/WS surface. Exported function reads STL bytes given a file-id string, returning bytes or a typed "not found" result (never throwing on a missing/invalid id — that is an expected outcome, not an exceptional one).

## Acceptance criteria (GWT)

- [ ] **AC-mr-1 (valid file-id, file exists):** Given a file-id matching `SAFE_FILE_ID` with a corresponding `<file-id>.stl` in `STORAGE_DIR`, when read, then the STL bytes are returned.
- [ ] **AC-mr-2 (well-formed but missing, AC-05):** Given a file-id matching `SAFE_FILE_ID` with no corresponding file, when read, then a "not found" result is returned — not an exception.
- [ ] **AC-mr-3 (malformed id, AC-06):** Given a file-id that does not match `SAFE_FILE_ID` (path traversal attempt, wrong format), when read, then the same "not found" result is returned as AC-mr-2 — no distinguishable error, no filesystem path ever touched with the raw input.
- [ ] **AC-mr-4 (no shell/path interpolation):** Given any file-id input, the implementation never interpolates it into a shell string — only used as a validated path segment (`path.join`), matching PRD §6.1.

## Checklist

- [ ] Step 1 — Reuse `src/modules/stl-upload/file-id.ts`'s `SAFE_FILE_ID` validator (import, do not duplicate the regex).
- [ ] Step 2 — Implement `readModel(fileId: string): Promise<Buffer | { notFound: true }>` in `repositories/model-reader.ts`: validate with `SAFE_FILE_ID` first; on failure return the same `notFound` shape as an `ENOENT` would, without touching `fs`.
- [ ] Step 3 — On a valid id, `fs.readFile(path.join(STORAGE_DIR, `${fileId}.stl`))`; map `ENOENT` to the same `notFound` result.
- [ ] Step 4 — Unit tests covering AC-mr-1..4, including a `../../etc/passwd`-style traversal attempt.

## Edge cases

| Case | Behavior |
|---|---|
| File-id valid format, file deleted between stl-upload and quote request | `notFound` — same as AC-mr-2. |
| Empty string file-id | `notFound` — fails `SAFE_FILE_ID` match. |
| File-id valid, but `STORAGE_DIR` unreadable (permissions) | Propagate as a real error (not `notFound`) — this is an operational failure, not a user-facing "model missing" case; quote-service (T8) maps it to a 5xx-equivalent, not `quote.not_found`. |

## Definition of Done

- [ ] All AC green, `npm test` passes.
- [ ] No duplicate `SAFE_FILE_ID` definition — confirmed by import, not re-implementation.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
