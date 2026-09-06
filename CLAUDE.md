# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository currently contains no application code — no package.json, source tree, build, lint, or test setup exists yet. It holds only planning documents:

- `docs/overview.md` — the product overview: vision, MVP scope (in/out), and the MVP user flow (upload STL → get a print quote → confirm/decline order) for a web-first 3D print marketplace.
- `stl-parse-feature-plan.md` — a detailed orchestration plan (in Ukrainian) for the quote-engine sub-feature: turning an uploaded STL into an exact price/time via a real PrusaSlicer CLI invocation (not a weight-based estimate). It decomposes the feature into sub-tasks (slicer CLI wrapper → G-code/stdout parser → pricing formula → QA/docs) and specifies two human-in-the-loop checkpoints: after the slicer wrapper is verified against real files, and after the pricing formula is confirmed by the product owner.

Before writing any code, read both docs above — `docs/overview.md` links to `stl-parse-feature-plan.md` for the quote-engine detail.

Architecture, task breakdown, and ADRs are explicitly deferred (per `docs/overview.md`) and have not been written yet. The only implementation decision made so far is that the stack will be Node.js/TypeScript — no framework, data model, queue design, service boundaries, or hosting choices have been made.

## Working in this repo right now

There are no build/lint/test commands to run because no code exists yet. When code is introduced, this file should be updated with the actual commands (build, lint, test — including how to run a single test) and a description of the real architecture, replacing this section.

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
