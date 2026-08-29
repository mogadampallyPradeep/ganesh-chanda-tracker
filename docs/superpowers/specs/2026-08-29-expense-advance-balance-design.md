# Expense Advances & Balance — Design Spec

**Date:** 2026-08-29
**Status:** Approved design → ready for implementation plan
**Repo:** `mogadampallyPradeep/ganesh-chanda-tracker`
**Supersedes:** the single-payment expense model in `2026-08-24-ganesh-chanda-tracker-design.md`

## Purpose

Let a spend be **committed now and paid over time**. Book a ₹50,000 tent, pay a
₹10,000 advance today, settle the ₹40,000 balance on delivery — and have the
fund's cash position, per-member custody, and budget all stay truthful the
whole way through.

## The problem with today's model

`expenses.amount` means two things at once: *what we agreed to pay* and *what
has already left the fund*. Every money calculation reads it as the latter:

- `computeBalance` subtracts it from cash in hand / in bank.
- `computeHoldings` subtracts it from the paying member's custody.
- `computeBudget` counts it as actual spend.
- `public_summary` derives `cash_in_hand` from it.

With a ₹10,000 advance on a ₹50,000 booking, today's code reports ₹40,000 of
real cash as already spent, and flags the member who booked it as having spent
fund money they were not holding (`over = true`). Both are wrong.

**Committed and paid must become two separate numbers.**

## Data model

`expenses` becomes the commitment. Actual money movements go in a new child table.

```
expenses           id, category_id, description, payee, amount, note, created_at
                   amount = total agreed. source and paid_by are REMOVED.

expense_payments   id, expense_id → expenses(id) on delete cascade
                   amount int > 0
                   source spend_source (cash | bank | personal)
                   paid_by → committee_members(mobile), nullable
                   note, created_at
```

An expense paid in full at entry has exactly one payment row. Nothing about the
common case gets harder.

`paid_by` is nullable, matching today's `expenses.paid_by`, so the backfill
cannot fail on a historical row that never recorded a payer.

**`expense_status` view** — `expense_id, total, paid, balance, is_settled` — so
no caller recomputes the arithmetic.

**Overpayment triggers** — this is a cross-row invariant, so a `CHECK`
constraint cannot express it, and it has to be guarded from *both* sides:

- `before insert or update on expense_payments` — refuses a payment that would
  push `sum(payments)` above `expenses.amount`.
- `before update of amount on expenses` — refuses lowering a total below what
  has already been paid against it.

A trigger on the payments table alone would leave the second hole wide open:
you could book ₹50,000, pay ₹50,000, then edit the total down to ₹10,000 and
end up ₹40,000 overpaid with no error.

### Migration safety

The migration backfills one `expense_payments` row per existing expense (from
its current `amount` / `source` / `paid_by`) **before** dropping those two
columns, all in one transaction.

Production currently holds **0 expenses and 5 donations**. The backfill is a
no-op today, and donations are never touched. This is the cheapest possible
moment to make this change — the same migration mid-festival would carry real
risk.

## Money semantics

| Term | Definition | Drives |
|---|---|---|
| `committed` | Σ `expenses.amount` | budget actual, "total agreed" |
| `paidOut` | Σ `expense_payments.amount` | **all cash/bank deductions** |
| `outstanding` | `committed − paidOut` | the "Yet to pay" figure |
| `available` | `cashInHand + inBank` | unchanged — real money on hand |
| `freeAfterDues` | `available − outstanding` | **new** — genuinely uncommitted money |

`freeAfterDues` goes **negative** when you have committed to more than you
currently hold. That is a legitimate and important state, not an error: it is
the early warning that the mandal owes more than it has. Home renders it in the
negative colour with a plain-language line rather than hiding or clamping it.

Revised derivations:

```
cashInHand = offline donations − cash PAYMENTS − cash reimbursements
inBank     = online  donations − bank PAYMENTS − bank reimbursements
```

`Balance.spent` is renamed `paidOut`. The rename is deliberate: it forces every
call site to be revisited rather than silently keeping the old meaning.

## Component changes

**`domain/balance.ts`** — takes payments instead of expenses; returns
`committed`, `paidOut`, `outstanding`, `freeAfterDues` alongside the existing
fields.

**`domain/holdings.ts`** — takes payments. `paid_by` and `source` now live on
the payment, so custody and `owedBack` (personal payments minus reimbursements)
derive from payment rows. This is what keeps `over` from firing spuriously on a
part-paid booking.

**`domain/budget.ts`** — `actual` = **committed**, because a commitment consumes
its category's budget the moment it is made. `paid` is carried as a secondary
field per row. `over` is computed on committed. `computeShortfall.leftToSpend`
uses committed.

**`domain/activity.ts`** — `spent` events are built from **payments**, not
expenses. Detail line reads `description · source · by member`, with an
`advance` / `balance` / `part payment` qualifier when the expense has more than
one payment. An expense paid in full at entry yields one event, exactly as
today.

**`domain/statement.ts`** and `exportExcel` — the expenses sheet gains `Total`,
`Paid`, `Balance` columns; the summary sheet gains `Committed`, `Yet to pay`.

**`0005_public_views.sql`** — `public_expenses` exposes total/paid/balance;
`public_summary` computes `spent` from payments and adds `committed` and
`outstanding`.

## UI

**Expense form (new spend).** Fields: category, description, payee, **total
amount**, then **Paid now** (defaults to the full total), source, paid by.
Leaving *Paid now* untouched reproduces today's one-step flow. Reducing it
creates the commitment plus a partial payment.

**Expense detail.** A payments list (date · payer · source · amount) with **Add
payment**, whose amount defaults to the outstanding balance — one tap to settle.
Deleting a payment is allowed; deleting the expense cascades its payments.

**Expenses list.** Part-paid rows show a balance chip (`₹40,000 due`); settled
rows show nothing extra, so a fully-paid fund looks calm.

**Home.** A **Yet to pay** tile next to Available, plus `freeAfterDues` as the
supporting line. This is the number that answers "can we afford the next thing?"

**Budget page.** Per category: estimated, committed, paid, remaining.

**Public statement.** Total / paid / balance per expense; committed and
outstanding in the summary.

## Error handling

- Overpayment is refused by the trigger with a readable message
  (`Payments (₹X) would exceed the expense total (₹Y).`), surfaced inline in the
  payment form.
- A payment amount ≤ 0 is refused by a column `CHECK`, matching existing
  amount rules.
- Deleting the last payment leaves a fully-unpaid commitment. This is legal and
  intentional: it represents a booking with nothing paid yet.
- Every mutation invalidates the expenses, payments, balance, holdings and
  activity query keys together, since one payment moves all five.

## Out of scope

- Due dates, reminders, or vendor payment schedules.
- Partial reimbursements of a personal payment (a reimbursement still settles a
  member's total owed, unchanged).
- Any change to donations. The chanda side of the app is untouched.

## Verification

Per the project's no-tests rule: `npm run typecheck`, `npm run build`, then a
manual click-through — book a part-paid expense, confirm cash in hand drops by
the advance only, confirm the payer is not flagged `over`, settle the balance,
confirm the expense reads settled and cash drops by the remainder.

The migration is applied by hand in the Supabase SQL editor (project
`kzlsuosriuahkqrmiiac`) **before** the frontend deploys, as with `0007`.
