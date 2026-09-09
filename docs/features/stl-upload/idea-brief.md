---
status: Confirmed
owner: "Yakiv Vakoliuk"
reviewers: []
updated_at: "2026-09-06"
feature_size: M
stage: "01"
ticket: "<ticket-id>"
value_score:
  rice: 40                       # provisional — see §11, Reach unresolved
  state: proposed
  confirmed_at: ""
feasibility_state: proposed
---

<!-- Stage 01 → see SDLC/plugin/skills/interview/SKILL.md -->
<!-- Why: capture the idea before it's forgotten or retold incorrectly -->

# Idea Brief — stl-upload

## 1. Raw idea
A web page where a user uploads an STL file of the model they want printed, so the system has a valid stored file to feed into the quote engine.

## 2. Problem
Users upload files that the downstream slicing step cannot use — wrong formats, corrupted files, or geometry that is non-manifold/non-watertight (holes, self-intersections) — and today nothing catches this early with a clear explanation, so the failure would otherwise surface confusingly deep in the flow.

## 3. Users
Mostly newcomers with no 3D-modeling background — people who want an object printed but have never opened CAD or mesh-repair software, as opposed to designers/engineers who already know the format's constraints.

## 4. Why now
stl-upload is the entry point of the entire MVP flow (upload → quote → confirm/decline) for this web-first 3D print marketplace. It is a blocking dependency: quote-engine and order-confirmation have nothing to process without it.

## 5. Out of scope
- Payments, checkout, multi-vendor routing, order fulfillment, vendor-facing tooling, and full accounts/auth — MVP-wide exclusions, see [`overview.md`](../../overview.md).
- Auto-repair or guided step-by-step fixing of broken meshes (evaluated as Approach B/C, parked — see §14).
- Support for non-STL formats (OBJ/3MF/STEP) that competitors accept — explicit gap versus competitors, see §15 Open questions.

## 6. Competitive analysis
| # | Product · URL | Features | Value per feature (1-5) | Gap |
|---|---|---|---|---|
| 1 | Shapeways · https://support.shapeways.com/hc/en-us/articles/360008357773 | Automatic printability checks (watertight/manifold/normals), multi-format (STL/OBJ/3MF/STEP/…), polygon + file-size limits, bounding-box-vs-printer check | 5 | We only support STL and only check watertightness — no multi-format, no bounding-box check |
| 2 | Craftcloud · https://craftcloud3d.com/en/upload | 35+ formats, geometry-issue detection, instant quotes across 180+ manufacturing partners | 4 | No instant-quote network; format breadth is far narrower |
| 3 | Sculpteo · https://www.sculpteo.com/en/upload/ | Upload → automatic quote, standard error-checking pipeline | 3 | Comparable scope to our MVP intent, but no auto-repair either |
| 4 | i.materialise · https://i.materialise.com/blog/en/3d-model-uploaded-process | Automated + manual checks before production, model-cleanup step | 4 | Manual-check fallback and cleanup step we don't offer |

Footnotes: research performed 2026-09-06 via web search for "Shapeways/Craftcloud/Sculpteo/i.materialise STL upload validation mesh errors".

## 7. Strategic approaches

### Approach A — Local Validate-Then-Store Pipeline
- **Thesis**: Accept an STL upload, run one synchronous geometry check, and either hand back a usable file-id or a plain-language reason it failed — no queue, no async processing.
- **For whom**: Newcomers who need an immediate, unambiguous yes/no rather than a pending state to interpret.
- **Outcome metric**: % of uploads reaching a valid file-id — baseline unknown (pre-launch) → 90%+ of non-garbage uploads validated correctly.
- **Key trade-off**: Skips repair/auto-fix of broken geometry (reject-and-explain instead of reject-and-repair) to stay shippable solo in two weeks.
- **Effort signal**: S — single synchronous request/response, local disk storage, one validation step, no background jobs.
- **Recommended?** ●

### Approach B — Guided Printability Copilot
- **Thesis**: Instead of a pass/fail gate, diagnose exactly why an STL isn't printable and walk the user through a fix or automatic repair, so they leave with a usable file instead of an error.
- **For whom**: Newcomers who would otherwise abandon after a cryptic rejection.
- **Outcome metric**: % of initially-invalid uploads recovered into a valid file-id — baseline ~0% (competitors just reject) → target 40%.
- **Key trade-off**: Auto-repair/guided-fix logic is heuristic (may alter geometry unexpectedly) and adds real engineering effort against a 2-week deadline.
- **Effort signal**: L — auto-repair heuristics and non-expert-friendly guided messaging are substantially harder than a validation-only check.
- **Recommended?** ◯

