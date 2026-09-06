# order-confirmation

**Status:** Not started

## Scope
Presents the computed quote to the user and lets them confirm or decline it, recording the decision as a minimal order record.

## Depends on
`quote-engine` — needs the quote output (time, material, price, breakdown) to present.

## Out of scope
- Payments and checkout (MVP-wide exclusion, see [`overview.md`](../../overview.md)).
- Order fulfillment, shipping, and post-order tracking (MVP-wide exclusion, see [`overview.md`](../../overview.md)).
- Multi-vendor matching/routing and vendor/operator-facing tooling (MVP-wide exclusion, see [`overview.md`](../../overview.md)).

## Notes
Corresponds to step 3 ("Confirm or decline") of the MVP user flow in [`overview.md`](../../overview.md).
