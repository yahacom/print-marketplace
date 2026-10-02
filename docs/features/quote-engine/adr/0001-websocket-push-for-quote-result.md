---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-02"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0001 — Push the quote result to the browser over WebSocket instead of a blocking HTTP request

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Yakiv Vakoliuk (Architect) during the sad.md §4 Socratic walk

## Context

A quote request requires actually invoking PrusaSlicer CLI as a subprocess — real wall-clock work, not an estimate — and PRD §6 NFR sets a p95 target of ≤60s for that work. AC-01 says "the system returns a print time, material usage, and price... and confirms the quote to the user," but doesn't fix whether that happens within the same request/response exchange or later. How the browser learns the result shapes both the quote-engine API and the UI's existing `idle → uploading → success | error` state machine (`src/ui/app.tsx`).

## Decision drivers

- PRD §6 NFR: quote turnaround p95 ≤60s, driven by real slicer wall-clock, not an estimate.
- §1 QG-2 (quote turnaround latency).
- Avoiding a 60s-held HTTP connection, which is at risk of being cut by an intermediate proxy or browser idle-timeout before the slice even finishes.
- Avoiding the added job-store + polling-endpoint surface that an async-job design would need, which the current PRD doesn't otherwise require (no stated need for progress updates mid-slice).

## Considered options

1. **Synchronous blocking HTTP request** — `POST /api/v1/quotes` holds the connection open for up to 60s and returns 200 with the full quote body, or an error, in that same response.
2. **Asynchronous job + polling** — `POST /api/v1/quotes` returns 202 + a quote-id immediately; the browser polls `GET /api/v1/quotes/:id` every few seconds until the job resolves.
3. **WebSocket push** — the browser opens a WebSocket for the request; the server pushes a `quote.done` or `quote.error` message once the subprocess finishes.

## Decision outcome

**Chosen:** Option 3, WebSocket push. It avoids the HTTP/proxy-timeout exposure of Option 1 on a request that can legitimately take up to 60s, without the job-store and polling-endpoint surface Option 2 would add for a requirement the PRD doesn't otherwise call for (no mid-slice progress UI exists in scope today).

## Consequences

**Positive**
- No HTTP connection is held open for up to 60s — removes an entire class of proxy/browser-timeout failures on the slowest path in the system.
- No polling loop, no job-store to build, maintain, or garbage-collect.
- Leaves room to add live progress messages later (e.g. "slicing layer 40/120") without a protocol change, if a future PRD revision asks for it.

**Negative**
- New dependency: `@fastify/websocket` is not currently in `package.json`.
- New client-side pattern: `src/ui/upload-client.ts` currently wraps XHR for upload progress; quote-requesting needs its own WebSocket-based client code, not a reuse of the existing XHR wrapper.
- WebSocket connections can drop mid-slice (proxy idle timeout, network blip) without a keep-alive ping/pong; the client must handle a dropped connection as a quote failure, not assume the slice itself failed.

**Neutral**
- Does not change how `order-confirmation` gets a quote — that module calls quote-engine's exported function in-process (order-confirmation ADR-0002), independent of how the browser-facing API is shaped.

## Links

- PRD: [[../PRD.md]] §5 AC-01, §6 NFR
- SAD: [[../sad.md]] §4
- Related ADR: none in this feature yet
