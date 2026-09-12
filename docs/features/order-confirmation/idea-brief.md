---
status: Confirmed
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-10"
feature_size: <XS|S|M|L|XL>     # set by sdlc:classify-size, not here
stage: "01"
ticket: "<ticket-id>"
value_score:
  rice: "TBD — Reach unresolved, see §11"
  state: proposed
  confirmed_at: ""
feasibility_state: confirmed
---

<!-- Stage 01 → see SDLC/plugin/skills/interview/SKILL.md -->
<!-- Why: capture the idea before it's forgotten or retold incorrectly -->

# Idea Brief — order-confirmation

## 1. Raw idea
After quote-engine produces a quote, show the user a screen with the price/print time and two buttons — confirm or decline. Confirming creates an order record (minimal, no payment). This is the narrowest reading of the README: order-confirmation as the proxy step between the quote and a future checkout, without which quote-engine "hangs in the air" — it computes a price but never persists it.

## 2. Problem
quote-engine (still in development) will compute a quote — price, print time, material, cost breakdown — for an uploaded model, but nothing in the current MVP flow persists the user's decision on that quote. Without order-confirmation, the 3-step MVP flow (upload → quote → confirm/decline) cannot close end-to-end. Per the feature owner, this is currently a technical/pipeline-completeness gap, not a documented user complaint: no traffic or support-ticket evidence exists yet — quote-engine has not shipped, so nobody has hit this in production.

## 3. Users
Every user who reaches a valid quote (MVP-flow step 2) is required to pass through order-confirmation next — there is no segment that skips it. No usage data exists yet (pre-launch); Reach is unresolved (§11).

## 4. Why now
order-confirmation is the third and final step of the MVP flow (upload → quote → confirm/decline); without it the flow cannot be demoed or validated end-to-end even once quote-engine ships. The team is building it ahead of quote-engine, betting on quote-engine's eventual output shape, so the flow is ready to close the moment quote-engine lands.

## 5. Out of scope
- Payments and checkout (MVP-wide exclusion, see [`overview.md`](../../overview.md)).
- Order fulfillment, shipping, and post-order tracking (MVP-wide exclusion).
- Multi-vendor matching/routing and vendor-facing tooling (MVP-wide exclusion).
- Quote editing, re-quoting, or decision history/reversal — one quote gets one irreversible decision in v1 (carried over from Approach A, see §13 Locked-in pointer).

## 6. Competitive analysis
| # | Product · URL | Features | Value (1-5) | Gap |
|---|---|---|---|---|
| 1 | Xometry · xometry.com/quoting/home | Instant quote → checkout; some post-processing fees reportedly hidden (~12.4%, per review) | 3 | No transparent confirm step; fee opacity is what we'd avoid |
| 2 | Craftcloud · craftcloud3d.com/en/upload | Instant quotes across 180+ partners, multi-supplier comparison | 4 | Straight from comparison to order; no "decide without paying" screen |
| 3 | Shapeways · support.shapeways.com | Discloses all price line items upfront | 4 | Good transparency precedent, but still proceeds straight into checkout |
| 4 | Materialise OnSite · i.materialise.com | Instant quote on upload, moves into production scheduling | 3 | No standalone confirm/decline step separate from ordering |
| 5 | PrintQuote (Shopify app) · apps.shopify.com/3d-print-quote | Upload → price → checkout immediately | 3 | Collapses quote and commitment into one action |

Footnote: research performed 2026-09-10 via web search "Xometry Craftcloud Shapeways instant quote confirm order 3D printing marketplace flow" and "3D print marketplace upload STL get instant quote order confirmation UX".

## 7. Strategic approaches

