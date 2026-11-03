# Changelog

## [0.2.0] - 2026-11-03

### Added

- Browser upload UI (Preact + TypeScript): drag-and-drop or click-to-browse STL selection, real byte-level upload progress, client-side single-file/no-folder guards, and plain-language errors (the raw backend `message` is never shown).
- Quote engine: upload a model and get a price quote over WebSocket (`GET /api/v1/quotes`) — real PrusaSlicer slicing, a pricing formula (time + material + margin), non-watertight models rejected rather than auto-repaired, and a live "Slicing..." wait state with a price breakdown.
- Quote screen now shows the model's dimensions and a client-side 3D preview of the uploaded STL, alongside the price breakdown.
- Order confirmation: review a quote, enter Name/Phone/Email and quantity, and confirm or decline it. A quote can only be decided once; re-quoting after a decision no longer erases it.
- Operational groundwork for all of the above: rate limiting on every write endpoint, structured request logging (incl. slicer duration and exit codes), Prometheus metrics/alerts, and a k6 load test in CI.

### Changed

- A re-quote on an already-decided order no longer erases the recorded decision (quote-engine's draft-order write now merges instead of overwriting).

### Known limitations

- Quote engine and order confirmation both require PrusaSlicer and `FIRESTORE_CREDENTIALS_JSON` on the host; CI has no PrusaSlicer, so the slicer-backed integration tests don't run there yet.
- No authorization checks (deliberate v1 gap); reopening a past quote after a page reload isn't supported (the SPA has no routing); the order-confirmation security review is still awaiting sign-off.
- Tests use an in-memory Firestore fake, not the emulator — run the concurrency/merge tests against real Firestore before relying on this in production.

## [0.1.0] - stl-upload first release

### Added

- `POST /api/v1/uploads`: accepts a multipart STL upload, checks the declared format (content-type/extension) and size (max 50 MB), and stores the file under a system-generated UUID v4 file-id. Responses: 201 (`{file_id, status: "valid"}`), 400 `upload.invalid_format`, 413 `upload.file_too_large`, 429 `upload.rate_limited`. See `docs/features/stl-upload/contracts/openapi.yaml`.
- Rate limiting: 30 uploads per minute per IP.
- Local-filesystem storage of accepted files as `<file-id>.stl` under `STORAGE_DIR` (ADR-0003).
- Structured JSON request logging with `request_id`; file content is never logged.
- Latency metric, systemd unit config (`deploy/systemd/`), and a k6 smoke test in CI (p95 ≤ 10000 ms, ≥ 5 req/s).

### Notes

- Mesh/geometry validation (watertightness) is not performed by stl-upload; it belongs to quote-engine (ADR-0006). A 201 means "declared STL within the size limit", not "printable". See `docs/features/stl-upload/kb-upload-contract.md`.
- v1 storage is a local directory, so stl-upload and quote-engine must run on the same host as a single instance (ADR-0003).
