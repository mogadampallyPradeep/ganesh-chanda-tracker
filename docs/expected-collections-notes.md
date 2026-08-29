# Expected collections — captured requirements (not yet designed)

Feature #2 in the queue, after expense advances & balance. Not brainstormed yet;
this file only records decisions already made so they are not lost.

## Decided

- **Dashboard figure is required.** Home must show the expected amount still to
  be received, labelled plainly as money *yet to be received* — not folded into
  any collected or available figure.
- **Same page, not a separate one** (proposed, pending confirmation): an
  Expected / Received tab on the existing collections page, sharing the donor
  list, with a one-tap "Mark received" that converts a pledge into a real
  donation and receipt rather than forcing re-entry.

## Non-negotiable

Expected money must stay out of `collected`, `available`, `cashInHand` and
`inBank`. A pledge is not cash. This mirrors the rule in the advances feature,
where a commitment stays out of `paidOut` until money actually moves.

## Open question, blocks the data model

Is an expected collection **per named member** (Ramesh promised 5,000) or a
**rough target per street/area** (Gandhi Nagar should yield ~40,000)?
The first is a pledge list; the second is a forecast. They are different tables
and different UIs — this must be settled before any spec is written.
