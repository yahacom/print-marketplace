---
id: T1
epic: quote-engine
project: print-marketplace
wave: 1
priority: Must
estimate: XS
blocks: [T2, T3, T4, T5, T6, T9]
blocked_by: []
status: todo
prd_refs: []
sad_refs: ["§5"]
adr_refs: []
note: "Scope extended 2026-10-02 to also scaffold config/slicer-profile-pla.ini — see _epic.md 'Scope amendment — verified PrusaSlicer behavior'."
---

# T1 · quote-engine module scaffold

**Epic:** [[_epic|quote-engine]]

## Why

Every other task writes into `src/modules/quote-engine/`. Creating the empty layered skeleton first (mirroring `src/modules/stl-upload/`) lets Wave 2 tasks start in parallel without colliding on directory creation.

## Linked artifacts

- SAD: [[../sad.md]] §5 (Building block view — exact directory layout to create)
- Parity reference: `src/modules/stl-upload/module.ts` (FastifyPluginAsync registration pattern)

## Scope

Create the directory layout from sad.md §5, with each file exporting a typed-but-unimplemented stub (throws `Not implemented` or returns a `TODO` placeholder) so later tasks fill them in without re-touching the scaffold:

```
src/modules/quote-engine/
├── module.ts
├── routes/
│   ├── quote-routes.ts
│   └── rate-limit.ts
├── services/
│   ├── quote-service.ts
│   ├── slicer-queue.ts
│   ├── slicer-service.ts
│   ├── gcode-parser.ts
│   └── pricing-service.ts
├── config/
│   ├── pricing.json
│   └── slicer-profile-pla.ini
└── repositories/
    ├── model-reader.ts
    └── quote-repository.ts
```

- `config/pricing.json` — copy verbatim from [[../pricing-config.json]] (already product-owner-confirmed).
- `config/slicer-profile-pla.ini` — copy verbatim from [[../slicer-profile-pla.ini]] (the fixed PLA printer+material profile; T4 passes it to `--load`, T5 reads the bed size from it — single source of truth for the build volume). Added 2026-10-02, see `_epic.md` "Scope amendment — verified PrusaSlicer behavior".
- `module.ts` — a `FastifyPluginAsync` stub that does **not** yet register with `src/app.ts` (wiring into `buildApp` happens in T10, once the route exists — avoids a half-registered module reaching main).

## Acceptance criteria

- [ ] **AC-scaffold-1:** All files above exist with correct relative imports (ESM `.js` extensions) and compile under `npm run typecheck`.
- [ ] **AC-scaffold-2:** `config/pricing.json` content matches [[../pricing-config.json]] exactly (rate_per_hour, price_per_gram, margin_pct).
- [ ] **AC-scaffold-3:** `module.ts` is not yet imported by `src/app.ts` — confirmed by `grep -r "quote-engine" src/app.ts` returning nothing.
- [ ] **AC-scaffold-4:** `config/slicer-profile-pla.ini` is byte-identical to [[../slicer-profile-pla.ini]] — confirmed by `diff`.

## Checklist

- [ ] Step 1 — `mkdir -p src/modules/quote-engine/{routes,services,config,repositories}`.
- [ ] Step 2 — Create each stub file with a minimal typed export (function signature + `throw new Error("not implemented")` body) matching the role sad.md §5 assigns it.
- [ ] Step 3 — Copy `pricing-config.json` into `config/pricing.json` and `slicer-profile-pla.ini` into `config/slicer-profile-pla.ini`.
- [ ] Step 4 — `npm run typecheck` clean.

## Edge cases

None — this is a pure scaffold task, no behavior to test.

## Definition of Done

- [ ] All checklist steps done.
- [ ] `npm run typecheck` and `npm run lint` clean.
- [ ] PR linked back to this file.
- [ ] `tracker.md` updated: status `done`.
