# Expense Advances & Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an expense be committed now and paid over time (advance + balance), while keeping the fund's cash position, per-member custody, and budget truthful.

**Architecture:** `expenses` becomes a commitment record; a new `expense_payments` child table records each actual movement of money with its own payer, source and date. Every money calculation that today reads `expenses.amount` switches to reading payments, while budgeting keeps reading the committed total. The schema change ships in two migrations — additive first, destructive last — so the deployed app and the database are never out of step.

**Tech Stack:** React 18 + TypeScript, Vite, TanStack Query, Tailwind, Supabase (Postgres + PostgREST), zod, xlsx.

**Spec:** `docs/superpowers/specs/2026-08-29-expense-advance-balance-design.md`

## Global Constraints

- **No test suite.** This project has no test runner by deliberate choice. Every task verifies with `npm run typecheck`, then `npm run build`, then the manual click-through named in that task. Do not add a test framework.
- **Amounts are integer rupees.** Never introduce floats. Format for display only, via `formatINR` from `src/lib/format.ts`.
- **Migrations are applied by hand** in the Supabase SQL editor for project `kzlsuosriuahkqrmiiac`. There is no Supabase CLI in this repo. A task that adds a migration is not complete until the human has run it and confirmed.
- **Production is live** with real donations. No migration may modify or delete a row in `donations`, `committee_members`, or `fund_settings`.
- **Every task ends green.** `npm run typecheck` and `npm run build` must both pass before the commit in that task's final step.
- **Follow existing style:** feature folders under `src/features/`, pure functions in `src/domain/`, TanStack Query hooks named `useX`, Tailwind tokens (`bg-surface`, `border-line`, `text-ink`, `text-ink-soft`, `text-neg`, `from-primary`), no comments explaining the obvious.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Payments table, status view, and overpayment guards

**Files:**
- Create: `supabase/migrations/0008_expense_payments.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: table `expense_payments(id uuid, expense_id uuid, amount int, source spend_source, paid_by text null, note text null, created_at timestamptz)`; view `expense_status(expense_id uuid, total int, paid int, balance int, is_settled boolean)`; triggers `trg_payment_not_over` and `trg_expense_total_not_below_paid`.

This migration is **additive only**. It does not drop `expenses.source` or `expenses.paid_by` — Task 11 does that, once no code reads them.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0008_expense_payments.sql
-- Expense advances & balance, phase 1 (additive).
--
-- expenses.amount stops meaning "money that left" and starts meaning
-- "total agreed". Actual movements of money live in expense_payments.
--
-- expenses.source / expenses.paid_by are intentionally LEFT IN PLACE here and
-- dropped in 0010, after the app has stopped reading them. That keeps the
-- deployed frontend consistent with the database at every point in the rollout.

create table expense_payments (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  amount     int  not null check (amount > 0),
  source     spend_source not null,
  paid_by    text references committee_members(mobile),
  note       text,
  created_at timestamptz not null default now()
);

create index on expense_payments (expense_id);

-- Backfill: every existing expense becomes one payment of its full amount.
-- Production has zero expenses today, so this is a no-op there; it exists so
-- the migration is correct for any row logged before it runs, and for anyone
-- rebuilding the database from migrations.
insert into expense_payments (expense_id, amount, source, paid_by, created_at)
  select id, amount, source, paid_by, created_at from expenses;

create or replace view expense_status as
  select
    e.id                                         as expense_id,
    e.amount                                     as total,
    coalesce(sum(p.amount), 0)::int              as paid,
    (e.amount - coalesce(sum(p.amount), 0))::int as balance,
    coalesce(sum(p.amount), 0) >= e.amount       as is_settled
  from expenses e
  left join expense_payments p on p.expense_id = e.id
  group by e.id, e.amount;

-- Overpayment is a cross-row invariant, so CHECK cannot express it. Guard it
-- from BOTH sides: a payment that is too large, and a total edited down below
-- what is already paid.
create or replace function assert_payment_within_total() returns trigger
language plpgsql as $fn$
declare
  v_total int;
  v_paid  int;
begin
  select amount into v_total from expenses where id = new.expense_id;
  select coalesce(sum(amount), 0) into v_paid
    from expense_payments
    where expense_id = new.expense_id and id <> new.id;

  if v_paid + new.amount > v_total then
    raise exception 'Payments (%) would exceed the expense total (%).',
      v_paid + new.amount, v_total;
  end if;
  return new;
end;
$fn$;

create trigger trg_payment_not_over
  before insert or update on expense_payments
  for each row execute function assert_payment_within_total();

create or replace function assert_total_not_below_paid() returns trigger
language plpgsql as $fn$
declare
  v_paid int;
begin
  select coalesce(sum(amount), 0) into v_paid
    from expense_payments where expense_id = new.id;

  if new.amount < v_paid then
    raise exception 'Total (%) is below what is already paid (%).',
      new.amount, v_paid;
  end if;
  return new;
end;
$fn$;

create trigger trg_expense_total_not_below_paid
  before update of amount on expenses
  for each row execute function assert_total_not_below_paid();

alter table expense_payments enable row level security;
create policy p_all on expense_payments for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on expense_payments to anon, authenticated;
grant select on expense_status to anon, authenticated;
```

