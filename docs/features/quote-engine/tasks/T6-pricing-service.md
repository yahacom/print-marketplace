---
id: T6
epic: quote-engine
project: print-marketplace
wave: 2
priority: Must
estimate: XS
blocks: [T8]
blocked_by: [T1]
status: done
prd_refs: [AC-03, "§6 NFR price accuracy", "§8 Resolved open question"]
sad_refs: ["§5", "§10 QG-1"]
adr_refs: []
---

# T6 · `pricing-service` — formula + breakdown

**Epic:** [[_epic|quote-engine]]

## Why

AC-03 requires showing the price broken into components (time cost, material cost, margin), not just a total — and the formula's rates are already product-owner-confirmed (PRD §8), so this task is pure implementation of an already-settled decision, not a design task.

## Linked artifacts

- PRD: [[../PRD.md]] §5 AC-03, §6 NFR (price accuracy ≤±5%), §8 (resolved pricing formula)
- SAD: [[../sad.md]] §5 (`services/pricing-service.ts`), §10 QG-1 (price accuracy scenario)
- Config: [[../pricing-config.json]] (copied to `config/pricing.json` in T1) — `total_price = (time_hours * rate_per_hour) + (filament_grams * price_per_gram) + margin`, `rate_per_hour = 2.5 USD`, `price_per_gram = 0.02 USD`, `margin_pct = 20`.

## Scope

Implement the formula exactly as documented in `pricing-config.json`'s `_comment` field. Margin is a percentage applied to the time+material subtotal (confirm this interpretation against the product owner's confirmed values if the formula's margin base is ambiguous — flag in PR description if so, don't guess silently).

## Acceptance criteria (GWT)

- [x] **AC-ps-1 (happy path breakdown, AC-03):** Given `timeMinutes` and `filamentGrams` from T5, when priced, then the result includes `timeCost`, `materialCost`, `margin`, and `totalPrice`, where `totalPrice = timeCost + materialCost + margin`.
- [x] **AC-ps-2 (formula correctness):** Given the confirmed rates (2.5 USD/hr, 0.02 USD/g, 20% margin), when priced with known inputs, then the computed values match a hand-calculated expectation exactly (not just "roughly").
- [x] **AC-ps-3 (reads config, not hardcoded):** Given `config/pricing.json` is changed, when priced, then the new rates are used without a code change — confirmed by a test that swaps the config and asserts the output changes accordingly.

## Checklist

- [x] Step 1 — Implement `computePrice({ timeMinutes, filamentGrams }): { timeCost, materialCost, margin, totalPrice }` reading `config/pricing.json`.
- [x] Step 2 — Unit tests for AC-ps-1/2/3 with hand-calculated expected values.

## Edge cases

| Case | Behavior |
|---|---|
| `filamentGrams = 0` | `materialCost = 0`; `totalPrice` still includes `timeCost` + margin on it — not an error. |
| `timeMinutes` fractional (e.g. 37.5 min) | Converts to hours as a float; no rounding until the final displayed price (rounding policy is a display/T12 concern, not this service's). |

## Definition of Done

- [x] All AC green.
- [x] PR linked back to this file (no PR opened — Ralph never opens PRs); `tracker.md` updated to `done`.

## Notes

- ASSUMPTION: margin is `margin_pct` of the time+material subtotal (the task flagged the base as possibly ambiguous; PRD §8 gives only the percentage). If the product owner meant margin on something else, only `computePrice` changes.
- API: `computePrice({ timeMinutes, filamentGrams }, config?)` (the T1 stub was named `priceQuote`; the task's Step 1 name `computePrice` was used, T8 should call that). `loadPricingConfig(path?)` validates the three rates are finite numbers; the default config is read once on first use, so a rate change needs a process restart. No rounding anywhere.
- Hand-check at 90 min / 50 g: 3.75 + 1.00 + 0.95 = 5.70 USD. Currency fields in `pricing.json` are not read; the service is currency-agnostic.
