# KB: stl-upload contract for quote-engine

Audience: quote-engine implementers consuming files stored by stl-upload (PRD AC-05 handoff).

## Where to read the file

- Directory: the `STORAGE_DIR` environment variable (default `./storage/models`; `/var/lib/stl-upload/models` under the systemd unit in `deploy/systemd/stl-upload.service`).
- Filename: `<file-id>.stl`.
- quote-engine reads the file straight from the shared filesystem. There is no HTTP endpoint for this read path (ADR-0003).
- Both modules must run on the same host, as a single instance, for v1 (ADR-0003 consequences).

## The key: file-id

- Format: UUID v4 (`crypto.randomUUID()`), returned to the client as `file_id` in the 201 response (ADR-0005).
- It is the only access control in the MVP (no accounts). Treat it as a secret: do not log it in contexts that expose it to third parties, and do not enumerate the directory to discover files.
- The repository only accepts ids matching `^[A-Za-z0-9-]+$`; apply the same restriction before building a path from an id in quote-engine.

## What "valid" guarantees

A stored file has passed only these checks:

- Declared as an STL (content-type / extension).
- Non-empty.
- At most 50 MB.

## What it does not guarantee

- The bytes are **not** parsed. The file may be malformed, non-manifold, non-watertight, or not an STL at all despite its declared type.
- quote-engine must perform its own mesh/geometry validation, which happens when it loads the model into PrusaSlicer CLI (ADR-0006).
- Because the bytes are untrusted, quote-engine's own security review must cover parsing them.
- The user-facing "your mesh has holes" rejection (former stl-upload US-03/AC-03) is now quote-engine's requirement. It must be picked up in that feature's PRD/SAD, or unprintable geometry reaches the slicer with no explanation.
- Every upload gets a new file-id; identical retries are not deduplicated.

## References

- `docs/features/stl-upload/contracts/openapi.yaml`
- ADR-0003 (storage), ADR-0005 (file-id), ADR-0006 (descoped validation)
