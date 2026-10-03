# KB: quote-engine contract for the UI and order-confirmation

Audience: implementers of the quote UI (`src/ui/`) and of order-confirmation, which will read the draft order quote-engine writes.

Source of truth is the code: `src/modules/quote-engine/routes/quote-routes.ts` (protocol), `services/quote-service.ts` (outcomes), `repositories/quote-repository.ts` (Firestore). If this note and the code disagree, the code wins; fix the note.

## WebSocket protocol (ADR-0001)

- Endpoint: `GET /api/v1/quotes`, upgraded to a WebSocket. One quote request per connection.
- The file-id travels in the first message, not the URL, so it never lands in proxy/access logs.
- Only the first text message counts; later client messages are ignored. Messages over 1024 bytes are not valid clients (`MAX_MESSAGE_BYTES`).
- The server sends exactly one result message, then closes the socket with code 1000.
- **Closing the socket for any reason cancels the job** (Back to start, network drop, tab close): the PrusaSlicer subprocess is hard-killed and no draft order is written. After a finished quote the close is a no-op.

Client → server:

```json
{ "type": "quote.request", "fileId": "3f2b8c1e-5d4a-4b7e-9a10-2c6d8e0f1a23", "filename": "bracket.stl" }
```

`fileId` is the `file_id` returned by `POST /api/v1/uploads` (see `docs/features/stl-upload/kb-upload-contract.md`). `filename` is the original name, stored only to show it back in the draft order.

Server → client, success:

```json
{
  "type": "quote.done",
  "price": 3.24,
  "timeMinutes": 60,
  "filamentGrams": 10,
  "breakdown": { "timeCost": 2.5, "materialCost": 0.2, "margin": 0.54 }
}
```

Numbers on the wire are **not rounded**; displayed precision is the UI's job. `price` is the sum of the three `breakdown` entries. Pricing: `time_hours * rate_per_hour + grams * price_per_gram`, plus `margin_pct` of that subtotal (`config/pricing.json`).

Server → client, failure:

```json
{ "type": "quote.error", "code": "quote.unslicable", "message": "We couldn't prepare this model for printing, so we can't quote it." }
```

## Error codes

The UI must key its own copy on `code` and never render the backend `message` (same rule as stl-upload-ui).

| Code | Meaning |
|---|---|
| `quote.not_found` | No stored model for that id. Also returned for a malformed or missing `fileId` or a non-JSON first message, so a client cannot probe which ids exist. |
| `quote.unslicable` | The model cannot be quoted: non-watertight mesh (`--info` reports `manifold = no`; product decision 2026-10-02 is to reject rather than quote an auto-repaired mesh), slicer failure or timeout, or unparseable slicer output (logged server-side as possible slicer version drift). |
| `quote.exceeds_build_volume` | The model is larger than the printer's bed. PrusaSlicer exits 0 with no G-code in this case, so the parser classifies it, not the exit code. |
| `quote.rate_limited` | Per-IP limit on quote requests exceeded (30/min default). |
| `quote.internal_error` | Operational failure (storage, Firestore, slicer crash, service not configured). Safe to retry. |

## Firestore draft order (ADR-0002)

- Collection `draftOrders`, document id = the `fileId`. A re-quote of the same file **overwrites** the document.
- Written only after a successful quote and before `quote.done` is sent. If the write fails the client gets `quote.internal_error`, never a `quote.done` for a quote that was not saved.
- Credentials: `FIRESTORE_CREDENTIALS_JSON` holds the service-account JSON itself (not a path). It is read once at module startup; a missing or malformed value fails the boot. Never commit or log it.

Shape (values rounded to 2 decimals; times are integer seconds):

```json
{
  "price": 3.24,
  "estimatedPrintTime": 3600,
  "filamentGrams": 10,
  "breakdown": { "timeCost": 2.5, "materialCost": 0.2, "margin": 0.54 },
  "filename": "bracket.stl",
  "slicingTime": 2
}
```

`estimatedPrintTime` is the slicer's print-time estimate; `slicingTime` is wall-clock seconds from enqueue to slice finished (queue wait included).

## Status of open items

- **Order-confirmation rework: still open.** ADR-0002 deliberately overrides order-confirmation's already-Accepted design, which is a High-severity risk in `sad.md` §11. It needs its own `sdlc:architecture-design` pass before either feature ships. This epic did not resolve it.
- **Real-file slicer verification: closed for the wrapper (T4 AC-ss-5).** PrusaSlicer 2.9.6 was run against two real uploads on macOS arm64 on 2026-10-02. Still unverified: headless operation on Linux/Docker/CI, and SIGTERM behavior when a kill lands mid-write.
- **Load test (T14): not implemented.** There is no k6 quote scenario. It needs human decisions (Firestore and PrusaSlicer in the CI job, a quote rate-limit override); see T14's Notes. The p95 ≤ 60 s NFR is therefore measurable via `quote_slice_duration_seconds` but not yet verified under load.
- **Integration tests (T13)** are green locally only; CI has no PrusaSlicer. See T13's Notes.

## References

- ADR-0001 (WebSocket push), ADR-0002 (Firestore draft order), ADR-0003 (FIFO queue, single slicer worker)
- `docs/features/quote-engine/sad.md` §6 (runtime), §8 (error mapping), §11 (risks)
