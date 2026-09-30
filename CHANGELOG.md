# Changelog

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