### Approach C — Guided Upload With Auto-Repair Attempt
- **Thesis**: Validate immediately and automatically attempt to repair common minor geometry defects (small non-manifold gaps, inverted normals) before rejecting.
- **For whom**: Newcomers whose files have minor, fixable defects rather than fundamentally wrong formats.
- **Outcome metric**: % of uploads reaching a valid file-id — baseline ~50-60% (bare validation only) → target 75-80%.
- **Key trade-off**: Adds a repair-then-revalidate stage (real implementation time) versus A's reject-and-explain-only approach, but stays narrower than B's guided/interactive scope.
- **Effort signal**: M — one bounded additional processing step fits in 2 weeks; excludes any interactive/visual repair tooling.
- **Recommended?** ◯

## 8. Multi-perspective feedback

### Engineer
- Approach A has the smallest blast radius and integration surface — easiest to actually finish and debug solo in two weeks.
- Approach B's root-cause diagnosis across many defect classes is an open-ended geometry problem with unbounded scope — real risk of missing the deadline entirely.
- Approach C's auto-repair heuristics are probabilistic; a "successful" silent repair could subtly alter geometry and produce an incorrect downstream quote.
- All three need synchronous request handling to be watched carefully — a large or pathological mesh can block the request thread for seconds.

### Executive
- Approach A right-sizes effort to the 2-week solo deadline and keeps the critical path clear for quote-engine and order-confirmation, which are the parts that actually generate revenue and don't exist yet.
- Approach B is premature differentiation — investing L effort in polish on the very first MVP step risks the whole MVP never shipping.
- Approach C is a reasonable middle ground but still eats into the schedule buffer needed for the two remaining MVP legs; better revisited after the full loop ships.

### UX-researcher
- Approach A's blunt rejection with no fix path strands a newcomer who has no mesh-repair software and doesn't know what "non-manifold" means — real abandonment risk at the very first touchpoint.
- Approach B gives the best long-term trust and completion rate but risks overwhelming a first-time user if the guided flow isn't tightly scoped; any repair must be surfaced explicitly (before/after, consent) or it's a trust violation.
- Approach C's auto-repair-then-fallback is a good balance for common defects, but silently altering a file the user will pay to print is a surprise risk unless flagged before quoting.

### Synthesis matrix
|         | Engineer | Executive | UX |
|---------|:--------:|:---------:|:--:|
| App. A  | +        | +         | -  |
| App. B  | -        | -         | +  |
| App. C  | 0        | 0         | 0  |

- A/Engineer: small blast radius, easiest solo delivery.
- A/Executive: fits 2-week deadline, low opportunity cost.
- A/UX: dead-end rejection, high abandonment risk.
- B/Engineer: unbounded scope, likely blows deadline.
- B/Executive: premature differentiation, high opportunity cost.
- B/UX: best trust, but overwhelm risk.
- C/Engineer: bounded scope, but silent-repair risk.
- C/Executive: reasonable middle, still eats schedule buffer.
- C/UX: good balance, silent-alteration trust risk.

## 9. Trade-offs and edge cases

### Trade-offs per approach
| Approach | Pros | Cons |
|---|---|---|
| A | Fastest to ship, lowest complexity, fits solo 2-week budget, smallest failure surface | No path forward for the user; likely higher abandonment for beginners; defers repair value to later |
| B | Highest completion/trust, most differentiated vs. competitors | Unbounded engineering scope; high risk of missing the deadline and blocking the rest of MVP |
| C | Meaningfully improves valid-upload rate over A; bounded, still shippable in 2 weeks | Silent geometry alteration is a trust risk; still dead-ends on unrepairable files; adds latency/complexity vs. A |

### Edge cases
- Non-STL file uploaded (wrong extension or wrong content) — must be rejected with a clear message, not crash.
- Corrupted/truncated STL file that fails to parse at all.
- Valid STL but geometry is non-manifold/non-watertight (holes, self-intersections).
- STL with flipped/inverted normals (visually fine, but a printability issue).
- Extremely large file (near/at whatever size limit is chosen) — must not hang the request or exhaust memory.
- Empty or zero-byte upload.
- Duplicate upload of the same file — open question whether each gets its own file-id or is deduplicated (see §15).
- If auto-repair is ever added (Approach C/B), a repair that silently changes model dimensions/volume must be flagged to the user before quoting.

## 10. Risks
- **Top devil's-advocate vector**: a malicious/crafted STL exploiting a parser vulnerability could crash or hijack the validation process (buffer-overflow-style attack, or a forged triangle-count header causing unbounded memory allocation) — signal: repeated process crashes/restarts, or the upload endpoint pinning CPU/memory until the host degrades.
- Disk exhaustion from unlimited or duplicate uploads with no per-user quota or file-size cap — signal: disk usage climbs monotonically until all uploads fail with no warning.
- Solo-maintainer blind spot: no alerting exists yet (local launch, no monitoring) — if the validator throws on a rare malformed mesh, uploads could silently stop succeeding with nobody paged.
- A validator that accepts a mesh that later fails in the real slicer (false negative) — confuses users who already saw an upload "success" message.