### Approach A — Confirm/Decline Only
- **Thesis**: Let a user record a simple yes-or-no decision on their quote so the upload-to-decision flow can complete without any extra steps.
- **For whom**: First-time users testing whether the MVP flow works end-to-end at all.
- **Outcome metric**: No usable baseline exists yet (quote-engine isn't live) — proposed target: 100% of generated quotes reach a recorded confirm/decline decision with zero manual intervention.
- **Key trade-off**: No edit, expiry, re-quote, or decision-history handling — one quote gets one irreversible decision.
- **Effort signal**: S — one decision captured against one existing quote, no new states or screens beyond a binary choice.
- **Recommended?** ◯ (parked, see §14)

### Approach B — Transparent Decision Companion
- **Thesis**: Let users see exactly how a price is built and confirm or decline with full understanding, before any money is on the table.
- **For whom**: First-time or price-sensitive users comparing print options who don't yet trust an unfamiliar marketplace.
- **Outcome metric**: No baseline exists yet (pre-launch) — target: of users who reach a quote, a majority record a decision without abandoning mid-flow (specific number to be set once traffic exists).
- **Key trade-off**: Requires the cost breakdown to be genuinely legible (clear line items, no jargon) rather than a pass-through of slicer output — adds design/content work before this can ship credibly.
- **Effort signal**: S — no new data beyond the confirm/decline record itself; the added cost is presentation quality, not new system complexity.
- **Recommended?** ◯ (parked, see §14)

### Approach C — Confirm-with-context, minimal decision record
- **Thesis**: Give the user a clear moment to review their quote's cost breakdown and explicitly confirm or decline it, with the decision saved as the system's single source of truth for what happened next.
- **For whom**: First-time users evaluating whether the quoted price is trustworthy before committing.
- **Outcome metric**: No baseline exists yet — target: 100% of generated quotes reach a recorded confirm/decline decision with zero manual/support intervention.
- **Key trade-off**: Adds a lightweight review step (cost breakdown, quote expiry/staleness) instead of a bare accept/reject button — more UI and state handling than the strict minimum.
- **Effort signal**: S/M — mostly UI and a decision-state record; no new domain complexity since quote data already exists upstream.
- **Recommended?** ● (selected, see §13)

## 8. Multi-perspective feedback

### Engineer
- A: smallest integration surface, lowest coupling/race-condition risk against a still-unstable quote-engine.
- B: presentation depends on quote-engine exposing stable, well-labeled fields — high coupling to unstable data.
- C: broadest surface — expiry/staleness checks need timestamps quote-engine doesn't guarantee yet; real race conditions.

### Executive
- A: fastest path to a demoable end-to-end MVP, lowest opportunity cost even if quote-engine changes later.
- B: differentiation is premature before a working end-to-end flow exists to differentiate at all.
- C: defensible middle ground — more scope than A, closer to fast-follow value than B, without gating the MVP.

### UX-researcher
- A: bare yes/no on a purchase-adjacent decision reads as thin/untrustworthy; undisclosed irreversibility confuses users.
- B: clear, jargon-free breakdown builds real trust, but doesn't address irreversibility on its own.
- C: best combined trust signal (legibility + time-context); expiry countdowns need careful wording to avoid a dark-pattern feel.

### Synthesis matrix
|         | Engineer | Executive | UX |
|---------|:--------:|:---------:|:--:|
| App. A  | +        | +         | -  |
| App. B  | 0        | -         | +  |
| App. C  | -        | 0         | +  |

- A/Engineer: smallest surface, lowest short-term risk.
- A/Executive: fastest unblock, lowest opportunity cost.
- A/UX: bare yes/no feels thin, untrustworthy.
- B/Engineer: high coupling to unstable breakdown fields.
- B/Executive: differentiation premature before core loop proven.
- B/UX: transparent breakdown builds trust, good discoverability.
- C/Engineer: broadest surface, expiry/race-condition risk highest.
- C/Executive: defensible middle, moderate opportunity cost.
- C/UX: best trust signal, legibility plus time-context.

## 9. Trade-offs and edge cases

### Trade-offs per approach
| Approach | Pros | Cons |
|---|---|---|
| A | Fastest, lowest risk, smallest surface | Irreversible, no correction path, no trust signals |
| B | Builds trust via transparent pricing, closes gap (§6) | Premature before core loop proven; effort risk on unfinalized breakdown fields |
| C | Best combined trust signal; closes gap (§6) | Broadest surface; depends on unguaranteed expiry data; race-condition risk |

### Edge cases
- quote-engine's output schema changes after order-confirmation ships (contract drift), breaking parsing.
- Quote goes stale or is recalculated between generation and the user's decision (race condition).
- Duplicate/double-submit of confirm (double-click, retry, back-button resubmission).
- A confirmed order is never actioned downstream (fulfillment out of scope) — sits "confirmed" indefinitely.
- Quote generated but never confirmed/declined — orphaned quotes accumulate with no error signal.
- Mis-click or accidental confirm with no correction path (irreversible decision, carried into C from A).
- Confirm-without-understanding disputes if the cost breakdown isn't genuinely legible.
- Missing ownership check — a user confirming/declining a quote they never requested.

## 10. Risks
- **Top devil's-advocate vector**: race between quote expiry and the confirm click — if staleness is checked only client-side, a user can confirm after expiry against a stale price. Signal: orders confirmed after the quote's expiry time, or a spike in "wrong price" support tickets.
- Missing ownership/authorization check on confirm — a user could confirm/decline a quote they never requested. Signal: logs showing a mismatch between the confirming user and the quote's original requester.
- Confirmed orders never actioned downstream (fulfillment out of scope) accumulate with no end-state. Signal: rising "confirmed"-stuck orders, plus "when does my order ship?" tickets.
- quote-engine contract drift after order-confirmation ships (built ahead of a still-unstable upstream). Signal: parsing errors or null/zero prices right after a quote-engine deploy.

## 11. RICE — Claude proposed
- **Reach (R)**: TBD — left without a number (unlike stl-upload's illustrative placeholder), per the feature owner's choice. No traffic data exists pre-launch, and order-confirmation depends on quote-engine, which also hasn't shipped. Blocked on launch data (§15).
- **Impact (I)**: 1 ("medium") — confirmed. Closes the MVP flow's final step, but addresses a pipeline-completeness gap rather than documented user pain (§2); lower than stl-upload's I=2, which blocks an already-observed user-facing problem (Executive perspective, §8).
- **Confidence (C)**: 0.7 — confirmed, raised from an initial 0.5: the selected approach's scope is reasonably well understood even though Reach, the success metric, and quote-engine's final contract remain open (§15).
- **Effort (E)**: 1 person-week — confirmed matching Approach A's S signal (§7). Note: §13 selects the broader Approach C (S/M) — actual effort likely trends higher; flagged as an open question (§15) rather than silently revised.
- **RICE = R × I × C / E** — cannot be computed to a number: Reach has no value, not even illustrative.
- **State**: proposed — not confirmed, because Reach is unresolved.

## 12. Feasibility — Claude proposed

- [☑] **Tech**: confirmed, with a caveat — the stack decision (Node.js/TypeScript) is set, but no code has shipped anywhere in this repo yet (repo scan: only planning documents exist). order-confirmation is the simplest of the three MVP features (one decision record vs. stl-upload's file handling and validation).
- [☑] **Skills**: confirmed — CRUD-level complexity (one confirm/decline action, one decision record), simpler than the file-processing work the same solo maintainer already scoped end-to-end for stl-upload (idea-brief → PRD → sad → tasks, all committed in this repo).
- [☑] **Time**: confirmed, with a dependency — stl-upload's sad.md §2 records a hard 2-week solo-maintainer deadline for a comparably-scoped feature; order-confirmation's selected approach (S/M) fits a similar budget, but its start date is gated on quote-engine reaching a stable contract, not on its own scope.
- **State**: confirmed

## 13. Recommendation
**Selected: Approach C — Confirm-with-context, minimal decision record.** C is selected over the Engineer-favored A because UX (§8) scores C "+" for the best combined trust signal (legibility + staleness awareness), while A scores "-" for feeling thin/untrustworthy with no correction path — and every competitor surveyed (§6: Xometry, Craftcloud, Shapeways, Materialise OnSite, PrintQuote) collapses quote and commitment into one step, several without full fee transparency (Xometry reportedly hid ~12.4% in post-processing fees); C's transparent breakdown plus staleness disclosure is the one approach that closes that gap rather than deferring it. Feasibility (§12) is confirmed across Tech/Skills/Time, with Time gated on quote-engine's contract stabilizing rather than C's own scope — acceptable given order-confirmation is intentionally built ahead of quote-engine. RICE (§11) couldn't be finalized to a number (Reach unresolved), but Impact=1/Confidence=0.7 don't argue against the broader scope, and Engineer's "-" concern for C (largest surface, expiry race-condition risk, §8) is accepted as a tracked risk (§10) rather than a reason to fall back to A.

**Locked-in pointer**: order-confirmation will surface the quote's cost breakdown and an explicit staleness/expiry state before allowing confirm or decline in v1 — write-prd should treat "breakdown + staleness shown pre-decision" as a settled input, not an open design question. It should also treat "no edit/re-quote path, one irreversible decision" as settled (carried over from Approach A), since only the trust-building review step was added, not decision reversibility.

## 14. Parked & rejected approaches
| # | Approach | Status | Reason | Revisit trigger |
|---|---|:---:|---|---|
| A | Confirm/Decline Only | parked | Simplicity alone doesn't close the competitive gap (§6) or address the UX "-" trust risk (§8); C absorbs A's core mechanic and adds only the review step | If quote-engine's contract proves too unstable to support reliable expiry/breakdown data — fall back to A as a stopgap |
| B | Transparent Decision Companion | parked | Executive flagged this as premature differentiation before a working end-to-end flow exists (§8); C achieves most of B's trust benefit while staying scoped to a minimal decision record | Once the full MVP loop is live and there's room to invest further in presentation/content quality beyond C's baseline breakdown |

## 15. Open questions
- [ ] Actual Reach (users/quarter reaching a quote)? — owner: Yakiv Vakoliuk, due: at MVP launch (blocks RICE, §11).
- [ ] quote-engine's final output contract (field names/shape for price, breakdown, expiry)? — owner: Yakiv Vakoliuk, due: before write-prd (§4, §8).
- [ ] How is quote staleness/expiry defined and communicated (countdown vs. static message)? UX flagged countdown-as-dark-pattern risk (§8). — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] Should Effort (§11, E=1 confirmed against Approach A) be revised now that the broader Approach C was selected (§13)? — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] What authorization check prevents confirming/declining a quote never requested by that user (§10)? — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] What happens to a confirmed order once recorded, given fulfillment is out of scope (§9)? — owner: Yakiv Vakoliuk, due: before write-prd or next feature scoping.

## Related
- [`CONTEXT.md`](../../CONTEXT.md) — domain glossary (order, quote, cost breakdown, user).
- [`../../overview.md`](../../overview.md) — MVP scope and flow this feature is step 3 of.
- [`README.md`](./README.md) — feature status tracker; depends on quote-engine.

## DoD self-check
- [x] 15 sections present
- [x] No anti-pattern terms (Postgres/Redis/etc.)
- [x] Length ≤ 5 pages (~2200 words)
- [x] Frontmatter status: Confirmed
- [ ] RICE confirmed (state: confirmed) — left as `proposed`: Reach is genuinely unresolved (§11), not fabricated to pass this check.
- [x] Feasibility confirmed (state: confirmed) — all three checkboxes confirmed with caveats (§12).
- [x] Recommendation present with rationale citing 4 upstream sections (§6, §8, §11, §12)
