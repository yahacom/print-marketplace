---
id: T16
epic: quote-engine
project: print-marketplace
wave: 5
priority: Must
estimate: S
blocks: [T15]
blocked_by: [T10, T12]
status: done
prd_refs: [AC-01, AC-02]
sad_refs: ["gap — not in §5, see _epic.md scope note (same gap as T12)"]
adr_refs: ["0001"]
created: 2026-10-02
---

# T16 · UI — "Slicing..." wait state + "Back to start" cancel

**Epic:** [[_epic|quote-engine]]

## Why

Added after the initial breakdown, at the user's explicit request: once a file finishes uploading, the UI must open the WebSocket (T12's `quote-client`) and show a `"Slicing..."` wait state with a **"Back to start"** button while waiting for `quote.done`/`quote.error`. Pressing the button closes the WebSocket and returns the user to the upload form — and, on the backend, that close must hard-kill the in-flight PrusaSlicer subprocess (decided via T10/T7/T4/T8's cancellation plumbing, amended alongside this task) rather than let an abandoned slice occupy the single worker.

This task owns the **state-machine wiring and the wait-state UI**; T12 already owns the WS client primitive and the result/error display. Splitting it this way keeps each task's diff and AC set focused: T12 is "can we talk to the backend and show what it says," T16 is "what does the user see *while waiting*, and what happens if they bail."

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-01 (confirms the quote to the user — the wait state is the gap between request and confirmation), AC-02 (clear explanation on failure — a user-initiated cancel is the same "clear explanation" principle applied to a user-initiated exit, not a backend failure)
- ADR: [[../adr/0001-websocket-push-for-quote-result.md]] (this is the "live progress / mid-flight state" surface ADR-0001's Positive consequence anticipated: "leaves room to add live progress messages later... without a protocol change")
- Depends on: [[T10-quote-routes-websocket|T10]] (server-side `close` → `cancelQuote`, amended for this task), [[T12-ui-websocket-quote-client|T12]] (`quote-client.ts`'s `close()` method, and the state-machine extension pattern from `docs/features/stl-upload-ui/kb-extending-state-machine.md`)
- Parity ref: `src/ui/app.tsx` (existing `idle → uploading → success | error` state machine), `src/ui/components/UploadProgress.tsx` (existing in-progress UI pattern, if present — mirror its shape for the new "slicing" state)

## Scope

- Extend `app.tsx`'s state machine with a `slicing` state, entered immediately after a successful upload (no manual trigger — the quote request starts automatically once the file-id is known, per the user's description: "once file uploaded we should start slicing on BE according to existing tasks").
- While in `slicing`, render a `"Slicing..."` indicator and a **"Back to start"** button — no other interactive element (no cancel-and-retry-same-file shortcut; "Back to start" always returns to a clean upload form, matching the existing `UploadResult`'s "upload another file" pattern if one exists).
- Wire "Back to start": calls `quote-client.close()` (T12), transitions the state machine back to `idle`, discards any in-flight quote-client instance. Does **not** wait for a server acknowledgment of the cancel — the UI returns to idle immediately; the backend's cancellation (T10's `close` handler) happens independently and has no further effect on this screen.
- On `quote.done` / `quote.error` arriving while still in `slicing`, transition to the existing `success`/`error` display (T12's responsibility to render; T16 just owns the state transition out of `slicing`).

## Acceptance criteria (GWT)

- [x] **AC-ws-1 (auto-start on upload success):** Given a file upload succeeds, when the state machine would otherwise go to an upload-success state, then it instead opens the quote WebSocket and enters `slicing` — no extra user action required to start slicing.
- [x] **AC-ws-2 (wait-state UI):** Given the state machine is in `slicing`, when rendered, then the user sees a `"Slicing..."` indicator and a "Back to start" button, and no price/time/breakdown content (that only appears after `quote.done`).
- [x] **AC-ws-3 (Back to start closes WS and resets):** Given the user is in `slicing` and clicks "Back to start", when the click handler runs, then `quote-client.close()` is called, the state machine transitions to `idle`, and the upload form is shown again — ready for a new file.
- [x] **AC-ws-4 (Back to start triggers server-side cancel):** Given the user clicks "Back to start" mid-slice, when the WS closes, then (via T10's amended `close` handler) the backend kills the PrusaSlicer subprocess — verified at the integration level in T13, referenced here as the contract this button relies on.
- [x] **AC-ws-5 (no stale state after cancel):** Given the user cancels and then uploads a new file, when the new upload succeeds, then a fresh `quote-client` instance is used — no leftover listener from the cancelled WS fires a late `quote.done`/`quote.error` into the new flow.
- [x] **AC-ws-6 (natural completion still works):** Given the user does *not* click "Back to start" and the slice completes normally, then the state machine transitions out of `slicing` into T12's existing success/error display, unaffected by this task's changes.

## Checklist

- [x] Step 1 — Read `docs/features/stl-upload-ui/kb-extending-state-machine.md` (if not already fresh from T12) before touching `app.tsx` again.
- [x] Step 2 — Add the `slicing` state + transition from upload-success.
- [x] Step 3 — Build the wait-state component (`"Slicing..."` + "Back to start" button).
- [x] Step 4 — Wire the button's `onClick` to `quote-client.close()` + state reset (AC-ws-3).
- [x] Step 5 — Guard against stale listeners from a cancelled client affecting a later flow (AC-ws-5) — e.g. a generation/id check on the client instance, or always constructing a fresh `quote-client` per upload and discarding the old reference entirely.
- [x] Step 6 — Component + state-machine tests for AC-ws-1..6 (happy-dom, matching `app.test.tsx` patterns).

## Edge cases

| Case | Behavior |
|---|---|
| User clicks "Back to start" twice quickly | Second click is a no-op — `quote-client.close()` on an already-closed/closing connection should not throw (align with T12's `close()` contract). |
| `quote.done` arrives in the same tick as the user clicking "Back to start" | UI-side race: whichever the state machine processes first wins; since the user already clicked "back," the reasonable behavior is to honor the cancel and discard the late result — document this choice in the test rather than leaving it to whatever the event loop happens to do. |
| Upload form reappears but a previous slice's Firestore draft was never written (expected, per T8's AC-qs-7/8) | No UI-visible consequence — the user never asked to see that quote, and order-confirmation has nothing to act on for a job that was cancelled before persisting. |

## Definition of Done

- [x] All AC green.
- [x] No raw backend `message` reaches the UI in any new code path (same discipline as T12).
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- Added `components/SlicingWait.tsx` ("Slicing..." + the only button, "Back to start"), the `slicing` state / `transitions.startSlicing`, and in `app.tsx` an `activeQuote` ref: results are applied only while `activeQuote.current` is still the request that produced them, which is what makes a late result from a cancelled/replaced request a no-op (AC-ws-5) and lets a click that races a result win (the edge case). `main.tsx` passes the real `requestQuote`. Tests: `app.slicing.test.tsx` (fake `startQuote`, real `App`).
- ASSUMPTION: auto-start is enabled by an **optional `startQuote` prop on `App`**, which only `main.tsx` supplies; `<App />` without it still stops at the upload-success screen. The alternative (always start the quote) would have made the existing `app.integration.test.tsx` / `app.test.tsx` fail (they assert the upload-success screen and have no WebSocket), and the rules forbid changing tests. The shipped UI does auto-start, so AC-ws-1 holds in the real app. A human may prefer to make it the default and update those older tests.
- ASSUMPTION: unmounting `App` closes any live quote request (cleanup effect), so leaving the page also cancels server-side.
- AC-ws-4 is the contract "UI closes the socket"; the server-side kill is exercised by T10's close-handler test and T4/T7 cancellation tests. A full browser-to-SIGTERM scenario is not automated (T13's suite has no cancel scenario).
- The slicing screen shows no upload confirmation or filename — only the indicator and the button, per AC-ws-2.
- `dist-ui/` was rebuilt locally (`npm run build:ui` succeeds); it is gitignored.
