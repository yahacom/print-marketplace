# Print Marketplace — Project Overview

## Product vision

A marketplace connecting people who want something 3D-printed with the people/services who can print it. Web-first.

## MVP scope

**In scope for the first release:**

- A web page where a user uploads an STL file of the model they want printed.
- Automatic calculation of an accurate print quote (time + material usage + price) from that STL.
- A confirm/decline step where the user acts on the quote to place (or drop) an order.

**Explicitly out of scope / undecided for MVP** (not yet designed, not assumed):

- Multi-vendor matching or routing an order to a specific printer/operator.
- Payments and checkout.
- Order fulfillment, shipping, and post-order tracking.
- Vendor/operator-facing tooling (e.g., accepting/managing incoming orders).
- Accounts, auth, and user profile management beyond whatever is minimally needed to hold an order.

These are open questions for later product and architecture decisions, not commitments made here.

## MVP user flow

1. **Upload** — the user uploads an STL of the model they want printed.
2. **Quote** — the system computes an accurate quote by actually slicing the model (via PrusaSlicer CLI), not by estimating from file weight. The quote includes:
   - print time
   - filament/material usage
   - final price, with a cost breakdown
   See [`stl-parse-feature-plan.md`](./quote-engine/stl-parse-feature-plan.md) for the detailed breakdown of this sub-system (slicer wrapper → G-code parsing → pricing formula) and its human-in-the-loop checkpoints.
3. **Confirm or decline** — the user reviews the quote and either confirms the order or declines it.

## Success criteria

- A valid STL produces an accurate quote (time, material, price) within an acceptable wait (~30-60 seconds in queue).
- An invalid or broken STL produces a clear, understandable error — never a hang or a crash.

## Status / next steps

This document captures the general product and MVP intent only. Detailed technical architecture, task decomposition, and ADRs are follow-on work and are not covered here.

One implementation decision made so far: the stack will be Node.js/TypeScript. No other architectural decisions (data model, queue design, service boundaries, hosting) have been made yet.
