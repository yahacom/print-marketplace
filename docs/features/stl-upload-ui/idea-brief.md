---
status: Confirmed
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-30"
feature_size: <XS|S|M|L|XL>     # set by sdlc:classify-size, not here
stage: "01"
ticket: "<TBD>"
value_score:
  rice: 80
  state: confirmed
  confirmed_at: "2026-09-30"
feasibility_state: confirmed
---

<!-- Stage 01 → see SDLC/plugin/skills/interview/SKILL.md -->
<!-- Why: capture the idea before it's forgotten or retold incorrectly -->

# Idea Brief — stl-upload-ui

## 1. Raw idea
A single-page web UI, scoped to the upload step of the MVP flow only. A regular (non-developer) user drags an STL file onto the page, the page sends it to the already-working backend upload endpoint, and shows the result — accepted (with a file-id) or rejected (plain-language reason: wrong format/extension, or too large). The page is architected as a state machine (form → uploading → result) so future states (quote processing, order-confirmation) can be added later — but those states are NOT built now, because the quote-engine and order-confirmation backends don't exist yet (quote-engine has no PRD or code, only a plan document; order-confirmation has a PRD/SAD but all 16 implementation tasks are "Not started"). No 3D model preview in v1. There is an external deadline: a demo for a stakeholder/investor.

## 2. Problem
Today, zero non-technical users can use the existing stl-upload API — the only way to reach it is curl/Postman. The MVP flow (upload → quote → confirm/decline) cannot be demonstrated to, or used by, any real user, even though the upload step's backend is fully implemented and tested (16 closed tasks, `src/modules/stl-upload`). This is a demo/validation blocker, not a documented user complaint — the product is pre-launch, with no production traffic yet.

## 3. Users
Every prospective marketplace user who wants a print quote must pass through this screen first — 100% of the funnel's entry point. The nearest concrete audience is the stakeholder/investor watching the upcoming demo, plus early testers.

## 4. Why now
The upload backend just shipped ("Finish stl-upload"), so giving it a front door is immediately actionable — no other feature is blocking it. There is also an external trigger: a demo for a stakeholder/investor, which requires the MVP flow to be shown to an actual person, not just exercised via an API client.

## 5. Out of scope
- Quote-processing screen — quote-engine has no backend yet (plan document only).
- Order-confirmation screen — backend PRD/SAD exist but all 16 tasks are "Not started".
- 3D model preview in the browser.
- Login/auth (MVP-wide exclusion, per [`overview.md`](../../overview.md)).
- Payments, checkout, order fulfillment (MVP-wide exclusion).
- Multi-vendor matching/routing (MVP-wide exclusion).

## 6. Competitive analysis
| # | Product · URL | Features | Value per feature (1-5) | Gap |
|---|---|---|---|---|
| 1 | Shapeways · shapeways.com/upload-3d-print-files-models | Drag-and-drop with click-to-browse fallback, batch upload, unit selection, multi-format | Drag-and-drop UX: 5 | No unit-selection step — simpler by design, not a gap we're closing |
| 2 | Craftcloud (All3DP) · craftcloud3d.com/en/upload | No-login instant-quote flow, drag-and-drop up to 500MB, 35+ formats | No-login flow: 5 (matches our precedent) | We don't chain into an instant quote yet — quote-engine doesn't exist |
| 3 | i.materialise · i.materialise.com/en/Getting-Started | Prominent site-wide upload button, unit selection, zip-fallback for unsupported formats | Graceful degradation: 4 | We hard-reject non-STL with no fallback — accepted gap (matches stl-upload PRD non-goal) |

Footnotes: search performed 2026-09-30, queries "Shapeways upload 3D model file drag and drop UI", "Craftcloud by All3DP upload STL instant quote website", "i.materialise upload 3D file get quote website UI".

## 7. Strategic approaches

### Approach A — Bare-Bones Upload & Confirm
- **Thesis**: Give users a single page to drag in an STL and see it accepted or rejected in plain language, so the demo can show the real upload API working end-to-end.
- **For whom**: The stakeholder/investor watching the demo, and early testers just verifying the upload flow works.
- **Outcome metric**: Time-to-first-successful-upload — currently impossible (no UI) → under 60 seconds for a first-time user.
- **Key trade-off**: No polish (no progress-bar nuance, no retry flows, minimal styling) in exchange for shipping before the deadline.
- **Effort signal**: S — one page, one API call, drag-and-drop plus success/error states, no additional screens or state management.
- **Recommended?** ◯