- [ ] **Step 2: Ask the human to run it**

Print the SQL and ask them to paste it into the Supabase SQL editor for project `kzlsuosriuahkqrmiiac`. Do not proceed until they confirm. This migration adds tables and triggers only; it cannot alter `donations`.

- [ ] **Step 3: Verify it landed, read-only**

```bash
cd /d/Repos/ganesh-chanda-tracker
URL=$(grep -oE "https://[a-z0-9]+\.supabase\.co" .env | head -1)
KEY=$(grep "^VITE_SUPABASE_ANON_KEY=" .env | sed 's/^VITE_SUPABASE_ANON_KEY=//' | tr -d '"\r')
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/expense_status?select=*"
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/expense_payments?select=*"
```

Expected: both return `[]` (no expenses exist yet), not a "relation does not exist" error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_expense_payments.sql
git commit -m "feat(db): expense_payments ledger, status view, overpayment guards"
```

---

### Task 2: Payment types and query hooks

**Files:**
- Modify: `src/types/db.ts`
- Create: `src/features/expenses/useExpensePayments.ts`

**Interfaces:**
- Consumes: Task 1's `expense_payments` table and `expense_status` view.
- Produces: types `ExpensePayment`, `ExpenseStatus`; `paymentKeys`, `useExpensePayments()`, `useExpenseStatus()`, `useAddPayment()`, `useDeletePayment()`, `CreatePaymentInput`.

`Expense` keeps `source` and `paid_by` for now — Task 11 removes them. Nothing here breaks existing code.

- [ ] **Step 1: Add the types**

Append to `src/types/db.ts`:

```ts
export interface ExpensePayment {
  id: string
  expense_id: string
  amount: number
  source: SpendSource
  paid_by: string | null
  note: string | null
  created_at: string
}

export interface ExpenseStatus {
  expense_id: string
  total: number
  paid: number
  balance: number
  is_settled: boolean
}
```

- [ ] **Step 2: Create the hooks**

```ts
// src/features/expenses/useExpensePayments.ts
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { expenseKeys } from './useExpenses'
import type { ExpensePayment, ExpenseStatus, SpendSource } from '../../types/db'

export const paymentKeys = {
  all: ['expense_payments'] as const,
  status: ['expense_status'] as const,
}

export function useExpensePayments() {
  return useQuery({
    queryKey: paymentKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_payments')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return data as ExpensePayment[]
    },
  })
}

export function useExpenseStatus() {
  return useQuery({
    queryKey: paymentKeys.status,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_status').select('*')
      if (error) throw new Error(error.message)
      return data as ExpenseStatus[]
    },
  })
}

export interface CreatePaymentInput {
  expense_id: string
  amount: number
  source: SpendSource
  paid_by: string | null
  note?: string | null
}

/** One payment moves the fund balance, member custody and the activity feed,
 *  so every dependent key is invalidated together. */
function invalidateMoney(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: paymentKeys.all })
  queryClient.invalidateQueries({ queryKey: paymentKeys.status })
  queryClient.invalidateQueries({ queryKey: expenseKeys.all })
}

export function useAddPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase.from('expense_payments').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data as ExpensePayment
    },
    onSuccess: () => invalidateMoney(queryClient),
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_payments').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidateMoney(queryClient),
  })
}
```

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`
Expected: both pass. Nothing consumes these yet.

- [ ] **Step 4: Commit**

```bash
git add src/types/db.ts src/features/expenses/useExpensePayments.ts
git commit -m "feat(expenses): payment types and query hooks"
```

---

### Task 3: Fund balance derives from payments

