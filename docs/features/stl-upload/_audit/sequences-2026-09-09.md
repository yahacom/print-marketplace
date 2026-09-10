# Sequence coverage audit — stl-upload — 2026-09-09

## Coverage table

| US | Title | Status |
|---|---|---|
| US-01 | Upload a valid STL and get confirmation | Covered — SAD §6 "Critical flow 1" |
| US-02 | Get a clear reason when a file isn't a usable STL | Covered — SAD §6 "Critical flow 2" |
| US-03 | Get a clear reason when geometry isn't watertight | Covered — SAD §6 "Critical flow 3" |
| US-04 | Trust my upload is private to me | Missing — user opted to skip this run |
| US-05 | My valid upload is ready for the quote engine automatically | Covered — SAD §6 "Critical flow 4" |

## Added

None — no diagrams were confirmed and appended this run.

## Skipped (trivial)

None auto-flagged as trivial.

## Skipped (user decision)

- **US-04** — flagged Missing (AC-04, unguessable-identifier access control). Not auto-trivial: involves a security-relevant behavior (identifier-as-access-control), not a bare single-hop read. User declined to draft a sequence for it in this session — SAD §6 remains without a US-04 flow.

## New actors flagged

None. US-04, if drafted, would reuse existing §5 Container actors (User, Upload API, Model storage) — no Container view change needed.

## ADR potential

None raised this run (US-04 was not drafted, so no new decision surfaced).

## Self-check against DoD

4/5 user stories are Covered; 1/5 (US-04) is explicitly Missing-by-user-choice, not silently dropped. SAD §6 was not modified — no new Mermaid blocks required `mmdc` validation.