### Approach B — Instant Quote Teaser Upload
- **Thesis**: Turn the upload moment into a live "wow" by showing animated progress and a rough size/complexity readout the instant a file lands, so the demo feels more impressive — even though no real slicing happens yet.
- **For whom**: Stakeholder/investor demo audience who need to feel the product is "already working."
- **Outcome metric**: Demo engagement (qualitative "wow" reaction) — baseline 0 (no upload UI exists) → visible live feedback within 2s of drop.
- **Key trade-off**: The animated readout is cosmetic polish on top of a single synchronous API call — it risks being mistaken by stakeholders for real slicing/pricing functionality.
- **Effort signal**: M — same core drag-and-drop and validation as A, plus staged/animated feedback states and error-state polish.
- **Recommended?** ◯

### Approach C — Guided Upload with Clear States
- **Thesis**: Give non-technical users a simple drag-and-drop upload page that clearly shows progress and either a success confirmation or a plain-language reason for failure, built as a clean state machine so later stages can extend it.
- **For whom**: First-time/non-technical demo users and early testers who need confidence the upload worked, without extra visual polish.
- **Outcome metric**: Successful non-technical upload completion rate — baseline 0% (no UI today) → 90%+ in demo/test sessions without developer assistance.
- **Key trade-off**: Skips animated/branded polish to guarantee the form → uploading → result state machine is solid and demo-ready under deadline pressure.
- **Effort signal**: M — drag-and-drop plus three well-defined states and error-message mapping is more than a bare form, but avoids any preview/animation work.
- **Recommended?** ●

## 8. Multi-perspective feedback

### Engineer
- A: minimal state → low bug surface, but no structure to extend into quote/order later (likely a rewrite).
- B: animated/staged transitions add timing-dependent edge cases; highest debt risk since the cosmetic layer gets discarded once real quoting lands.
- C: requires enumerating the API's error codes up front; best long-term integration surface for future states; contained over-engineering risk.

### Executive
- A: safe and honest about maturity, but a thin demo that may undersell the vision.
- B: highest short-term "wow," but a fabricated readout risks misleading stakeholders about how much is real — credibility risk if probed; thrown-away effort.
- C: professional and trustworthy without overstating capability; builds reusable equity that pays off directly in the next stages.

### UX-researcher
- A: low onboarding curve, but no progress feedback risks "did it hang?" on larger files, and plain error text may not say what to do next.
- B: actively misleading — a "complexity readout" implies analysis that isn't happening; extra animation adds failure surface (stuck spinner, teaser-then-error).
- C: clear form → uploading → result mental model reduces ambiguity; mapped, specific errors build trust on failure.

### Synthesis matrix
|         | Engineer | Executive | UX |
|---------|:--------:|:---------:|:--:|
| App. A  | 0        | 0         | 0  |
| App. B  | -        | -         | -  |
| App. C  | +        | +         | +  |

All three perspectives independently converged on C as the only positive-rated approach; B was rated negative by all three for the same underlying reason (fabricated feedback misleads the audience and creates throwaway work).

## 9. Trade-offs and edge cases

### Trade-offs per approach
| Approach | Pros | Cons |
|---|---|---|
| A | Fastest, lowest risk, fully honest about maturity | No reusable foundation; poor failure detail; likely rework for later stages |
| B | Highest demo "wow factor" | Misleading to stakeholders; adds technical debt and failure-surface; effort spent on throwaway polish |
| C | Honest, reusable state machine, specific error mapping, unanimous positive multi-perspective signal | Slightly higher effort than A; needs the API's error-code catalog defined up front |

### Edge cases
- Non-STL file selected — plain-language rejection mapped from the API's 400 `upload.invalid_format`.
- File exceeds the 50MB limit — 413 handling, with a message distinct from the format rejection.
- Empty (0-byte) file — API treats as invalid format; UI must not crash or divide-by-zero on progress math.
- Network failure or unreachable API mid-upload — UI transitions to a distinct "couldn't reach the server" state, not an indefinite hang.
- Multiple files or a folder dropped at once — API accepts one file only; extras must be rejected before the call.
- Browser/OS without full drag-and-drop support — needs a visible "click to browse" fallback so the drop isn't a silent no-op.
- User navigates away or refreshes mid-upload — no persisted state; the in-flight request is simply abandoned, restart from empty form.
- Large file on a slow/congested connection (e.g., demo-venue wifi) — uploading state must show real progress, not just a spinner.