**Files:**
- Modify: `src/domain/balance.ts`
- Modify: `src/features/home/HomePage.tsx` (lines 52, 60)
- Modify: `src/features/budget/BudgetPage.tsx` (lines 40, 45)
- Modify: `src/features/committee/CommitteePage.tsx` (line 47)
- Modify: `src/features/export/useExportStatement.ts` (line 48)

**Interfaces:**
- Consumes: `ExpensePayment`, `useExpensePayments()` (Task 2).
- Produces: `computeBalance(donations, expenses, payments, reimbursements)` returning `Balance { collected, committed, paidOut, outstanding, available, freeAfterDues, cashInHand, inBank }`. **`spent` no longer exists** — the rename is deliberate, so every call site must be revisited rather than silently keep the old meaning.

- [ ] **Step 1: Rewrite the balance calculation**

```ts
// src/domain/balance.ts
import type { Donation, Expense, ExpensePayment, Reimbursement } from '../types/db'

export interface Balance {
  collected: number
  committed: number // total agreed across all expenses
  paidOut: number // money that has actually left the fund
  outstanding: number // committed − paidOut, i.e. yet to pay
  available: number // cash in hand + in bank (real money)
  freeAfterDues: number // available − outstanding; negative is a real warning
  cashInHand: number
  inBank: number
}

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((t, r) => t + pick(r), 0)

/**
 * Fund balance, derived from rows (never stored).
 * Cash and bank move on PAYMENTS, not on expense totals — an unpaid balance
 * has not left the fund and must not be deducted from it.
 */
export function computeBalance(
  donations: Pick<Donation, 'amount' | 'method'>[],
  expenses: Pick<Expense, 'amount'>[],
  payments: Pick<ExpensePayment, 'amount' | 'source'>[],
  reimbursements: Pick<Reimbursement, 'amount' | 'source'>[] = [],
): Balance {
  const collected = sum(donations, (d) => d.amount)
  const committed = sum(expenses, (e) => e.amount)
  const paidOut = sum(payments, (p) => p.amount)

  const cashInHand =
    sum(donations.filter((d) => d.method === 'offline'), (d) => d.amount) -
    sum(payments.filter((p) => p.source === 'cash'), (p) => p.amount) -
    sum(reimbursements.filter((r) => r.source === 'cash'), (r) => r.amount)

  const inBank =
    sum(donations.filter((d) => d.method === 'online'), (d) => d.amount) -
    sum(payments.filter((p) => p.source === 'bank'), (p) => p.amount) -
    sum(reimbursements.filter((r) => r.source === 'bank'), (r) => r.amount)

  const available = cashInHand + inBank
  const outstanding = committed - paidOut

  return {
    collected,
    committed,
    paidOut,
    outstanding,
    available,
    freeAfterDues: available - outstanding,
    cashInHand,
    inBank,
  }
}
```

- [ ] **Step 2: Update all four call sites**

In each file, call `useExpensePayments()` alongside the existing queries and pass `payments ?? []` as the third argument. Replace every read of `balance.spent` with `balance.paidOut`.

In `HomePage.tsx` and `BudgetPage.tsx`, the shortfall call changes to use `committed`, because money you have committed is no longer free to spend whether or not it has left yet:

```ts
const { data: payments } = useExpensePayments()

const balance = useMemo(
  () => computeBalance(donations, expenses, payments ?? [], reimbursements),
  [donations, expenses, payments, reimbursements],
)

const shortfall = useMemo(
  () => computeShortfall(budget.totalEstimated, balance.collected, balance.committed),
  [budget.totalEstimated, balance.collected, balance.committed],
)
```

In `useExportStatement.ts`, the summary object it builds must use `paidOut` for the "Spent" row.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`
Expected: pass. Any remaining `.spent` error is the rename doing its job — fix that call site.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open Home. With no expenses, Available must equal Collected and outstanding must be zero.

- [ ] **Step 5: Commit**

```bash
git add src/domain/balance.ts src/features/home/HomePage.tsx src/features/budget/BudgetPage.tsx src/features/committee/CommitteePage.tsx src/features/export/useExportStatement.ts
git commit -m "feat(balance): derive cash and bank from payments, add outstanding"
```

---

### Task 4: Member custody derives from payments

**Files:**
- Modify: `src/domain/holdings.ts`
- Modify: `src/features/committee/CommitteePage.tsx` (line 34)

**Interfaces:**
- Consumes: `ExpensePayment` (Task 2).
- Produces: `computeHoldings(members, donations, payments, reimbursements)` — the `expenses` parameter is replaced by `payments`. The `MemberHolding` shape is unchanged.

This is the task that stops a part-paid booking from falsely flagging its payer as `over`.

- [ ] **Step 1: Swap expenses for payments**

Change the import and signature in `src/domain/holdings.ts`:

```ts
import type { CommitteeMember, Donation, ExpensePayment, Reimbursement } from '../types/db'

