---
id: T12
epic: quote-engine
project: print-marketplace
wave: 5
priority: Must
estimate: M
blocks: [T15, T16]
blocked_by: [T10]
status: todo
prd_refs: [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06]
sad_refs: ["gap — not in §5, see _epic.md scope note"]
adr_refs: ["0001"]
---

# T12 · UI — WebSocket quote client + breakdown display

**Epic:** [[_epic|quote-engine]]

## Why — and a scope caveat to read first

**This task is not backed by an sad.md §5 building block** — the SAD's building-block view covers only the backend `src/modules/quote-engine/` directory. It is derived instead from two sources that *do* require it: ADR-0001's explicit "Negative" consequence ("quote-requesting needs its own WebSocket-based client code, not a reuse of the existing XHR wrapper") and the PRD's user-facing ACs (AC-01 "confirms the quote to the user," AC-03 "the user views the quote... shown... broken into its components," AC-04/05/06 user-facing error text). Flagged in `_epic.md`'s scope note for the architect to formalize in a future sad.md revision — this task proceeds on the most reasonable interpretation in the meantime, per break-tasks protocol (don't block on a documentation gap when the behavior is unambiguously required).

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-01, AC-02, AC-03, AC-04, AC-05, AC-06
- ADR: [[../adr/0001-websocket-push-for-quote-result.md]] (Negative consequence — new client-side pattern needed)
- Parity ref: `src/ui/upload-client.ts` (existing XHR wrapper — mirror its role, not its transport), `src/ui/errors.ts` (existing backend-message → user-text mapping — extend with `quote.*` codes, never surface raw backend `message` per CLAUDE.md UI architecture note), `src/ui/app.tsx` (existing `idle → uploading → success | error` state machine — extend or compose a parallel one for the quote step, per `docs/features/stl-upload-ui/kb-extending-state-machine.md`)

## Scope

- `src/ui/quote-client.ts` — opens a WebSocket to quote-engine's endpoint for a given file-id, resolves/rejects with the `quote.done`/`quote.error` payload or a client-side "connection dropped" failure (ADR-0001's Negative consequence — never assume a dropped connection means the slice itself failed, just that the result is unknown to the client). Expose a `close()` method that closes the WS from the client side — this is what T16's "Back to start" button calls; the server's `close` handler (T10) does the actual slice cancellation, this client just has to close cleanly without throwing on an unresolved request.
- Extend `src/ui/errors.ts` with the four `quote.*` codes (`quote.not_found`, `quote.unslicable`, `quote.exceeds_build_volume`, `quote.rate_limited`) mapped to user-facing text — AC-05 and AC-06 share one backend code (`quote.not_found`) and should share one user-facing message too (no wording difference that would leak existence, consistent with the backend's AC-06 contract).
- A quote-result display (new component or an extension of the existing `UploadResult` pattern) showing price, time, and the AC-03 breakdown (time cost, material cost, margin) as distinct line items, not just a total.
- Read `docs/features/stl-upload-ui/kb-extending-state-machine.md` before touching `app.tsx` — follow its documented extension pattern rather than inventing a new one.

## Acceptance criteria (GWT)

- [ ] **AC-ui-1 (AC-01 happy path display):** Given a successful `quote.done` push, when rendered, then the user sees price and print time.
- [ ] **AC-ui-2 (AC-03 breakdown display):** Given a successful quote, when rendered, then time cost, material cost, and margin are shown as separate values, not folded into one total.
- [ ] **AC-ui-3 (AC-02/04/05/06 error display):** Given any `quote.error` code, when rendered, then the user sees the mapped plain-text message from `errors.ts` — never the raw backend `{code, message}` payload.
- [ ] **AC-ui-4 (dropped connection ≠ assumed failure wording):** Given the WS connection drops mid-slice (no `quote.done`/`quote.error` received), when rendered, then the user sees a message consistent with "connection lost, try again" — not a message implying the model itself failed to slice.

## Checklist

- [ ] Step 1 — Read `docs/features/stl-upload-ui/kb-extending-state-machine.md`.
- [ ] Step 2 — Implement `quote-client.ts`.
- [ ] Step 3 — Extend `errors.ts` with the four `quote.*` mappings (AC-05/AC-06 sharing one message).
- [ ] Step 4 — Implement/extend the display component for AC-ui-1/2.
- [ ] Step 5 — Wire the dropped-connection case (AC-ui-4).
- [ ] Step 6 — Component + state-machine tests for AC-ui-1..4 (happy-dom, matching existing `app.test.tsx` patterns).

## Edge cases

| Case | Behavior |
|---|---|
| User navigates away mid-slice | WS connection closes client-side; no special handling needed beyond normal cleanup — the server-side behavior for this is T10's AC-qr-5, already decided there. |
| Filename or other user content in any error path | Rendered as text only, never interpreted as HTML — same discipline as the existing upload UI (CLAUDE.md UI architecture note). |

## Definition of Done

- [ ] All AC green.
- [ ] No raw backend `message` ever reaches the rendered UI — confirmed by test, not just code review.
- [ ] PR linked back to this file; `tracker.md` updated to `done`.