## 10. Risks
- **Unsanitized filename rendering (XSS)** — if the result screen renders the uploaded filename as raw HTML instead of text, a filename crafted to contain a script payload (extension-only checks don't block this) can execute in front of the stakeholder during the live demo. Top devil's-advocate finding — must be a hard PRD requirement (filenames rendered as text, never markup), not optional hardening.
- Backend unreachable during the demo itself (venue network, firewall, stale environment URL) — reads on stage as a frozen spinner with no diagnostic signal.
- Error responses leaking raw backend detail (stack traces, internal URLs) instead of one of the three defined plain-language outcomes.
- Human error live on stage — presenter drops the wrong file type; a generic error message reads as "the demo is broken" rather than "validation working as designed."

## 11. RICE — Claude proposed
- **Reach (R)**: 100 — rough estimate for the quarter (demo audience + early testers), not production data; the product is pre-launch, so this is a deliberately conservative estimate rather than a measured number (§3 Users, §11.3 Confidence reflects this).
- **Impact (I)**: 3 (massive) — without this UI, no non-technical user can reach any part of the MVP; it is a total blocker for demo/validation (§2 Problem, Executive perspective §8: Approach C "best long-term ROI").
- **Confidence (C)**: 0.8 — scope, drag-and-drop requirement, and the chosen approach are all locked from the Socratic dive; remaining TBDs are narrow (exact demo date, exact API error-code catalog — §15 Open questions).
- **Effort (E)**: 3 person-weeks — Effort signal M from §7 Approach C, scaled to a solo developer building a single page with one API integration and no auth/storage layer (cf. stl-upload backend, feature_size S, 16 tasks).
- **RICE = 100 × 3 × 0.8 / 3 = 80**
- **State**: confirmed

## 12. Feasibility — Claude proposed
- [☐] **Tech**: Open, honestly. `package.json` has zero frontend dependencies today (only `fastify` + `@fastify/multipart` for the backend) — this is the first UI feature in the repository, so the frontend-tooling choice is a genuine unresolved item, not a hidden guess. Deferred to architecture design (gate 3), not decided in this brief.
- [☑] **Skills**: Confirmed — the same solo developer already shipped an equivalently-sized backend feature (stl-upload, 16 tasks, TypeScript/Node) through the full SDLC pipeline to Done; general engineering and HTTP-integration skills transfer directly.
- [☑] **Time**: Confirmed — 3 person-weeks (§11 Effort) is judged to fit the demo deadline, by analogy to stl-upload (feature_size S) shipping in one cycle.
- **State**: confirmed

## 13. Recommendation
**Selected: Approach C — Guided Upload with Clear States** — All three multi-perspective reviewers (Engineer, Executive, UX) independently rated Approach C "+" and Approach B "-" for the same underlying reason: a fabricated progress/complexity readout risks misleading the stakeholder/investor audience about how much of the product actually works (§8 synthesis matrix). This aligns with the RICE score of 80 (§11), driven by Impact=3 since this is a total blocker for any non-technical user reaching the MVP. Feasibility is 2/3 confirmed — Skills and Time are solid by direct analogy to the already-shipped stl-upload backend, while Tech is honestly left open since this is the repo's first frontend feature (§12). Competitively, Craftcloud and Shapeways both validate drag-and-drop-without-login as baseline UX (§6), but neither runs a fake-progress teaser the way Approach B does — Approach C matches industry norms without the trust risk Approach B introduces.

**Locked-in pointer**: The upload page is a state machine (form → uploading → result) with plain-language, per-error-code messaging and no cosmetic/animated polish; quote and order-confirmation states are explicitly out of scope until their backends exist. This is the input write-prd must build from.

## 14. Parked & rejected approaches
| # | Approach | Status | Reason | Revisit trigger |
|---|---|:---:|---|---|
| A | Bare-Bones Upload & Confirm | parked | Fastest option, but engineer/executive/UX reviews scored it neutral (0) — no reusable foundation for the next MVP stages | Revisit only if the demo deadline collapses to days and even Approach C's scope must be cut further |
| B | Instant Quote Teaser Upload | rejected | Unanimous negative rating (-) across all three perspectives — fabricated feedback risks misleading the stakeholder/investor audience | Revisit only once quote-engine is real and progress feedback can reflect actual slicing, not a cosmetic teaser |

## 15. Open questions
- [ ] Exact demo date — owner: Yakiv Vakoliuk, due: TBD.
- [ ] Full catalog of stl-upload API error codes/messages to map into plain-language UI copy (currently only `upload.invalid_format` and the 413 size case are documented in the OpenAPI spec) — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] Frontend tooling choice (framework vs. plain HTML/JS) — explicitly deferred to architecture design (gate 3), not this brief, per §12 Tech feasibility.

## Related
- [`overview.md`](../../overview.md) — MVP scope and flow this feature's upload step belongs to.
- [`docs/features/stl-upload/`](../stl-upload/) — the backend API this UI consumes (PRD, OpenAPI contract, ADRs).
- [`docs/features/quote-engine/`](../quote-engine/) and [`docs/features/order-confirmation/`](../order-confirmation/) — downstream MVP steps, explicitly out of scope here (§5).

## DoD self-check
- [x] 15 sections present
- [x] No anti-pattern terms (Postgres/Redis/etc.)
- [x] Length ≤ 5 pages (~2200 words)
- [x] Frontmatter status: Confirmed
- [x] RICE confirmed (state: confirmed)
- [x] Feasibility confirmed (state: confirmed)
- [x] Recommendation present with rationale citing 4 upstream sections (§6, §8, §11, §12)
