# KB: order-confirmation contract as shipped, and open items

Audience: whoever refreshes `data-model.md`, resolves the open questions below, or builds on the confirm/decline API.

Source of truth is the code: `src/modules/order-confirmation/routes/order-routes.ts` (HTTP), `services/order-service.ts` (outcomes), `repositories/order-repository.ts` (Firestore). If this note and the code disagree, the code wins; fix the note.

## What exists

There is no `orders` collection. A decision is two fields, `decision` (`"confirmed"` | `"declined"`) and `decidedAt` (server timestamp), written onto quote-engine's `draftOrders/{fileId}` document (ADR-0006). `fileId` is the stl-upload file-id (UUID v4) used end to end (ADR-0003). order-confirmation never calls quote-engine; the two modules share only that document and `src/shared/firestore-app.ts`. The one in-process call is to stl-upload's `modelExists` (ADR-0002/0008).

## HTTP

| Request | Outcome | Response |
|---|---|---|
| `GET /api/v1/orders/:fileId` | no document (or malformed id) | `404 {code: "order.not_found", message}` |
| | undecided | `200 {state: "ready", quote}` |
| | decided | `200 {state: "decided", decision, decidedAt, quote}` |
| `POST .../confirm` | decided now | `201 {status: "confirmed"}` |
| `POST .../decline` | decided now | `200 {status: "declined"}` |
| either POST | no document | `404 order.not_found` |
| either POST | already has a decision | `409 order.already_decided` |
| `POST .../confirm` only | model file gone from stl-upload | `409 order.file_missing` |
| either POST | over 10 attempts/min/IP | `429 order.rate_limited` + `Retry-After` |
| any | unexpected failure | `500 order.internal_error` (cause logged, not returned) |

`quote` is `{price, estimatedPrintTime, filamentGrams, breakdown, filename}`; `slicingTime` is not exposed. Every error is `{code, message}`; the UI keys its text on `code` and never shows `message`.

Behaviour worth knowing:
- An already-decided quote answers `already_decided` *before* the model-file check, so a duplicate confirm is never reported as `file_missing`.
- The early read is only a fast path. The guarantee is the Firestore transaction in `decideOrder`, which re-reads `decision` and writes only if it is unset (ADR-0007). Of two concurrent requests, exactly one wins.
- A decision never touches the quote fields, and `decideOrder` uses `update`, so it cannot create a document.

## T2: why quote-engine's write changed

`writeDraftOrder` used a plain `set()`, so a re-quote of the same `fileId` replaced the whole document and erased `decision`/`decidedAt`, re-opening a decided quote. It now uses `set(order, { merge: true })`. Two caveats found in review (`security-review.md` 3.1, 3.2): merge deep-merges the `breakdown` map (stale keys could survive if the key set ever changes; `mergeFields` would avoid it), and a re-quote after a decision still rewrites the price the user decided on.

## Open items

- **Stale `data-model.md`.** It still describes a dedicated `orders` collection with `create()`-based exactly-once. Re-run `sdlc:generate-data-model` against ADR-0006/0007. Not fixed here.
- **QG-2 retargeting (SAD §11).** The original "<=200 ms quote-summary display" NFR has no step in this module. The k6 read threshold measures the GET (decision-state read) instead. The Tech Lead or PM decides at stage 06 whether that satisfies it.
- **No authorization (PRD §8).** The `fileId` is the only secret, and it appears in logged URL paths (`security-review.md` 1.1). Deliberate for v1.
- **Reopen after reload (US-04/US-05).** The GET route supports it, but the SPA has no routing or persisted `fileId`, so nothing calls it yet. After a reload the user starts again at upload.
- **Security review.** `security-review.md` is input for the Security Lead; no sign-off is recorded. Follow-ups F1-F7 are not implemented.
- **Verification gaps.** No Firestore emulator exists in this repo, so the concurrency, merge, and repository tests use an in-memory fake. The k6 CI job measures this service's overhead with an in-memory repository, not Firestore latency. The Prometheus rules were only YAML-parsed. The deployment, dashboard and alert test (T14) are manual.
- **Rate limiter keying.** It keys on `request.ip`; behind a reverse proxy without `trustProxy` that is one shared bucket (`security-review.md` 4.1).
