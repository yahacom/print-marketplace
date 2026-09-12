---
status: Accepted
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-10"
feature_size: "M"
stage: "03"
ticket: "<TBD>"
---

# PRD — order-confirmation

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](../../CONTEXT.md)
> **Reference module:** N/A — green-field mode (repo contains no application code yet, per project CLAUDE.md).
> **External context channels used:** Project docs: [`docs/overview.md`](../../overview.md) (MVP scope, 3-step flow, success criteria).

## 1. Context

order-confirmation closes the final step of the MVP flow (upload → quote → confirm/decline). quote-engine will compute a quote — price, print time, material, cost breakdown — for a user's uploaded model, but nothing in the current MVP flow persists the user's decision on that quote: quote-engine "computes a price but never persists it." Every user who reaches a valid quote is required to pass through this step next; there is no segment that skips it.

order-confirmation is being built ahead of quote-engine, betting on quote-engine's eventual output shape, so the flow is ready to close the moment quote-engine reaches a stable contract. Without it, the MVP flow cannot be demoed or validated end-to-end even once quote-engine ships.

**Recommendation (idea-brief §13):** Approach C — Confirm-with-context, minimal decision record. The user reviews the quote's cost breakdown and explicitly confirms or declines it, with the decision saved as the system's single source of truth for what happened next. This was selected over the simpler Approach A because a bare yes/no button scored "-" on user trust (§8), and every competitor surveyed (§6: Xometry, Craftcloud, Shapeways, Materialise OnSite, PrintQuote) collapses quote-and-commit into a single step — several without full fee transparency.

**Traceability:** docs/overview.md confirms the 3-step MVP flow and that quote-engine computes quotes via an actual PrusaSlicer CLI slice (not a weight estimate) — noted here only as context for why quote-engine is this feature's upstream dependency, not used to shape §5 AC wording.

**Decision overrides (made explicitly by the feature owner before drafting, recorded here for downstream traceability):**

- idea-brief §13's locked-in pointer required showing a staleness/expiry state before allowing confirm/decline. The feature owner overrode this for v1 — no staleness/expiry check is implemented; quotes are treated as never expiring. Rationale: keep v1 scope to displaying the quote summary and recording the confirm/decline decision only; staleness handling adds design work (idea-brief §8 UX flagged countdown timers as a dark-pattern risk) that the owner chose to defer rather than resolve now. Tracked as a residual risk, not a blocker (see idea-brief §10).
- idea-brief §15 raised "what authorization check prevents confirming/declining a quote never requested by that user?" as an open question. The feature owner decided no check exists in v1 (single-user assumption). Rationale: docs/overview.md explicitly lists "Accounts, auth, and user profile management" as undecided/out of scope for MVP — there is no identity system yet to check against. This leaves the PRD's §5 Acceptance Criteria without an "authorization" coverage-type example; the gap is logged in §8 Open Questions rather than filled with a fabricated control.

**Decision overrides (Phase 7.5 critic findings, resolved by the feature owner):**

- [F1] recommendation-citation gap — the critic noted that §1 ¶3 doesn't restate staleness disclosure as a co-equal pillar of why Approach C was selected, before ¶4 above overrides staleness away — overridden by author, rationale: staleness disclosure was a secondary trust signal in Approach C, not the primary reason it was selected over Approach A (the cost-breakdown review was the main differentiator per idea-brief §8 UX feedback); restating it before overriding is unnecessary detail.
- [F3] inconsistent override tracking — the critic noted the staleness override above is logged only as a residual risk, while the authorization override gets both a residual-risk note and a formal §8 Open Question with owner+due, even though idea-brief §13 called staleness the firmer commitment of the two — overridden by author, rationale: this is a deliberate, already-made decision for v1, not an open question needing an owner/due to resolve — unlike authorization, which genuinely still needs a future decision. Re-review can happen naturally in a later feature cycle without a formal tracked item.
- [F5] idea-brief Effort-revision question dropped — the critic noted idea-brief §15's question ("should Effort be revised now that Approach C was selected?") never carried into this PRD — overridden by author, rationale: sdlc:classify-size runs against this PRD's actual finalized scope (5 US, 5 AC, S/M signal), which will produce a correct size classification directly — no need to carry forward idea-brief's stale Effort question tied to the now-superseded Approach A estimate.

