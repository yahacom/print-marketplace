---
id: T9
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: XS
blocks: [T10]
blocked_by: [T1]
status: todo
prd_refs: ["§6.1 Spam create"]
sad_refs: ["§5", "§8 Rate limiting row"]
adr_refs: []
---

# T9 · quote-engine rate-limit (reuse stl-upload pattern)

**Epic:** [[_epic|quote-engine]]

## Why

The shared PrusaSlicer resource (one subprocess at a time, T7) needs protection from spam quote requests, the same way `stl-upload` protects its upload endpoint — PRD §6.1 explicitly calls for reusing the 30/min/IP pattern, own counter instance.

## Linked artifacts

- PRD: [[../PRD.md]] §6.1 (spam-create abuse case — "reuse stl-upload's 30/min/IP pattern")
- SAD: [[../sad.md]] §5 (`routes/rate-limit.ts`), §8 (Rate limiting row — "own counter instance, same shape")
- Parity ref: `src/modules/stl-upload/routes/rate-limit.ts` (copy the shape, new counter — do not share state with stl-upload's limiter)

## Scope

Copy the in-memory fixed-window per-IP limiter pattern from `stl-upload/routes/rate-limit.ts`, instantiated as its own counter for quote-engine (30/min/IP, same as stl-upload — no new number invented).

## Acceptance criteria (GWT)

- [ ] **AC-rl-1 (under limit):** Given fewer than 30 requests/min from one IP, when a quote request arrives, then it is allowed through.
- [ ] **AC-rl-2 (over limit):** Given 30+ requests/min from one IP, when the next request arrives, then it is rejected with `quote.rate_limited`.
- [ ] **AC-rl-3 (independent counters):** Given stl-upload's limiter is at its own cap, when a quote request arrives, then it is evaluated against quote-engine's own counter, unaffected by stl-upload's state.

## Checklist

- [ ] Step 1 — Copy/adapt `stl-upload/routes/rate-limit.ts`'s shape into `quote-engine/routes/rate-limit.ts`, new counter instance.
- [ ] Step 2 — Unit tests for AC-rl-1/2/3.

## Edge cases

| Case | Behavior |
|---|---|
| IP behind a shared NAT/proxy | Same limitation as stl-upload already accepts — not a new problem introduced here, not re-solved here. |

## Definition of Done

- [ ] All AC green.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
