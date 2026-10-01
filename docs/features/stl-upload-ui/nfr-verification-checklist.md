# NFR verification checklist — stl-upload-ui (QG-1)

Manual pre-demo check for [SAD §10 QG-1](sad.md#10-quality-requirements). No automated browser-perf test exists
(accepted debt, SAD §11). The UI contains no timing instrumentation, so all timestamps are captured from the
browser DevTools console with a pasted snippet — no source changes needed.

## Targets (PRD §6 NFR)

| # | Target                                                        | Pass condition                         |
| - | ------------------------------------------------------------- | -------------------------------------- |
| 1 | Time-to-first-visible-feedback after file drop/select         | ≤ 2000 ms                              |
| 2 | Progress feedback cadence during upload                       | ≥ 1 update/sec (max gap between updates ≤ 1000 ms) |
| 3 | Submit → result shown (p95)                                   | ≤ 10500 ms                             |

Target 3 is a p95; a single dry run gives one sample, so record it as an indicative value and repeat ≥ 20 times
if a statistical claim is needed.

## Setup

1. `npm run build:ui` (emits `dist-ui/`).
2. `npm start` — Fastify serves `dist-ui/index.html` at `GET /` (T9).
3. Open the served URL in a Chromium-based browser with DevTools open, cache disabled, no throttling
   (or record the throttling profile used).
4. Prepare a valid STL near the upper end of the allowed size so the upload lasts several seconds
   (progress cadence cannot be judged on a sub-second upload).

## Measurement snippet

Paste in the DevTools console **before** selecting the file. It logs `performance.now()` at file selection, at
every DOM change (first one = first visible feedback; each later one = a progress/result render), and prints the
three metrics when the result appears.

```js
(() => {
  const root = document.body;
  const marks = { select: null, renders: [] };
  const input = document.querySelector('input[type="file"]');
  input.addEventListener("change", () => { marks.select = performance.now(); }, { capture: true });
  new MutationObserver(() => marks.renders.push(performance.now())).observe(root, {
    subtree: true, childList: true, characterData: true, attributes: true,
  });
  window.__qg1 = () => {
    const r = marks.renders;
    const gaps = r.slice(1).map((t, i) => Math.round(t - r[i]));
    console.table({
      firstFeedbackMs: Math.round(r[0] - marks.select),
      maxGapBetweenRendersMs: Math.max(...gaps),
      submitToResultMs: Math.round(r[r.length - 1] - marks.select),
      renderCount: r.length,
    });
  };
})();
```

If the file is dropped rather than chosen via the input, dispatch the drop on the drop zone instead and set
`marks.select` manually in the `drop` handler — or use the file-input path, which is simpler.

## Procedure

1. Run the snippet, select the file, wait for the success (or error) screen.
2. Run `__qg1()` and copy the table into the results section below.
3. Judge each target:
   - **Target 1:** `firstFeedbackMs` ≤ 2000.
   - **Target 2:** `maxGapBetweenRendersMs` ≤ 1000 while the progress screen is showing. Note: the ignored
     final gap (last progress render → result render) is covered by target 3, not this one. Browsers throttle
     `progress` events on very fast localhost uploads, so use a throttled network profile if the upload completes
     in under a second.
   - **Target 3:** `submitToResultMs` ≤ 10500.
4. Also confirm visually: no raw backend message or stack trace appears on any error path (QG-2 sanity).

## Dry-run result

| Field            | Value                     |
| ---------------- | ------------------------- |
| Date             | _pending_                 |
| Tester           | _pending_                 |
| Browser/version  | _pending_                 |
| Network profile  | _pending_                 |
| File (size)      | _pending_                 |
| firstFeedbackMs  | _pending_ (target ≤ 2000) |
| max render gap   | _pending_ (target ≤ 1000) |
| submitToResultMs | _pending_ (target ≤ 10500)|
| Verdict          | _pending — all three targets met / flagged miss + follow-up_ |

**Status: dry run NOT yet performed.** It needs a real browser; it was not run by the automated Ralph loop and
no values have been fabricated. A human must fill in the table above to close T10.
