---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T8 — Wire state machine end-to-end

**Links:** [SAD §6 Runtime view](../sad.md#6-runtime-view) (flows 1-3) · [PRD AC-01, AC-02, AC-03, AC-04](../PRD.md#5-acceptance-criteria) · [SAD §5](../sad.md#5-building-block-view)

## Summary

Wires `app.tsx` (T2) to the real `UploadForm` (T3), `upload-client.ts` (T4), `errors.ts` (T5), `UploadProgress` (T6), and `UploadResult` (T7): form submit → `upload-client.submit()` → progress events drive `UploadProgress` → success/error response mapped via `errors.ts` → `UploadResult`. This is integration work only — each piece was already unit/component-tested in its own task.

## Scope

- Replace T2's stub children with the real components
- `app.tsx` calls T4's submit function on form submission, forwards progress events to `UploadProgress`, maps the resolved/rejected outcome through `errors.ts` into `UploadResult`

## Out of scope

- Any new component or mapping logic (all built in T3–T7)
- Fastify serving (T9)

## DoD

- Integration/component test (mocked XHR): happy path renders success (AC-01)
- Integration/component test: `upload.invalid_format` response renders the AC-02 message
- Integration/component test: `upload.file_too_large` response renders the AC-03 message, distinct from AC-02's
- Integration/component test: network failure renders the AC-04 message and stops showing progress

## Deps

T3, T4, T5, T6, T7

## Estimate

M
