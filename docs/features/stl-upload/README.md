# stl-upload

**Status:** Not started

## Scope
A web page/endpoint where a user uploads an STL file of the model they want printed. The system validates that the file is a parseable, watertight mesh, stores it, and returns a reference (file-id) that the rest of the flow can use.

## Depends on
None

## Out of scope
- Slicing, quoting, or pricing the model — see [`quote-engine`](../quote-engine/README.md).
- Accounts/auth beyond whatever is minimally needed to hold an order (MVP-wide exclusion, see [`overview.md`](../../overview.md)).

## Notes
Corresponds to step 1 ("Upload") of the MVP user flow in [`overview.md`](../../overview.md).
