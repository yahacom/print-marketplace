---
status: Living
updated_at: "2026-09-08"
---

# Domain Context

<!--
CONTEXT.md = domain glossary, not SPEC and not a scratch pad. NO implementation details
(no Redis vs Postgres, no library names, no API contracts) — only domain words
and the boundaries between them. The rest lives in SPEC.md, architecture-brief.md, ADR.

Terms resolving during interview/brainstorm/decide go here inline,
not batched "I'll consolidate later". MP rule: empty H2 — delete before commit;
in CONTEXT.md keep only sections that have real content.
-->

## Glossary

<!-- term · 1-sentence canonical definition · 1-sentence boundary (what it is NOT / what it gets confused with). -->
- watertight mesh — a 3D model whose surface has no holes (closed/manifold geometry), which is required for a slicer to parse it. NOT valid file format (a file can be a well-formed STL but still be non-watertight).
- model — the 3D object a user wants printed. NOT STL file (the file is a specific on-disk encoding of a model).
- STL file — a file format that encodes a model's surface as a set of triangles. NOT model (model is the abstract 3D object; the file is its specific encoding).
- valid model — a model that has passed stl-upload's checks and is fit for the slicer. NOT watertight mesh (watertightness is only one of the validity criteria).
- order — a record of the user's confirm/decline decision on a quote. NOT quote (a quote is a proposal awaiting a decision; an order is the decision itself).
- quote — a price proposal (print time + material usage + price) produced by slicing a valid model. NOT order (an order already reflects the user's decision; a quote doesn't yet).
- cost breakdown — the decomposition of a quote's final price into its components. NOT quote (a quote is the whole proposal; the breakdown is just the price split inside it).
- user — a person who uploads a model for printing. NOT vendor (the party that fulfills printing — vendor-facing tooling is out of scope for MVP per idea-brief §5).
