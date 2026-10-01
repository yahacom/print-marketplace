---
status: In review
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-10-01"
feature_size: S
stage: "13"
ticket: "<TBD>"
---

# T13 — Upload UI visual styling & layout

**Links:** PRD stl-upload-ui (PRD.md:23 — "no cosmetic/animated polish" explicitly deferred at MVP; this task picks that up) · Builds on T3 (UploadForm) · T6 (UploadProgress) · T7 (UploadResult) · T8 (state-machine wiring)

## Summary

Add a dedicated stylesheet and restructure the upload screen so idle, uploading, and error states share one persistent drop-zone + Upload-button control with status text underneath, while success becomes a distinct confirmation screen with a "Back to start" button. No new dependencies; CSS ships via a plain `.css` file bundled by the existing esbuild `build:ui` pipeline.

## Scope

- New `src/ui/styles.css`, imported from `src/ui/main.tsx` (esbuild emits `dist-ui/main.css` automatically on `--bundle`); add `<link rel="stylesheet" href="./main.css">` to `src/ui/index.html`.
- Page: full-viewport smooth gradient background; upload card/form horizontally and vertically centered in the viewport; body font is a system sans-serif stack (e.g. `-apple-system, "Segoe UI", Roboto, sans-serif`), no serif/monospace anywhere.
- Drop zone: visible rectangular area, dashed border, 4px width, rounded corners (shared radius token with the button).
- Hidden native `<input type="file">` (kept as the drag-and-drop target and for accessibility) paired with a visible custom "Upload" button that opens the file picker via a ref-triggered `.click()`, as an alternative to dragging a file in. Dropping a file still uploads immediately, same as today — this task does not add a staged "selected but not uploaded" step.
- Upload button: flat, rounded corners, gradient background in idle state. During upload: `disabled`, label changes to "Uploading...", and a second background layer fills left→right sized to `loaded/total` from the existing `UploadProgressEvent` (no new polling — reuse T4/T8's progress data; no live percentage text, label stays static).
- Status/error text renders in a fixed region directly underneath the drop zone, for both "uploading" and "error" states (reuse the existing `role="alert"` error markup from T3/T7).
- Error state: drop zone + Upload button remain active/clickable, identical to idle, so the user can immediately pick another file — no extra "retry" action needed. Only the text underneath differs.
- Success state: replaces the drop-zone/button control with a confirmation message and a "Back to start" button, wired to the already-present-but-unused `transitions.reset()` in `app.tsx` to return to `idle`.
- Component restructuring implied by the above: fold the uploading-state button/progress rendering and the error-state text rendering into an extended `UploadForm` (taking a mode/progress/error prop), so `App` renders `UploadForm` for `idle | uploading | error` and a distinct success screen only for `success`. `UploadProgress.tsx`'s standalone `<progress>` element is retired in favor of the in-button fill; its percentage-text test coverage moves to the new button states.
- Interaction states (CSS-only, no JS):
  - Drop zone: distinct hover style on mouse-over; a visually stronger highlight (e.g. border color/background shift) while a file is dragged over it (`dragenter`/`dragover`), reverting on `dragleave`/`drop`.
  - Upload button: hover state (idle only — no hover change once `disabled` during upload) and a visible `:focus-visible` outline/ring for keyboard navigation, meeting WCAG AA contrast against the background.
  - "Back to start" button: same hover + `:focus-visible` treatment as the Upload button, for consistency.
  - Progress fill: animate its width with a short CSS `transition` (e.g. `width 150–250ms ease-out`) as `loaded/total` updates, instead of jumping instantly.
  - All state transitions (hover, focus, progress fill) use simple CSS `transition`/`:hover`/`:focus-visible` — no JS-driven animation, no easing libraries.

## Out of scope

- Exact color values — implementer chooses an accessible, cool-toned gradient for the page background and a complementary gradient for the button (WCAG AA contrast against text).
- Live numeric percentage in the button label (stays as static "Uploading..." text).
- Decorative/entrance animations (e.g. fade-ins, page-load motion, confetti on success) and any JS-driven or easing-library animation — interactions are limited to the CSS-only hover/focus/drag/progress-fill transitions listed in Scope.
- Responsive/mobile breakpoints (desktop-first; follow-up task if needed).
- Dark mode.

## DoD

- Manual/visual QA: page background is a full-viewport gradient; the form is centered in the viewport at common desktop widths.
- Manual/visual QA: drop zone shows a 4px dashed border with rounded corners in idle, uploading, and error states.
- Manual/visual QA: drop zone highlights on dragover, Upload/Back-to-start buttons show a hover state and a visible `:focus-visible` ring when tabbed to, and the progress fill animates smoothly rather than jumping.
- Component test: Upload button is `disabled` and shows "Uploading..." while `state.status === "uploading"`; its fill width reflects `loaded/total`.
- Component test: in the error state, the drop zone and Upload button remain enabled, and selecting/dropping a new file starts a new upload with no extra click.
- Component test: success screen renders a "Back to start" button that calls `transitions.reset()` and returns `state.status` to `"idle"`.
- `npm run typecheck`, `npm run lint`, and `npm test` pass with the restructured components.

## Deps

T3, T6, T7, T8

## Estimate

S