## 11. RICE — Claude proposed
- **Reach (R)**: TBD — no traffic data exists pre-launch; provisional placeholder of 50 users/quarter used only to illustrate the formula below. Real number blocked on launch data (see §15).
- **Impact (I)**: 2 ("high") — stl-upload is a blocking dependency for the whole MVP (§4), confirmed by the Executive perspective (§8), but the value itself is realized downstream in quote-engine/order-confirmation.
- **Confidence (C)**: 0.8 — a few open questions remain (exact file-size limit, duplicate-upload handling, resource-exhaustion mitigation), but the core scope is well understood.
- **Effort (E)**: 2 person-weeks — matches Approach A (S), the only effort level compatible with the 2-week solo deadline (§7).
- **RICE = R × I × C / E** — cannot be finalized while Reach is TBD; illustrative value using the placeholder Reach=50 is **40** (50 × 2 × 0.8 / 2).
- **State**: proposed — not confirmed, because Reach is unresolved.

## 12. Feasibility — Claude proposed

- [☐] **Tech**: TBD — a repository scan (`docs/`, no code yet) found no adjacent shipped feature to cite; this is a greenfield project, so Tech feasibility has no track record to point to.
- [☐] **Skills**: TBD — same reason; no prior shipped feature in this repo to confirm the solo developer's track record against.
- [☐] **Time**: TBD — same reason; the 2-week estimate is a stated constraint (§2 Constraints, from user), not something validated against a similar past feature in this codebase.
- **State**: proposed

## 13. Recommendation
**Selected: Approach A — Local Validate-Then-Store Pipeline.** Rationale: the provisional RICE (§11, ≈40, Effort=2 person-weeks) shows Approach A is the only effort level compatible with the hard 2-week solo deadline; Feasibility (§12) is entirely TBD/greenfield, which argues for the approach with the smallest unknown surface; the Engineer and Executive perspectives (§8) both scored Approach A "+" for smallest blast radius and lowest opportunity cost against a still-unbuilt quote-engine/order-confirmation; and the competitive gap (§6) — competitors ship full auto-checks and multi-format support — is a known, disclosed trade-off (§15) rather than a blocker for an MVP entry point. The UX perspective's abandonment-risk concern (§8) is accepted as an explicit, visible trade-off, not a hidden one.

**Locked-in pointer**: stl-upload will do synchronous validation only (no auto-repair) in v1, and will produce a file-id contract that quote-engine consumes as-is — write-prd should treat "no repair in v1" and "the file-id handoff shape" as settled inputs, not open design questions.

## 14. Parked & rejected approaches
| # | Approach | Status | Reason | Revisit trigger |
|---|---|:---:|---|---|
| B | Guided Printability Copilot | parked | Unbounded scope, high risk of missing the 2-week deadline and blocking the rest of MVP | After quote-engine + order-confirmation ship and real abandonment-rate data exists |
| C | Guided Upload With Auto-Repair Attempt | parked | Bounded but still eats into the schedule buffer needed for the other two MVP legs | Same as B — revisit once the full MVP loop is validated post-launch |

## 15. Open questions
- [ ] What is the actual Reach (users/quarter attempting an upload)? — owner: Yakiv Vakoliuk, due: at MVP launch (blocks confirming RICE in §11).
- [ ] What is the exact max file-size limit? — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] How should duplicate uploads of the same file be handled (new file-id each time, or dedupe)? — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] What mitigation is needed against malicious/crafted STL files (resource exhaustion, parser vulnerabilities) — see §10 top risk? — owner: Yakiv Vakoliuk, due: before write-prd.
- [ ] Should multi-format support (OBJ/3MF/STEP) be added later to close the competitive gap in §6? — owner: Yakiv Vakoliuk, due: post-MVP-launch review.
- [ ] Feasibility (§12) is unconfirmed (greenfield, no track record) — revisit once stl-upload actually ships, to have a real reference point for future features. — owner: Yakiv Vakoliuk, due: after stl-upload ships

## Related
- [`CONTEXT.md`](../../../CONTEXT.md) — domain glossary (watertight mesh).
- [`../../overview.md`](../../overview.md) — MVP scope and flow this feature is step 1 of.
- [`README.md`](./README.md) — feature status tracker.

## DoD self-check
- [x] 15 sections present
- [x] No anti-pattern terms (Postgres/Redis/etc.)
- [x] Length ≤ 5 pages (~2200 words)
- [x] Frontmatter status: Confirmed
- [ ] RICE confirmed (state: confirmed) — left as `proposed`: Reach is genuinely unresolved pre-launch (§11), not fabricated to pass this check.
- [ ] Feasibility confirmed (state: confirmed) — left as `proposed`: greenfield repo has no adjacent shipped feature to cite (§12), not fabricated to pass this check.
- [x] Recommendation present with rationale citing 4 upstream sections (§6, §8, §11, §12)
