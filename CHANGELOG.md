# Changelog

## [Unreleased] - quote-engine

### Added

- `GET /api/v1/quotes` (WebSocket): the client sends `{type: "quote.request", fileId, filename}`; the server slices the stored STL with PrusaSlicer CLI and replies with one `quote.done` (`price`, `timeMinutes`, `filamentGrams`, `breakdown`) or `quote.error` (`quote.not_found`, `quote.unslicable`, `quote.exceeds_build_volume`, `quote.rate_limited`, `quote.internal_error`), then closes. See `docs/features/quote-engine/kb-quote-contract.md`.
- Pricing formula `time_hours * rate_per_hour + grams * price_per_gram` plus a margin, configured in `src/modules/quote-engine/config/pricing.json`.
- In-process FIFO queue with a single slicer worker (ADR-0003); closing the WebSocket for any reason hard-kills the in-flight slice and writes no draft.
- Non-watertight models are rejected (`quote.unslicable`) instead of being quoted from an auto-repaired mesh.
- Each successful quote is persisted as a Firestore draft order in `draftOrders/<file-id>` (ADR-0002).
- Quote UI: "Slicing..." wait state with "Back to start", price breakdown, and plain-language errors keyed on `code` (the raw backend `message` is never shown).
- Slice duration, queue depth and exit-code metrics on `/metrics`; rate limiting of quote requests (30/min per IP).

### Notes

- Requires PrusaSlicer 2.9.6 on the host and `FIRESTORE_CREDENTIALS_JSON` (the service-account JSON) in the environment; the server refuses to boot the module without it.
- Not done: the k6 load test (T14, needs human decisions) and CI coverage of the slicer-backed integration tests (CI has no PrusaSlicer).
- The order-confirmation rework required by ADR-0002 (`docs/features/quote-engine/sad.md` §11, High risk) is still open.

## [Unreleased] - stl-upload-ui

### Added

- Browser upload UI (Preact + TypeScript, built with esbuild into `dist-ui/`) served at `/` by the existing Fastify process via `@fastify/static`.
- Drag-and-drop or click-to-browse STL selection with client-side single-file / no-folder guards.
- Real byte-level upload progress (XHR), and a success or error result screen. Filenames are rendered as plain text only.
- Plain-language error messages for `upload.invalid_format`, `upload.file_too_large`, `upload.rate_limited`, unrecognized server errors, and network/timeout failures. The raw backend `message` is never shown.
- `npm run build:ui`; `npm run typecheck` now also checks `src/ui/` via `tsconfig.ui.json`.
- NFR verification checklist and a KB note on extending the UI state machine: `docs/features/stl-upload-ui/`.

### Notes

- Run `npm run build:ui` before `npm start`; the UI is served from `dist-ui/`, which is not committed.

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
