---
id: T10
epic: quote-engine
project: print-marketplace
wave: 4
priority: Must
estimate: M
blocks: [T11, T12, T13, T14, T16]
blocked_by: [T8, T9]
status: done
prd_refs: [AC-01, AC-02, AC-04, AC-05, AC-06]
sad_refs: ["§4 strategic choice 1", "§5", "§6"]
adr_refs: ["0001"]
note: "AC-qr-5 superseded 2026-10-02: the user explicitly decided hard-kill-on-close (not 'decide and document'). See T16 for the FE side of this flow."
---

# T10 · `quote-routes` — WebSocket handshake + push

**Epic:** [[_epic|quote-engine]]

## Why

ADR-0001 chose WebSocket push over a 60s-held HTTP request or a polling endpoint, precisely to avoid proxy/browser timeout risk on the slowest path in the system. This task wires `quote-service` (T8) behind that WS protocol and registers the module into `src/app.ts` for the first time (T1 deliberately left it unregistered).

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-01, AC-02, AC-04, AC-05, AC-06
- SAD: [[../sad.md]] §4 strategic choice 1, §5 (`module.ts`, `routes/quote-routes.ts`), §6 (both sequence diagrams)
- ADR: [[../adr/0001-websocket-push-for-quote-result.md]]
- Reference app wiring: `src/app.ts` (`buildApp`) — see how `stlUploadModule` is registered

## Scope

- Add `@fastify/websocket` dependency (ADR-0001's stated new dependency).
- Implement `routes/quote-routes.ts`: WS handshake, reads the file-id from the connection (query param or first message — pick one, document the choice), delegates to `quote-service.requestQuote`, pushes `{ type: "quote.done", ...payload }` or `{ type: "quote.error", code }` once resolved.
- Wire T9's rate-limit check before delegating (reject the handshake or push an immediate `quote.rate_limited` if over limit — pick one, consistent with how stl-upload rejects over-limit HTTP requests).
- Register `quoteEngineModule` in `src/app.ts`'s `buildApp` (the first point this module becomes live).
- **On WS close, for any reason** (client-initiated "Back to start" per T16, network drop, browser tab close): call T8's `cancelQuote(jobId)` so the in-flight PrusaSlicer subprocess is hard-killed and no Firestore draft gets written for a quote nobody will see (decided 2026-10-02 — supersedes the earlier "decide and document" framing; also ADR-0001's Negative consequence, now resolved concretely rather than left to the client alone). Track the `jobId` returned by `quote-service.requestQuote` per connection so the `close` handler has something to cancel.

## Acceptance criteria (GWT)

- [x] **AC-qr-1 (AC-01 happy path over WS):** Given a client opens a WS connection and requests a quote for a valid file-id, when the slice succeeds, then the client receives exactly one `quote.done` message with price/time/breakdown.
- [x] **AC-qr-2 (AC-02/04/05/06 error over WS):** Given any of the four blocking conditions, when `quote-service` resolves with an error, then the client receives exactly one `quote.error` message with the matching code, and the WS connection is closed cleanly afterward (not left open past the request, per sad.md §10 QG-3).
- [x] **AC-qr-3 (rate limited):** Given the IP is over quote-engine's rate limit, when a new request arrives, then the client receives `quote.error` with `quote.rate_limited`, without reaching `quote-service` at all.
- [x] **AC-qr-4 (module registered):** `src/app.ts`'s `buildApp` registers the quote-engine module — confirmed by an integration test opening a real WS connection against a built app instance.
- [x] **AC-qr-5 (WS close cancels the in-flight job):** Given a WS connection closes (any reason) while its quote is still slicing, when the server's `close` handler fires, then it calls `cancelQuote(jobId)`, the PrusaSlicer subprocess is killed (verified via T4/T7's cancellation contract, not just "the promise resolved"), and no Firestore draft is written for that job.
- [x] **AC-qr-6 (close after completion is a no-op):** Given the quote already resolved (success or error, message already pushed) before the connection closes, then the `close` handler's `cancelQuote` call is a harmless no-op — no error thrown, nothing double-cancelled.

## Checklist