## 2. Goals

- User can confirm or decline a quote in one action, closing the MVP flow end-to-end without leaving the confirmation screen.
- User sees the quote's cost breakdown before deciding, so the decision is informed rather than a blind click.
- Every quote a user reaches gets a recorded decision (confirmed order or declined), so no quote is left in limbo.

## 3. Non-goals

- Payments and checkout — MVP-wide exclusion (idea-brief §5, docs/overview.md).
- Order fulfillment, shipping, and post-order tracking — MVP-wide exclusion; a confirmed order's terminal state in this feature is simply "confirmed," recorded to the database, with nothing downstream acting on it yet (idea-brief §15).
- Multi-vendor matching/routing and vendor-facing tooling — MVP-wide exclusion (idea-brief §5).
- Quote editing, re-quoting, or decision reversal — one quote gets one irreversible decision in v1 (idea-brief §5, carried over from Approach A per §13's locked-in pointer).
- Quote staleness/expiry enforcement — explicitly deferred for v1 per the feature owner's override (see §1 "Decision overrides"); quotes do not expire or get re-validated for freshness in this release.

## 4. User stories

### US-01: Review quote before deciding

**As a** user
**I want** to see the quote's cost breakdown after my model is sliced
**So that** I understand what I'm paying for before I decide

### US-02: Confirm a quote

**As a** user
**I want** to confirm a quote I agree with
**So that** my model gets ordered for printing

### US-03: Decline a quote

**As a** user
**I want** to decline a quote I don't want
**So that** I can walk away without creating an order

### US-04: See my decision persisted

**As a** user
**I want** my confirm/decline decision to be saved
**So that** I don't lose track of what I decided if I leave and come back

### US-05: Trust that a decision is final

**As a** user
**I want** to know that my decision is final once made
**So that** I understand there's no accidental re-confirmation or edit path

## 5. Acceptance criteria

### AC-01 (US-02) — happy path

**Given** a user has a valid quote with its cost breakdown displayed
**When** the user attempts to confirm the quote
**Then** the system records an order for that quote and confirms to the user that the order was placed

### AC-02 (US-03) — happy path

**Given** a user has a valid quote with its cost breakdown displayed
**When** the user attempts to decline the quote
**Then** the system records the decline decision and confirms to the user that no order was placed

### AC-03 (US-01) — error

**Given** a user opens the confirm/decline screen without an existing quote for that session
**When** the user attempts to view the confirmation screen
**Then** the system tells the user that no quote is available yet and does not show confirm/decline options

### AC-04 (US-05) — domain invariant

**Given** a quote already has a recorded decision
**When** the user attempts to confirm or decline that same quote again
**Then** the system blocks the action and tells the user that this quote already has a final decision, since each quote can be decided only once

### AC-05 (US-02) — cross-context

**Given** a user attempts to confirm a quote
**When** the quote's underlying model file is no longer available
**Then** the system blocks the confirmation and tells the user that the model needs to be re-uploaded before an order can be placed

**Coverage note:** the "authorization" coverage type is deliberately not represented above — see §1 "Decision overrides" and §8 Open Questions.

## 6. Non-functional requirements

| Aspect                            | Target                                                                       | Measurement                                 |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Latency p95 confirm/decline write | ≤ 300 ms                                                                     | confirm/decline write-path metric           |
| Latency p95 quote-summary display | ≤ 200 ms                                                                     | confirmation-screen load metric             |
| Throughput                        | ≥ 20 req/s per instance                                                      | k6 smoke in CI                              |
| Availability                      | 99.5%                                                                        | monthly SLO window                          |
| Concurrency safety                | duplicate confirm/decline on the same quote is rejected, not double-recorded | enforced via AC-04's domain-invariant check |

## 6.1 Security / privacy

- **Data classification:** internal — order records contain no payment data (payments out of scope, §3) but do reference a user's uploaded model file.
- **Personal data touched:** none new beyond what quote-engine/stl-upload already collect. The order record adds only a decision status, a timestamp, and a reference (path) to the model file — no new PII fields.
- **AuthZ/AuthN impact:** none in v1 — no ownership check exists on confirm/decline (see §8 Open Question). This is a known, deliberate gap, not a hidden one — see §1 "Decision overrides."
- **Abuse cases:**
  - **Cross-session confirm/decline** — deferred to v1's single-user assumption (§1, §8); anyone with the confirmation screen's URL/state could act on a quote they didn't request. Tracked as an open question, not blocking v1 ship.
  - **Duplicate/double-submit** — a user double-clicking confirm is blocked by AC-04's domain invariant (one decision per quote); no double order gets recorded.
  - **Spam create** — repeated confirm attempts against the same or different quotes to flood order storage: rate limit at 10 confirm/decline attempts per minute per session.
  - **Orphaned file reference** — an order references a model file path that is later deleted/cleaned up by stl-upload's retention policy, leaving a confirmed order pointing to nothing. Related to AC-05 (which blocks confirmation if the file is _already_ gone at decision time) but does not cover the file disappearing _after_ an order is confirmed — flagged as a residual risk for architecture-design to size.
  - **Stale-price confirm** — because staleness/expiry is deferred in v1 (§1 override), a user could confirm a quote whose price no longer reflects current material/print costs. Tracked as a residual risk, not blocking v1 ship (idea-brief §10).
- **Security review:** Required — despite being S/M-sized, this feature introduces the marketplace's first persisted order record and the first no-authorization-check surface; a security reviewer should confirm the deferred-authorization decision is acceptable for v1 before ship.

## 7. Metrics / KPIs

- **Decision completion rate** — baseline: 0, target: 100% of generated quotes reach a recorded confirm/decline decision within 30 days of quote-engine going live.
- **Confirm/decline latency (p95)** — baseline: none (pre-launch), target: ≤ 300 ms p95 in production within the first 30 days post-launch.
- **Order-creation error rate** — baseline: 0 (new feature), target: < 1% of confirm attempts fail due to system error (not user decline) within 30 days.

## 8. Open questions

- [ ] Is it acceptable that v1 has no ownership/authorization check on confirm/decline (any session/URL holder can act on a quote), given no accounts/auth system exists yet (docs/overview.md)? If not, a lightweight session-scoping check needs designing before ship. Default per feature-owner decision: acceptable for v1. — owner: Yakiv Vakoliuk, due: before architecture-design (stage 04-05)
- [ ] What is quote-engine's final output contract (field names/shape for price, print time, material usage, cost breakdown, and the model-file reference) that order-confirmation's UI and order record will consume? — owner: Yakiv Vakoliuk, due: before quote-engine ships / before stage 09 api-contracts
- [ ] Should stl-upload's model-file retention guarantee the file stays available at least until a quote is decided, or should order-confirmation snapshot/copy the file reference at quote-generation time? This affects AC-05's cross-context guarantee and the "orphaned file reference" abuse case (§6.1). — owner: Yakiv Vakoliuk, due: before architecture-design (stage 04-05)

## Related

- [`idea-brief.md`](./idea-brief.md) — problem, recommendation, RICE, feasibility.
- [`CONTEXT.md`](../../CONTEXT.md) — domain glossary (order, quote, cost breakdown, user).
- [`../../overview.md`](../../overview.md) — MVP scope and flow this feature is step 3 of.
