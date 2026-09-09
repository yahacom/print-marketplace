---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-09"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# 0003 — Store validated models on local server filesystem for v1

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** Yakiv Vakoliuk (Architect) during the sad.md §4 Socratic walk

## Context

Once a model passes validation (ADR-0001, ADR-0002), stl-upload must store it durably so quote-engine can later fetch it by file-id without re-validating (AC-05). Where the file physically lives determines whether stl-upload/quote-engine can scale to more than one instance and how the file handoff between the two features works.

## Decision drivers

- §2 Organisational: 2-week solo-maintainer deadline.
- PRD §6 Throughput: ≥5 req/s per instance — doesn't by itself require multi-instance, but any storage choice must not silently block it later.
- AC-05: quote-engine must be able to fetch the stored model by file-id without extra coordination.

## Considered options

1. **Local filesystem** — files written to a directory on the server's disk, keyed by file-id.
2. **S3-compatible object storage (AWS S3 or self-hosted MinIO)** — files written to a bucket, keyed by file-id.

## Decision outcome

**Chosen:** Option 1, local filesystem. Zero additional infrastructure and the fastest path to shipping within the 2-week deadline (§2); an object-storage service (self-hosted MinIO or an AWS account) would need its own setup and credential management, which the timeline doesn't accommodate for v1.

## Consequences

**Positive**
- No new infrastructure or credentials to set up before shipping.
- Simplest possible implementation for the file write/read path.

**Negative**
- Does not scale horizontally: a file written by one stl-upload instance is not visible to another instance, or to a quote-engine instance running on separate hardware. This forces §7 Deployment to pin stl-upload (and quote-engine, for as long as it depends on this storage) to a single instance for v1.
- Migrating to object storage later requires moving all existing files and updating both stl-upload and quote-engine's file-access code — tracked in §11 as accepted debt.

**Neutral**
- The file-id naming/addressing scheme chosen here (e.g., `<file-id>.stl` under a fixed directory) is expected to carry over unchanged if/when the backend migrates to object storage (same key, different store).

## Links

- PRD: [[../PRD.md]] AC-05, §6 NFR
- SAD: [[../sad.md]] §4, §7
- Related ADR: none
