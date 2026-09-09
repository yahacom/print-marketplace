---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0002 — Sandbox untrusted STL parsing in a child process with resource limits

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** Yakiv Vakoliuk (Architect) during the sad.md §4 Socratic walk

## Context

ADR-0001 picked an existing npm library to parse and validate untrusted, user-uploaded STL files — that library still runs native/JS parsing code directly on attacker-controllable bytes. PRD §6.1 abuse case #1 names malicious/crafted STL exploiting a parser vulnerability as the top security risk, and requires parsing to run in a sandboxed/isolated process (memory cap, CPU/time limit, no network access, minimal filesystem access) so a parser exploit or crash cannot affect the host or other requests.

## Decision drivers

- §1 QG-2: safety of untrusted binary processing (PRD §6.1 abuse case #1, idea-brief §10 top risk).
- §2 Organisational: 2-week solo-maintainer deadline — favors a mechanism native to the already-chosen Node.js/TS stack over new infrastructure.
- PRD §6.1: explicit requirement — "parser exploit or crash cannot affect the host or other requests."

## Considered options

1. **`child_process` with limits** — parsing runs in a forked Node process with a timeout, memory cap, and no network access.
2. **`worker_threads` with resource limits** — parsing runs in a worker thread using the `resourceLimits` API.
3. **Per-request isolated container/microVM** — each upload gets a dedicated gVisor/Firecracker sandbox.

## Decision outcome

**Chosen:** Option 1, `child_process` with limits. Standard Node.js mechanism requiring no new infrastructure, fits the 2-week deadline, and — unlike `worker_threads` — isolates a parser crash (including native-code crashes) from taking down the whole Node process, which `worker_threads` cannot guarantee since it shares the process/memory space with the main event loop.

## Consequences

**Positive**
- No new infrastructure — reuses the Node.js runtime already on the stack.
- A parser crash or hang (timeout-killed) does not take down the main request-handling process.

**Negative**
- Isolation is incomplete out of the box: same OS user and filesystem by default. Additional OS-level hardening (restricted filesystem access, no outbound network) is required in the child process to fully satisfy PRD §6.1 — tracked as an §8 crosscutting concept, not automatic from choosing `child_process` alone.
- Slower start-up per request than `worker_threads` (new process vs. new thread) — acceptable given the ≤10000ms p95 budget (PRD §6) but leaves less headroom.

**Neutral**
- Container/microVM-level isolation (Option 3) remains a valid v2 upgrade if the threat model changes; not adopted now due to the 2-week deadline (§2).

## Links

- PRD: [[../PRD.md]] §6.1 Security/privacy
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-npm-mesh-validation-library]] (the library whose native code this sandbox contains)
