---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-13"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0005 — Use Server-Sent Events for slicing-completion updates

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Yakiv Vakoliuk (Architect / feature owner) during the sad.md §4 Socratic walk

## Context

quote-engine's slicing step is not instantaneous. After a model passes stl-upload, the user must see a loading state and then receive the quote and its cost breakdown on the same screen, without a full page reload (feature owner direction).

## Decision drivers

- §1 QG-2: p95 quote-summary display ≤200ms (PRD §6) — measured from the moment the quote becomes ready, not from upload; a slow "did it finish yet" mechanism would eat into the perceived responsiveness the user experiences.
- §2 Constraints: solo maintainer, ~2-week effort budget — favors the simplest mechanism that meets the no-reload requirement.
- The signal is one-directional (server → client "quote ready"), not a two-way channel.

## Considered options

1. **Server-Sent Events (SSE)** — the client opens a long-lived HTTP connection; the server pushes a "quote ready" event once slicing completes.
2. **Polling** — the client repeatedly requests a status endpoint (e.g. every 1-2s) until the status is `ready`.
3. **WebSocket** — a full-duplex connection between client and server.

## Decision outcome

**Chosen:** Option 1, SSE. Delivers the "quote ready" signal with minimal latency (no polling interval lag) using a native browser API (`EventSource`), without the bidirectional complexity WebSocket would add for a signal that only ever flows server → client.

## Consequences

**Positive**
- Minimal latency between slicing completion and the client seeing the quote — no polling-interval lag against §1 QG-2.
- No bidirectional protocol to implement, test, or reason about — `EventSource` is a native browser API.

**Negative**
- The server holds an open connection per waiting client; this is a new operational concern for §7 Deployment (acceptable at v1's single-instance scale — no cross-instance session-affinity problem yet, but revisit if the deployment moves to multiple instances).

**Neutral**
- Long-running slicing jobs (multi-minute) would need reconnection/heartbeat handling — not addressed in v1; flagged as accepted debt if slicing times grow (§11).

## Links

- PRD: [[../PRD.md]] §6 NFR (quote-summary display latency)
- SAD: [[../sad.md]] §4, §6, §7
- Related ADR: none