export function computeHoldings(
  members: CommitteeMember[],
  donations: Pick<Donation, 'amount' | 'method' | 'collected_by'>[],
  payments: Pick<ExpensePayment, 'amount' | 'source' | 'paid_by'>[],
  reimbursements: Pick<Reimbursement, 'amount' | 'source' | 'member_id' | 'from_member_id'>[],
): MemberHolding[] {
```

Inside the `members.map`, replace the three expense sums with payment sums — identical shape, different source rows:

```ts
const paidCash = sum(payments.filter((p) => p.paid_by === m.mobile && p.source === 'cash'), (p) => p.amount)
const paidBank = sum(payments.filter((p) => p.paid_by === m.mobile && p.source === 'bank'), (p) => p.amount)
const personal = sum(payments.filter((p) => p.paid_by === m.mobile && p.source === 'personal'), (p) => p.amount)
```

Update the docblock to say custody moves on payments, not commitments.

- [ ] **Step 2: Update CommitteePage**

Pass `payments ?? []` where `expenses` was passed at line 34.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/holdings.ts src/features/committee/CommitteePage.tsx
git commit -m "feat(holdings): custody follows payments, not commitments"
```

---

### Task 5: Budget shows committed and paid

**Files:**
- Modify: `src/domain/budget.ts`
- Modify: `src/features/budget/BudgetPage.tsx`
- Modify: `src/features/home/HomePage.tsx` (line 56)

**Interfaces:**
- Consumes: `ExpensePayment` (Task 2).
- Produces: `computeBudget(categories, estimates, expenses, payments)`; `BudgetRow` gains `paid: number`; `Budget` gains `totalPaid: number`. `actual` keeps its name and now means **committed**.

Per the spec, a commitment consumes its category's budget the moment it is made, so `actual` and `over` are computed on committed totals; `paid` rides along as secondary information.

- [ ] **Step 1: Add payments to the budget calculation**

In `src/domain/budget.ts`, extend the interfaces:

```ts
export interface BudgetRow {
  categoryId: string
  name: string
  estimated: number
  actual: number // committed
  paid: number // actually paid out so far
  remaining: number
  over: boolean
  percent: number
}

export interface Budget {
  rows: BudgetRow[]
  totalEstimated: number
  totalActual: number
  totalPaid: number
  unbudgeted: number
}
```

Add a fourth parameter and a per-category paid map. Payments carry no `category_id`, so join through the expense:

```ts
export function computeBudget(
  categories: Category[],
  estimates: Estimate[],
  expenses: Pick<Expense, 'id' | 'category_id' | 'amount'>[],
  payments: Pick<ExpensePayment, 'expense_id' | 'amount'>[],
): Budget {
  const catOfExpense = new Map(expenses.map((e) => [e.id, e.category_id]))
  const paidByCat = new Map<string, number>()
  for (const p of payments) {
    const cat = catOfExpense.get(p.expense_id)
    if (!cat) continue
    paidByCat.set(cat, (paidByCat.get(cat) ?? 0) + p.amount)
  }
```

Set `paid: paidByCat.get(c.id) ?? 0` on each row, and `totalPaid: sum(rows, (r) => r.paid)` on the result. Everything else is unchanged.

Note the `Pick` on expenses now includes `'id'` — it is required for the join.

- [ ] **Step 2: Update both call sites**

Pass `payments ?? []` as the fourth argument in `BudgetPage.tsx` and `HomePage.tsx`.

- [ ] **Step 3: Show paid in the budget table**

In `BudgetPage.tsx`, add a "Paid" figure under each row's actual, shown only when `row.paid !== row.actual` so fully-paid categories stay uncluttered:

```tsx
{row.paid !== row.actual && (
  <span className="text-xs text-ink-soft">{formatINR(row.paid)} paid</span>
)}
```

- [ ] **Step 4: Verify green**

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/budget.ts src/features/budget/BudgetPage.tsx src/features/home/HomePage.tsx
git commit -m "feat(budget): actual is committed, paid shown alongside"
```

---

### Task 6: Activity feed is built from payments

**Files:**
- Modify: `src/domain/activity.ts`
- Modify: `src/features/activity/useActivity.ts` (line 35)

**Interfaces:**
- Consumes: `ExpensePayment` (Task 2).
- Produces: `buildActivity(donations, expenses, payments, reimbursements, categories, members)` — note the new third parameter. `ActivityItem` is unchanged.

A spend event is now a payment, not a commitment. An expense paid in full on creation still produces exactly one event, so the feed feels unchanged for ordinary spends.

- [ ] **Step 1: Build spend events from payments**

Replace the `spent` block in `src/domain/activity.ts`:

```ts
const expenseById = new Map(expenses.map((e) => [e.id, e]))
const paymentCount = new Map<string, number>()
for (const p of payments) paymentCount.set(p.expense_id, (paymentCount.get(p.expense_id) ?? 0) + 1)

const orderOf = new Map<string, number>()
const spent: ActivityItem[] = payments.map((p) => {
  const expense = expenseById.get(p.expense_id)
  const seq = (orderOf.get(p.expense_id) ?? 0) + 1
  orderOf.set(p.expense_id, seq)

  // Only qualify the amount when an expense was actually paid in instalments;
  // a single full payment reads exactly as it did before this feature.
  const isSplit = (paymentCount.get(p.expense_id) ?? 0) > 1
  const qualifier = isSplit ? (seq === 1 ? 'advance · ' : 'part payment · ') : ''

  return {
    id: `p-${p.id}`,
    kind: 'spent',
    title: expense ? (catName.get(expense.category_id) ?? 'Spend') : 'Spend',
    detail: `${expense?.description ?? ''} · ${qualifier}${sourceLabel[p.source]} · by ${nameOf(p.paid_by)}`,
    involves: p.paid_by ? [p.paid_by] : [],
    amount: p.amount,
    createdAt: p.created_at,
  }
})
```

Change `sourceLabel` to be keyed on `ExpensePayment['source']`, and add `payments: ExpensePayment[]` as the third parameter of `buildActivity`.

- [ ] **Step 2: Update useActivity**

Fetch payments via `useExpensePayments()` and pass them as the third argument.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/activity.ts src/features/activity/useActivity.ts
git commit -m "feat(activity): spend events come from payments"
```

---

### Task 7: Logging a spend records a commitment plus its first payment

**Files:**
- Modify: `src/features/expenses/expenseSchema.ts`
- Modify: `src/features/expenses/ExpenseForm.tsx`
- Modify: `src/features/expenses/useExpenses.ts`

**Interfaces:**
- Consumes: `useAddPayment()`, `CreatePaymentInput` (Task 2).
- Produces: `useCreateExpenseWithPayment()` returning the created `Expense`; `expenseSchema` gains `paid_now: number`.

The ordinary case must stay one step: **`paid_now` defaults to the full amount**, so a user who ignores it gets exactly today's behaviour.

- [ ] **Step 1: Extend the schema**

```ts
export const expenseSchema = z
  .object({
    category_id: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
    payee: z.string().optional(),
    amount: z.number().int().positive('Enter an amount'),
    paid_now: z.number().int().min(0, 'Cannot be negative'),
    paid_by: z.string().min(1, 'Paid by is required'),
    source: z.enum(['cash', 'bank', 'personal']),
    note: z.string().optional(),
  })
  .refine((v) => v.paid_now <= v.amount, {
    path: ['paid_now'],
    message: 'Paid now cannot exceed the total',
  })
```

- [ ] **Step 2: Add the combined mutation**

In `useExpenses.ts`, add a mutation that inserts the expense and, when `paid_now > 0`, its first payment. If the payment insert fails, delete the just-created expense so a half-written spend is never left behind — PostgREST gives no client transaction, so this compensating delete is the safety net:

```ts
export interface CreateExpenseWithPaymentInput {
  category_id: string
  description: string
  payee: string | null
  amount: number
  paid_now: number
  paid_by: string
  source: SpendSource
  note: string | null
}

export function useCreateExpenseWithPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateExpenseWithPaymentInput) => {
      const { paid_now, paid_by, source, ...expenseFields } = input

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({ ...expenseFields, paid_by, source })
        .select()
        .single()
      if (error) throw new Error(error.message)

      if (paid_now > 0) {
        const { error: payErr } = await supabase.from('expense_payments').insert({
          expense_id: (expense as Expense).id,
          amount: paid_now,
          source,
          paid_by,
        })
        if (payErr) {
          await supabase.from('expenses').delete().eq('id', (expense as Expense).id)
          throw new Error(payErr.message)
        }
      }

      return expense as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      queryClient.invalidateQueries({ queryKey: paymentKeys.status })
    },
  })
}
```

Note: `source` and `paid_by` are still written to `expenses` here because those columns exist until Task 11. Task 11 removes them from this insert.

- [ ] **Step 3: Add the Paid now field**

In `ExpenseForm.tsx`, `paid_now` follows the total until the user edits it — so a
user who never touches the field gets exactly today's behaviour:

```tsx
const [paidNow, setPaidNow] = useState(0)
const [paidNowTouched, setPaidNowTouched] = useState(false)

// Mirror the total until the user takes control of this field.
useEffect(() => {
  if (!paidNowTouched) setPaidNow(amount)
}, [amount, paidNowTouched])

<label className="flex flex-col gap-1.5">
  <span className="text-xs text-ink-soft tracking-wide">Paid now</span>
  <AmountInput
    value={paidNow}
    onChange={(v) => {
      setPaidNowTouched(true)
      setPaidNow(v)
    }}
  />
  {paidNow < amount ? (
    <span className="text-xs text-ink-soft">
      Balance {formatINR(amount - paidNow)} due later
    </span>
  ) : (
    <span className="text-xs text-ink-soft">
      Leave as the full amount unless you are paying an advance.
    </span>
  )}
</label>
```

- [ ] **Step 4: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 5: Manual check**

Log a ₹1,000 spend leaving *Paid now* alone — Home's Available must drop by ₹1,000. Log a ₹5,000 spend with *Paid now* = ₹1,000 — Available must drop by only ₹1,000, and the payer must not be flagged as over on the Committee page.

- [ ] **Step 6: Commit**

```bash
git add src/features/expenses/
git commit -m "feat(expenses): record an advance when logging a spend"
```

---

### Task 8: Payments section on the expense detail page

**Files:**
- Create: `src/features/expenses/ExpensePayments.tsx`
- Modify: `src/features/expenses/ExpenseEditPage.tsx`

**Interfaces:**
- Consumes: `useExpensePayments()`, `useAddPayment()`, `useDeletePayment()` (Task 2), `formatINR`/`formatDate` from `src/lib/format.ts`.
- Produces: `<ExpensePayments expenseId={string} total={number} />`.

- [ ] **Step 1: Build the component**

Filter client-side from `useExpensePayments()` by `expense_id` rather than adding a
per-expense query — the dataset is one festival's spends and is already loaded.

```tsx
export function ExpensePayments({ expenseId, total }: { expenseId: string; total: number }) {
  const { data: allPayments } = useExpensePayments()
  const { data: members } = useCommitteeMembers()
  const addPayment = useAddPayment()
  const deletePayment = useDeletePayment()

  const payments = (allPayments ?? []).filter((p) => p.expense_id === expenseId)
  const paid = payments.reduce((t, p) => t + p.amount, 0)
  const balance = total - paid

  const [amount, setAmount] = useState(0)
  const [source, setSource] = useState<SpendSource>('cash')
  const [paidBy, setPaidBy] = useState('')

  // Default the new payment to whatever is outstanding, so settling is one tap.
  useEffect(() => setAmount(balance), [balance])

  const error = addPayment.error ?? deletePayment.error

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-ink font-semibold">{formatINR(paid)} paid</span>
        {balance > 0 ? (
          <span className="text-neg text-sm">{formatINR(balance)} due</span>
        ) : (
          <span className="text-xs text-ink-soft border border-line rounded-full px-2 py-0.5">
            ✓ Settled
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-soft truncate">
              {formatDate(p.created_at)} · {nameOf(members, p.paid_by)} · {p.source}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-ink">{formatINR(p.amount)}</span>
              <button
                type="button"
                onClick={() => deletePayment.mutate(p.id)}
                className="text-xs text-neg"
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      {/* The trigger's overpayment message must reach the user verbatim. */}
      {error && <p className="text-neg text-sm">{(error as Error).message}</p>}

      {balance > 0 && (
        <button
          type="button"
          disabled={addPayment.isPending || amount <= 0 || !paidBy}
          onClick={() =>
            addPayment.mutate({ expense_id: expenseId, amount, source, paid_by: paidBy })
          }
          className="rounded-xl px-4 py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
        >
          Add payment
        </button>
      )}
    </div>
  )
}
```

Above the button, render an `AmountInput` bound to `amount`, the existing
`MethodToggle`-style source selector bound to `source`, and a member `<select>`
bound to `paidBy`. `nameOf` is a local helper mapping a mobile to a member name,
matching the one in `domain/activity.ts`.

**Deleting the last payment is allowed** and leaves a fully-unpaid commitment —
per the spec that is a legitimate state (a booking with nothing paid yet), not an
error to block.

- [ ] **Step 2: Mount it**

Render `<ExpensePayments expenseId={id} total={expense.amount} />` below the edit form in `ExpenseEditPage.tsx`, separated by the standard `bg-surface border border-line rounded-2xl p-4` card.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Manual check**

Open the ₹5,000 part-paid expense, add a ₹4,000 payment, confirm it reads Settled and Available drops by ₹4,000. Then try adding one more rupee and confirm the trigger's message appears inline rather than failing silently.

- [ ] **Step 5: Commit**

```bash
git add src/features/expenses/ExpensePayments.tsx src/features/expenses/ExpenseEditPage.tsx
git commit -m "feat(expenses): payments list and add-payment on expense detail"
```

---

### Task 9: Balance surfaced in the list and on Home

**Files:**
- Modify: `src/features/expenses/ExpensesListPage.tsx`
- Modify: `src/features/home/HomePage.tsx`

**Interfaces:**
- Consumes: `useExpenseStatus()` (Task 2), `Balance.outstanding` and `Balance.freeAfterDues` (Task 3).
- Produces: no new exports.

- [ ] **Step 1: Balance chip in the list**

In `ExpensesListPage.tsx`, join each row against `useExpenseStatus()` and render a chip **only when `balance > 0`**, so a fully-settled fund looks calm:

```tsx
{status && status.balance > 0 && (
  <span className="text-xs text-neg border border-line rounded-full px-2 py-0.5">
    {formatINR(status.balance)} due
  </span>
)}
```

- [ ] **Step 2: Yet to pay tile on Home**

Add a `StatCard` for `balance.outstanding` labelled **Yet to pay**, placed next to Available. Beneath the tile row, when `balance.outstanding > 0`, add a supporting line:

```tsx
<p className={balance.freeAfterDues < 0 ? 'text-neg text-sm' : 'text-ink-soft text-sm'}>
  {balance.freeAfterDues < 0
    ? `Committed ${formatINR(-balance.freeAfterDues)} more than the fund holds`
    : `${formatINR(balance.freeAfterDues)} free after dues`}
</p>
```

Negative `freeAfterDues` is a legitimate warning state per the spec — render it, never clamp it.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Manual check**

With one part-paid expense, the list shows the due chip and Home shows a matching "Yet to pay".

- [ ] **Step 5: Commit**

```bash
git add src/features/expenses/ExpensesListPage.tsx src/features/home/HomePage.tsx
git commit -m "feat(ui): show outstanding balance in list and on home"
```

---

### Task 10: Public statement and Excel export

**Files:**
- Create: `supabase/migrations/0009_public_views_payments.sql`
- Modify: `src/domain/statement.ts`
- Modify: `src/features/export/exportExcel.ts`
- Modify: `src/features/export/useExportStatement.ts`
- Modify: `src/features/public/PublicStatementPage.tsx`
- Modify: `src/features/public/usePublicStatement.ts`

**Interfaces:**
- Consumes: `expense_status` (Task 1), `Balance` (Task 3).
- Produces: `PublicExpenseRow` gains `paid: number` and `balance: number`; `StatementSummary` gains `committed: number` and `outstanding: number`.

- [ ] **Step 1: Update the public views**

```sql
-- supabase/migrations/0009_public_views_payments.sql
-- Public statement reflects committed vs paid. Donor phone and address remain
-- excluded, exactly as before.

create or replace view public_expenses as
  select
    c.name as category_name,
    e.description,
    e.amount as amount,
    s.paid,
    s.balance,
    e.created_at
  from expenses e
  join categories c on c.id = e.category_id
  join expense_status s on s.expense_id = e.id;

create or replace view public_summary as
  select collected, committed, spent, outstanding, cash_in_hand, in_bank,
         (cash_in_hand + in_bank) as available
  from (
    select
      (select coalesce(sum(amount), 0) from donations)        as collected,
      (select coalesce(sum(amount), 0) from expenses)         as committed,
      (select coalesce(sum(amount), 0) from expense_payments) as spent,
      (select coalesce(sum(amount), 0) from expenses)
        - (select coalesce(sum(amount), 0) from expense_payments) as outstanding,
      ( (select coalesce(sum(amount), 0) from donations where method = 'offline')
        - (select coalesce(sum(amount), 0) from expense_payments where source = 'cash')
        - (select coalesce(sum(amount), 0) from reimbursements where source = 'cash')
      ) as cash_in_hand,
      ( (select coalesce(sum(amount), 0) from donations where method = 'online')
        - (select coalesce(sum(amount), 0) from expense_payments where source = 'bank')
        - (select coalesce(sum(amount), 0) from reimbursements where source = 'bank')
      ) as in_bank
  ) t;

grant select on public_expenses, public_summary to anon, authenticated;
```

Note `public_expenses` drops the `source` column: with several payments per expense there is no single source any more. Remove it from `PublicExpenseRow` and from the public page's table.

- [ ] **Step 2: Ask the human to run it, then verify**

Same process as Task 1. Verify with a read of `public_summary` and confirm `spent` and `committed` both appear.

- [ ] **Step 3: Update the statement sheets**

In `src/domain/statement.ts`, the expenses sheet header becomes `['Category', 'Description', 'Total', 'Paid', 'Balance']` with a total row reading `Total Committed`, and the summary sheet becomes:

```ts
const summary: Sheet = [
  ['Collected', s.collected],
  ['Committed', s.committed],
  ['Paid out', s.spent],
  ['Yet to pay', s.outstanding],
  ['Available (cash + bank)', s.available],
  ['Cash in hand', s.cashInHand],
  ['In bank', s.inBank],
]
```

- [ ] **Step 4: Update the public page**

`PublicStatementPage.tsx` shows Total / Paid / Balance per expense and adds "Yet to pay" to its summary block.

- [ ] **Step 5: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 6: Manual check**

Open the public statement link and download the Excel export; confirm the part-paid expense shows total, paid and balance in both.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0009_public_views_payments.sql src/domain/statement.ts src/features/export/ src/features/public/
git commit -m "feat(statement): public view and export show committed vs paid"
```

---

### Task 11: Drop the superseded expense columns

**Files:**
- Create: `supabase/migrations/0010_drop_expense_source.sql`
- Modify: `src/types/db.ts`
- Modify: `src/features/expenses/useExpenses.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `Expense` without `source` and `paid_by`.

Run this **only after Tasks 1–10 are deployed and working**. This is the one destructive step in the feature, and by this point nothing reads the columns.

- [ ] **Step 1: Confirm nothing reads them**

```bash
cd /d/Repos/ganesh-chanda-tracker
grep -rn "\.source\|paid_by" src --include=*.ts --include=*.tsx | grep -v "expense_payments\|ExpensePayment\|payment\|reimb\|donation"
```

Expected: no hits referring to an `Expense`. Fix any that remain before continuing.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/0010_drop_expense_source.sql
-- Phase 2. These columns were superseded by expense_payments in 0008 and their
-- values were copied there by that migration's backfill. Nothing reads them.

alter table expenses drop column source;
alter table expenses drop column paid_by;
```

- [ ] **Step 3: Back up first, then ask the human to run it**

```bash
cd /d/Repos/ganesh-chanda-tracker
URL=$(grep -oE "https://[a-z0-9]+\.supabase\.co" .env | head -1)
KEY=$(grep "^VITE_SUPABASE_ANON_KEY=" .env | sed 's/^VITE_SUPABASE_ANON_KEY=//' | tr -d '"\r')
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/expenses?select=*" > expenses-backup.json
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/expense_payments?select=*" > payments-backup.json
```

Write these outside the repo (they are working files, not artefacts to commit). Confirm each expense has payments summing to what its old `amount`/`source` implied before dropping anything.

- [ ] **Step 4: Remove the fields from the type and the insert**

Delete `source` and `paid_by` from the `Expense` interface in `src/types/db.ts`, and from the expense insert in `useCreateExpenseWithPayment` — they now belong solely to the payment insert. Drop them from `CreateExpenseInput` too.

- [ ] **Step 5: Verify green**

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 6: Manual check**

Log a fresh spend end to end; confirm it appears in the list, the activity feed, the budget, and the public statement.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0010_drop_expense_source.sql src/types/db.ts src/features/expenses/useExpenses.ts
git commit -m "refactor(expenses): drop source and paid_by, superseded by payments"
```

---

## Rollout order

1. Tasks 1–9 built and merged, migration `0008` run **before** the frontend deploys.
2. Task 10 — run `0009` before deploying, same rule.
3. Task 11 last, once the app has been exercised in production for at least a session.

At every point between these steps the deployed app and the database agree, so a rollback is a `git revert` and a redeploy with no schema surgery.
