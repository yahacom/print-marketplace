---
status: In review
owner: "Security Lead"
reviewers: []
updated_at: "2026-10-04"
feature_size: M
stage: "13"
ticket: "<TBD>"
---

# Security review — order-confirmation (T15)

**Prepared by:** the Ralph loop (headless, Claude), as review input for the Security Lead. **This is not a sign-off.** No approval is recorded here; see [Sign-off](#sign-off).

**Scope reviewed** (T15): the no-authz gap, the co-owned `draftOrders` document, whether T2's merge-safety fix landed, and T10's rate limiting against PRD §6.1's abuse cases. Method: code read of `src/modules/order-confirmation/`, `quote-repository.ts`, `stl-upload`'s `model-repository.ts`, `src/app.ts`, `src/request-logging.ts`, `src/metrics.ts`; grep for all writers of `draftOrders`; the tests added in T2–T12. Nothing was run against a real Firestore, a deployed instance, or a reverse proxy (none available here), so findings that depend on those are marked **Unverified**.

## Summary

| # | Area | Verdict | Severity if left as is |
|---|------|---------|------------------------|
| 1 | No authorization on confirm/decline | Matches the accepted v1 gap, with one aggravating factor: the capability id is written to logs | Medium |
| 2 | Co-owned `draftOrders` document | Writers confirmed to be exactly two, narrowly scoped; no runtime schema guard | Low–Medium |
| 3 | T2 merge-safety fix | Landed (commit `56f513e`); two residual issues found | Medium |
| 4 | T10 rate limiting | Meets the 10/min figure per client IP; deployment-dependent weaknesses | Medium |
| 5 | Other observations | Input validation, error leakage, CSRF, secrets | Low |

Recommended follow-ups are in [Follow-up items](#follow-up-items). None require implementing authorization (out of scope for v1, PRD §1/§3).

## 1. No-authz gap (PRD §1, §6.1 abuse case "cross-session confirm/decline", §8)

**Facts**
- Confirm/decline/GET are authorized by knowledge of `fileId` alone. `fileId` is a UUID v4 (122 bits of randomness, minted by `randomUUID()` in stl-upload), so it is unguessable; it is a bearer capability.
- A holder of the id can: read the quote (`price`, `breakdown`, `filename`, print time) via `GET /api/v1/orders/:fileId`; and record the one allowed decision, which is irreversible (no revert path, PRD §3).
- Unknown and malformed ids return the same `404 order.not_found`; the id is validated against `SAFE_FILE_ID` before it reaches a Firestore path (`order-routes.ts`). No cross-id existence oracle beyond what holding a valid id already grants.
- Decision values are hard-coded by the route (`"confirmed"` / `"declined"`); no client-supplied field is persisted. `decidedAt` is a server timestamp. The price is read from the document, never from the request (SAD §11 "never trust a client price" holds).

**Finding 1.1 — the capability id is logged in the clear (Medium).** `src/request-logging.ts` logs `request.url` without the query string, and order routes carry the id in the *path* (`/api/v1/orders/<fileId>/confirm`). Anyone with log or access-log read access (including a reverse proxy's access log, which this repo does not control) therefore holds working confirm/decline capabilities for every quote. quote-engine deliberately avoided this by sending the id in a WebSocket message ("so it never appears in proxy/access logs", `quote-routes.ts`). The SAD §8 rule "no decision content beyond id/status" permits the id, so this is compliant with the written convention but weakens the capability model. (Prometheus labels are not affected: `src/metrics.ts` uses the route pattern, pinned by `order-metrics.test.ts`.)

**Finding 1.2 — GET is unauthenticated and unlimited (Low).** PRD §6.1 scopes rate limiting to confirm/decline only (T10 out of scope list), so `GET /api/v1/orders/:fileId` can be called without limit. Guessing a UUID v4 is infeasible, so this is an availability/probing concern only.

**Assessment:** acceptable for v1 *as a deliberate, documented gap* provided the Security Lead accepts that the id is the only secret, and either accepts or fixes 1.1. The UI renders `filename` as text only (project convention), so the response does not add an injection surface.

## 2. Co-owned `draftOrders/{fileId}` document (SAD §11 row 1)

**Facts (verified by grep over `src/`)**
- Exactly two code paths write the collection: `quote-repository.ts` `writeDraftOrder` → `set(order, { merge: true })`, and `order-repository.ts` `decideOrder` → `transaction.update(ref, { decision, decidedAt })`. Nothing else touches `draftOrders`.
- order-confirmation writes only `decision`/`decidedAt`, never quote fields (ADR-0006), and reuses quote-engine's `DraftOrder` *type*, so the two modules share a compile-time contract.
- The decision write is `update`, so it cannot create a document: a decision for a quote that does not exist is `not_found`, not a phantom order.

**Finding 2.1 — no runtime contract between the writers (Low–Medium).** The shared type is compile-time only. Both writers use the Admin SDK, which bypasses Firestore security rules, so nothing in Firestore itself prevents either writer (or any other holder of the service-account key) from writing arbitrary fields, including `decision`. **Unverified:** the project's Firestore security rules (they should deny all client-SDK access) and the service account's IAM role (should be least-privilege, e.g. Cloud Datastore User, not Owner/Editor) — neither is visible in this repo.

**Finding 2.2 — service-account key handling (informational).** A Firebase Admin SDK key file exists at the repo root. It is covered by `.gitignore` (`*firebase-adminsdk*.json`, confirmed with `git check-ignore`) and not tracked (`git ls-files` shows none). It was not opened during this review. `npm start` reads it into `FIRESTORE_CREDENTIALS_JSON` from that file. Recommend confirming the key is rotated if it has ever been shared outside the developer machine, and that the production VM supplies it from a root-only `EnvironmentFile` (T14 added a comment to the systemd unit to that effect).

## 3. T2 — has the merge-safety fix landed?

**Yes.** `quote-repository.ts:34` reads `await draftOrders.doc(fileId).set(order, { merge: true });` (commit `56f513e`). A regression test (`quote-repository.merge.test.ts`) shows `decision`/`decidedAt` survive a re-quote while quote fields update, and `quote-repository.test.ts` was updated for the new call shape. **Caveat:** both tests use an in-memory fake that models merge semantics; they are not run against Firestore or its emulator (none exists in this repo). T2 itself carries the "quote-engine write-path change" review requirement for the Tech Lead; this review does not substitute for it.

**Finding 3.1 — `merge: true` deep-merges the `breakdown` map (Medium, latent; Unverified against real Firestore).** Per Firestore's documented semantics, `set(..., { merge: true })` merges nested maps field by field. If a re-quote's `breakdown` has fewer or different keys than the stored one (e.g. the pricing formula, still to be confirmed by the product owner, gains or drops a component), stale keys from the earlier quote remain, so `breakdown` would no longer sum to `price`. Today the keys are stable (`timeCost`, `materialCost`, `margin`), so there is no live impact. A fix that keeps the decision-field protection and replaces `breakdown` wholesale is `set(order, { mergeFields: [<the six quote field names>] })`. This is a *defect risk in the T2 change itself*; the DoD for T2 literally says `merge: true`, so it was not changed unilaterally.

**Finding 3.2 — a re-quote after a decision still rewrites the quote the user decided on (Medium).** T2 deliberately scoped out "reject re-quote once a decision exists". With `merge: true`, a re-quote after confirm leaves `decision` intact but silently replaces `price`/`breakdown`. Anyone holding the `fileId` can trigger a re-quote (quote WebSocket, 30/min/IP), and a pricing-config change between confirm and re-quote changes the figure a "confirmed" order points at. The decision record does not snapshot the price that was confirmed. Same family as the accepted "stale-price confirm" risk (SAD §11), but it also affects already-recorded decisions. Mitigations to choose between (a product/Tech Lead decision): reject re-quote when `decision` is set; or copy the confirmed price into the decision write.

## 4. T10 rate limiting vs PRD §6.1 abuse cases

**Facts**
- `routes/rate-limit.ts`: fixed 60 s window, 10 attempts per client IP, one counter shared by confirm and decline, `429 order.rate_limited` + `Retry-After`; attached per route to the two POSTs only (GET unlimited, per T10 scope). Tests: 11th attempt → 429, shared counter, per-IP isolation, window reset, GET unaffected (`rate-limit.test.ts`). `ORDER_RATE_LIMIT_PER_MIN` overrides the cap (for k6); invalid values fall back to 10.
- Abuse-case mapping: *duplicate/double-submit* → blocked by AC-04 (transaction precondition + early check), covered by T12 QG-1 tests against an in-memory fake; *spam create* → capped at 10/min/IP, and note decisions can only attach to existing quotes, so "flooding order storage" is bounded by the number of quotes, not by request volume.

**Finding 4.1 — IP keying behind a reverse proxy (Medium; Unverified, deployment-dependent).** `src/app.ts` sets no `trustProxy`, so `request.ip` is the TCP peer. If production runs behind a reverse proxy/load balancer (the `/metrics` comment already assumes one), every client shares the proxy's IP: the *entire product* is limited to 10 confirm/decline attempts per minute, and one abuser can lock out all legitimate users (availability). Setting `trustProxy` blindly instead makes `request.ip` trust a spoofable `X-Forwarded-For`, letting an attacker evade the limit. Needs a deployment decision (trusted proxy hop count) before ship. The same limitation already applies to the stl-upload and quote-engine limiters.

**Finding 4.2 — limiter state is per-process memory (Low).** Resets on restart and is not shared across instances; acceptable for the single-instance v1 (SAD §7), noted for any scale-out. Rejected requests count toward the window (an IP that keeps hammering stays blocked), and a fixed window permits up to 20 attempts across a window boundary.

**Finding 4.3 — "per session" in the PRD means per IP here (informational).** There are no sessions or accounts; users behind one NAT share a budget of 10/min.

## 5. Other observations

- **Error leakage:** unexpected failures return `500 {code: "order.internal_error"}` with fixed text; the cause is logged, not returned (tested). The log line for such failures includes the error message (may name Firestore internals) — appropriate for operators, no decision content.
- **Logging:** one structured line per request with only method, path, status, duration and `request_id`; test pins the exact key set. Inbound `x-request-id` is accepted only if it matches `^[A-Za-z0-9._-]{1,128}$`. The path carries the id (see 1.1).
- **CSRF/CORS:** no cookies or ambient credentials exist, so a cross-site POST gains nothing beyond what holding the `fileId` already gives; no CORS headers are set.
- **Path/ID handling:** `SAFE_FILE_ID` (`[A-Za-z0-9-]+`) blocks traversal into both the filesystem (`modelExists`) and Firestore document paths (no `/`, no `__reserved__` ids). Fastify's default `maxParamLength` (100) bounds id length.
- **TOCTOU on AC-05:** the model-file check and the decision write are not atomic; a file removed in between yields a confirmed order whose file is gone — the same shape as the accepted "orphaned file reference" risk.
- **`/metrics`** is served on the app port without authentication (pre-existing, commented in `src/metrics.ts`); it exposes only route patterns, methods, status codes and timings.
- **Transaction guarantee:** QG-1 concurrency tests prove the check-inside-transaction logic against a fake with optimistic retry, not Firestore's own isolation. **Unverified** on a real Firestore/emulator; recommend one run before release.

## Follow-up items

Proposed, for the Security Lead / Tech Lead / owner to accept, reject or re-prioritize. None were implemented by this task.

| ID | Item | Related finding | Suggested owner |
|----|------|-----------------|-----------------|
| F1 | Decide whether the id should stay in the URL path (logged) or move to a header/body; at minimum redact order paths in access logs | 1.1 | Security Lead + owner |
| F2 | Switch `writeDraftOrder` to `mergeFields` (or replace `breakdown` wholesale) so a re-quote cannot leave stale breakdown keys; verify on the Firestore emulator | 3.1 | quote-engine owner |
| F3 | Decide re-quote-after-decision policy: reject, or snapshot the confirmed price on the decision | 3.2 | Product + Tech Lead |
| F4 | Settle the production proxy topology and set `trustProxy` for the real hop count; re-test the 10/min limiter behind it | 4.1 | Owner / ops |
| F5 | Verify Firestore security rules deny client access and the service account is least-privilege; rotate the key if it left the dev machine | 2.1, 2.2 | Security Lead / ops |
| F6 | Run the QG-1 concurrency test and T2's regression test once against a real Firestore emulator | 2.1, 3, §5 | Owner |
| F7 | Consider a generous (non-10/min) limit on the GET route | 1.2 | Owner |

## Sign-off

**Not recorded.** Per the Ralph-loop rules, no approval is entered on anyone's behalf. The Security Lead should record one of the following here and move T15 to Done:

- [ ] Approved for v1 ship — name / date: ______
- [ ] Not approved — follow-ups from the table above to be tracked as: ______
