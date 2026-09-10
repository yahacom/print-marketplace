---
status: Draft
owner: "Security Lead"
reviewers: ["Yakiv Vakoliuk"]
updated_at: "2026-09-10"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# T15 — Security review sign-off

**Links:** [PRD §6.1](../PRD.md#61-security--privacy) (scope narrowed by ADR-0006) · [SAD §1](../sad.md#1-introduction-and-goals) stakeholders table (Security Lead sign-off owner) · [ADR-0006](../adr/0006-descope-mesh-validation-to-quote-engine.md) (mesh validation + sandboxing removed from this module)

## Summary

Human-in-the-loop checkpoint. With mesh/geometry validation and its sandbox descoped to quote-engine (ADR-0006), stl-upload no longer has an untrusted-parsing boundary — the remaining surface is storing arbitrary uploaded bytes on disk under an unguessable file-id, gated by rate limiting and a size cap. Security Lead reviews this narrower surface and confirms whether the original "Required" full review still applies or a lighter checklist suffices (PRD §6.1 flags this as a recommendation, not a decision), and records sign-off.

## DoR

- T8 merged — reviewer needs working rate limiting to review against

## Scope

- Review of: rate-limit configuration (PRD §6.1 abuse case #4), storage-of-arbitrary-bytes handling (file-id unguessability, no content inspection)
- Written sign-off recorded (e.g. in this file's status, or a linked review doc), including the Security Lead's own call on review depth given the narrowed surface

## Out of scope

- Fixing findings — if the review surfaces gaps, those become new tasks, not scope creep on this one
- Anything related to mesh/geometry parsing or sandboxing — that surface no longer exists in stl-upload (ADR-0006); quote-engine's own security review must cover it there

## DoD

- Sign-off recorded by Security Lead; any findings either resolved or explicitly accepted with owner + follow-up task

## Deps

T8

## Estimate

S — review effort, not implementation

## Human verification required

This task is itself the human checkpoint per CLAUDE.md's "For architecture, security, infrastructure, migrations, and production-impacting changes: state what must be verified by a human" — no AI sign-off substitutes for it.
