# Expected Collections — Design Spec

**Date:** 2026-08-30
**Status:** Approved design → ready for implementation plan
**Repo:** `mogadampallyPradeep/ganesh-chanda-tracker`
**Builds on:** `2026-08-29-expense-advance-balance-design.md` (same commitment/payment shape, mirrored)

## Purpose

Record what people have **promised** to give, so the mandal can answer "how much
more can we still expect?" — and chase it — without ever confusing a promise
with money in hand.

This is the mirror of expense advances. There, a commitment is money the mandal
owes and has not yet paid. Here, a pledge is money the mandal is owed and has not
yet received.

## The problem it solves

Today the fund knows only what has arrived. With ₹67,000 collected and ₹95,000
already committed to vendors, the treasurer has no place to record that ₹40,000
more has been promised by named people — so "can we afford this?" is answered
with only half the picture, and chasing happens from memory and paper.

## Data model

```
pledges      id           uuid pk
             donor_name   text not null
             phone        text
             address      text
             amount       int not null check (amount > 0)   -- promised
             note         text
             assigned_to  text references committee_members(mobile)  -- who chases
             closed_at    timestamptz            -- null = still open
             closed_note  text                   -- "moved away", "said no"
             created_at   timestamptz not null default now()

donations    + pledge_id  uuid references pledges(id) on delete set null
```

**A pledge's payments are just donations.** There is no separate payment table.
Receiving against a pledge inserts an ordinary `donations` row carrying
`pledge_id`, which means it flows through the existing receipt-number trigger,
the existing balance maths, the existing statement and the existing export with
no special-casing anywhere. Money becomes real at exactly one moment, by exactly
one mechanism.

Adding `pledge_id` to `donations` is a plain additive nullable column and does
not disturb `public_donations`, which selects named columns and never sees it.

`on delete set null` is deliberate: **deleting a pledge must never delete a
receipt.** Promises are disposable; money is not. A donation whose pledge was
deleted simply becomes an ordinary donation.

**`pledge_status` view** — `pledge_id, pledged, received, balance, is_settled` —
mirroring `expense_status` so the UI patterns carry over unchanged.

## The money rule

**Pledged money never enters `collected`, `available`, `cashInHand` or
`inBank`.** `computeBalance` does not change at all. A pledge is not cash, in
precisely the way a commitment is not a payment.

The one new figure:

```
expectedOutstanding = Σ max(0, pledged − received)   over OPEN pledges only
```

**The floor is per pledge, not on the total.** This is the defect the
expense feature's final review caught in `unreimbursedPersonal`: netting
globally let one person's overpayment silently cancel another person's debt.
Someone giving ₹6,000 against a ₹5,000 pledge must never erase ₹1,000 of
someone else's promise. Floor each pledge at zero, then sum.

## Pledge lifecycle

A pledge is **open** until it is either fully received or explicitly closed.

| State | Definition | Counts toward expectedOutstanding |
|---|---|---|
| **Open** | `closed_at is null` and `received < pledged` | **Yes** |
| **Received** | `received >= pledged` | No — it is in `collected` now |
| **Closed** | `closed_at is not null` | No — but the record survives |

The states are evaluated in that order, so a pledge that is both fully received
and closed reads as **Received** — what actually happened matters more than an
administrative flag, and both exclude it from the expected figure anyway.

**Closing** takes one tap and an optional note, and is available at any point —
before anything is paid, or after a partial payment. It drops the pledge out of
the expected figure immediately while keeping the full record visible:
`₹3,000 of ₹5,000 · closed — "moved away"`. Donations already received keep
their receipts untouched.

**Reopening** is allowed and is a single tap. Someone closed as "said no" who
turns up on the last day is reopened, not re-entered.

**Reducing** is allowed: the pledged amount is editable, for when someone says
₹5,000 turned into ₹2,000. Lowering it below what was already received is
harmless — the per-pledge floor makes the balance zero and the pledge reads as
settled. No database trigger is needed here, unlike the expense total, because
no cash figure depends on the pledged amount.

## Screens

**Collections page gains tabs: Received / Expected.** That page is
`src/features/donations/DonationsListPage.tsx`, routed at `/collect`. The
existing donations list becomes the Received tab, unchanged.

**Expected tab** lists open pledges, **largest outstanding first**, so chasing
effort goes where the money is. Each row shows the donor, `₹3,000 of ₹5,000`,
and who is chasing. Settled and closed pledges collapse into a separate,
quieter group below.

**Record receipt** opens the existing donation form pre-filled with the donor's
name, phone and the outstanding balance, with `pledge_id` attached. The
treasurer can change the amount before saving — that is the normal case, not an
exception.

**Home gains one tile: "Yet to receive ₹X"**, beside Collected, so the two dues
face each other: money owed to the mandal, money owed by it.

**Not in the public statement.** Who has not paid yet is committee business, not
donor business — the same treatment already given to donor phone, donor address
and vendor contact numbers. `public_donations` continues to expose only what it
exposes today; `pledges` is never joined into any public view.

## Error handling

- Deleting a pledge is admin-gated and confirmed, matching every other money
  deletion in the app. Its donations survive with `pledge_id` set to null.
- A pledge with `amount <= 0` is refused by a column `CHECK`, matching donations
  and expenses.
- Recording a receipt is an ordinary donation insert; its existing error path
  and receipt-number generation are unchanged.
- Every pledge mutation invalidates the pledge, pledge-status and donation query
  keys together, since a receipt moves all three.

## Out of scope

- Reminders, due dates, and WhatsApp nudges.
- Per-area or per-street targets — this is a named-person pledge list. A
  forecast model was considered and rejected.
- Pledge edit history.
- Any change to how donations, expenses, payments or balances work.

## Verification

Per the project's no-tests rule: `npm run typecheck`, `npm run build`, then a
manual click-through — create a ₹5,000 pledge, record ₹3,000 against it, confirm
Collected rises by ₹3,000 while "Yet to receive" falls to ₹2,000 and the receipt
number is generated; close it short and confirm the ₹2,000 leaves the expected
figure while the record and the ₹3,000 receipt remain.

The migration is applied by hand in the Supabase SQL editor (project
`kzlsuosriuahkqrmiiac`) **before** the frontend deploys, as with every migration
in this repo.
