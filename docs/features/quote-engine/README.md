# quote-engine

**Status:** Implemented (except the k6 load test, T14). Contract: [`kb-quote-contract.md`](kb-quote-contract.md).

## Scope
Turns a stored STL into an exact print quote — print time, filament/material usage, and final price with a cost breakdown — by actually slicing the model via a real PrusaSlicer CLI invocation, not a weight-based estimate.

## Depends on
`stl-upload` — needs the stored file's file-id to slice.

## Out of scope
- Payments and checkout (MVP-wide exclusion, see [`overview.md`](../../overview.md)).
- Multi-vendor matching or routing (MVP-wide exclusion, see [`overview.md`](../../overview.md)).

## Notes
Corresponds to step 2 ("Quote") of the MVP user flow in [`overview.md`](../../overview.md). See [`stl-parse-feature-plan.md`](../../../stl-parse-feature-plan.md) for the detailed internal sub-task breakdown (slicer wrapper → G-code parsing → pricing formula) and its human-in-the-loop checkpoints.
