# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

A web-first 3D print marketplace (upload STL → quote → confirm/decline). Two features have landed; the quote engine has not.

Planning docs (read before changing behavior):

- `docs/overview.md` — product vision, MVP scope, user flow. `docs/CONTEXT.md` — domain glossary.
- `docs/features/quote-engine/stl-parse-feature-plan.md` — plan (in Ukrainian) for the quote-engine: real PrusaSlicer CLI invocation → G-code/stdout parser → pricing formula, with two human checkpoints (slicer wrapper verified on real files; pricing formula confirmed by the product owner). Not implemented yet.
- `docs/features/<slug>/` — per-feature PRD, SAD, ADRs, task breakdown (`tasks/tracker.md`), KB notes. `CHANGELOG.md` lists what shipped.

## Commands

- `npm run build` — `tsc` compile of the backend into `dist/` (`src/ui/` is excluded).
- `npm run build:ui` — esbuild bundle of `src/ui/main.tsx` + `index.html` into `dist-ui/`.
- `npm run typecheck` — `tsc --noEmit` for the backend and for `src/ui/` (`tsconfig.ui.json`).
- `npm run lint` — ESLint over the repo.
- `npm test` — Vitest (`src/**/*.test.{ts,tsx}`, happy-dom for UI tests). One file: `npx vitest run src/ui/app.test.tsx`; one test: `npx vitest run -t "<name>"`.
- `npm start` — run the server with `tsx` (port `PORT`, default 3000). Run `npm run build:ui` first; `dist-ui/` is gitignored and is what `/` serves.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, plus a k6 smoke test against a running server.

## Architecture

Node.js/TypeScript (ESM), a single Fastify process. `src/app.ts` builds the app (`buildApp`): request logging, metrics, `/health`, the `stl-upload` module, and `@fastify/static` serving `dist-ui/` at `/`.

- **Backend, `src/modules/stl-upload/`** — `POST /api/v1/uploads` (multipart STL, max 50 MB, 30/min/IP). Layers: `routes/` → `services/upload-service.ts` → `repositories/model-repository.ts` (local filesystem under `STORAGE_DIR`, file named `<uuid>.stl`). Errors are `{code, message}` (`upload.invalid_format`, `upload.file_too_large`, `upload.rate_limited`). The file bytes are not parsed. Contract: `docs/features/stl-upload/kb-upload-contract.md`.
- **UI, `src/ui/`** — Preact. `app.tsx` owns the state machine `idle → uploading → success | error`; `components/` (UploadForm, UploadProgress, UploadResult) are presentational; `upload-client.ts` wraps XHR for upload progress; `errors.ts` maps failures to user text (never the raw backend `message`). Filenames render as text only. Extension guide: `docs/features/stl-upload-ui/kb-extending-state-machine.md`.
- **Not built yet** — quote engine (PrusaSlicer), pricing, order confirmation. No database; no accounts.

Architecture decisions are in each feature's `adr/` directory.

## Key principles

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