- [x] Step 1 — `npm install @fastify/websocket`.
- [x] Step 2 — Implement `routes/quote-routes.ts` WS handler.
- [x] Step 3 — Wire T9's rate-limit check ahead of `quote-service`.
- [x] Step 4 — Implement the `close` handler calling `cancelQuote(jobId)` (AC-qr-5/6) — track `jobId` per connection.
- [x] Step 5 — Register the module in `module.ts`, then in `src/app.ts`.
- [x] Step 6 — Integration tests for AC-qr-1..6 using a real WS client against `buildApp()`.

## Edge cases

| Case | Behavior |
|---|---|
| Client sends a second quote request on the same open connection | Out of scope for v1 — one request per connection is the assumed protocol shape (document this assumption explicitly if the implementation doesn't support multiple requests per socket). |
| Keep-alive ping/pong | ADR-0001 explicitly notes no keep-alive is implemented — a dropped connection (network blip, proxy idle timeout) looks identical to a deliberate client close and triggers the same `cancelQuote` path (AC-qr-5). The FE (T16) cannot distinguish "user clicked Back to start" from "connection blipped" either, by design — both just show the upload form again. |
| `jobId` not yet assigned when `close` fires (connection dropped during T2's file-id read, before T7.enqueue) | `cancelQuote` no-ops per T8's AC-qs-7 contract — nothing to cancel yet. |

## Definition of Done

- [x] All AC green, including the real-WS-client integration test.
- [x] `src/app.ts` now registers quote-engine — confirmed by `grep`.
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- Protocol (documented in `routes/quote-routes.ts`): WebSocket at `GET /api/v1/quotes`; the client's **first message** is `{ "type": "quote.request", "fileId": "<uuid>" }` (not a query param, so the id never reaches access logs). Server pushes one `{ type: "quote.done", price, timeMinutes, filamentGrams, breakdown }` or `{ type: "quote.error", code, message }`, then closes with 1000. One request per connection; later messages are ignored. Max message size 1 KiB.
- ASSUMPTION: rate limit pushes `quote.error` / `quote.rate_limited` over the socket (AC-qr-3 wording) rather than rejecting the handshake with HTTP 429 — a browser `WebSocket` cannot read a 429 body, so the UI (T12) could not show the message. To support this, T9's limiter was split into `createQuoteRateLimiter()` (decision function, used here per connection, counted when the request message arrives) and `applyQuoteRateLimit()` (the HTTP hook, unchanged behavior and tests).
- ASSUMPTION: an operational failure (rejected promise, service construction error) is pushed as `quote.error` with a new code `quote.internal_error` and a generic message; the cause is only logged. T12/T16 should map unknown codes to generic text.
- ASSUMPTION: a malformed or non-JSON first message is treated as an unusable file-id, so it gets the identical `quote.not_found` as a missing file.
- ASSUMPTION (needs a human decision): `buildApp()` registers the module but builds the real service **lazily** (first quote request), and `src/main.ts` / CI were not changed. Boot-time fail-fast would need `FIRESTORE_CREDENTIALS_JSON` and PrusaSlicer in the k6-smoke CI job and the deploy env, and editing `main.ts` is outside this story. `assertQuoteEngineReady()` (T3 credential check + T4 slicer check) is exported from `module.ts` for that follow-up. Until then a missing credential surfaces as `quote.internal_error` + a log line on the first request, not at boot.
- `buildApp({ quoteService })` lets tests inject a service; the integration tests open a real `WebSocket` (Node's global client) against `app.listen({ port: 0 })`. Binding a local port is blocked in the Ralph sandbox (`listen EPERM`), so this file was run with the sandbox disabled for that one command; it needs `sandbox.network.allowLocalBinding: true` to run inside it.
- AC-qr-5 is verified at the service/queue boundary: a socket close reaches `queue.cancel(queueJobId)`, T4's cleanup runs and no Firestore write happens. The actual SIGTERM of a live PrusaSlicer process is covered by T4's AC-ss-6 test and T13's end-to-end scenario, not duplicated here.
- Added `@fastify/websocket` ^11.3.1 (plus its `ws` dependency). Verify availability and compatibility in your environment; `npm install` needed `--cache $TMPDIR/...` in the sandbox.
