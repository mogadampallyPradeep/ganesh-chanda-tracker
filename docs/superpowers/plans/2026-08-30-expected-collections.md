# Expected Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record what people have promised to give, so the mandal can see how much more it can still expect and chase it — without ever confusing a promise with money in hand.

**Architecture:** A `pledges` table holds named promises. A pledge's payments are ordinary `donations` rows carrying a new nullable `pledge_id`, so receiving money flows through the existing receipt-number trigger and the existing balance maths with no special-casing. Pledged money never enters any balance figure; the only new number is `expectedOutstanding`, floored per pledge and counted over open pledges only.

**Tech Stack:** React 18 + TypeScript, Vite, TanStack Query, Tailwind, Supabase (Postgres + PostgREST), zod, react-hook-form.

**Spec:** `docs/superpowers/specs/2026-08-30-expected-collections-design.md`

## Global Constraints

- **No test suite.** This project has no test runner by deliberate choice. Every task verifies with `npm run typecheck`, then `npm run build`, then the manual check named in that task. Do not add a test framework.
- **Amounts are integer rupees.** Never introduce floats. Format for display only, via `formatINR` from `src/lib/format.ts`.
- **Migrations are applied by hand** in the Supabase SQL editor for project `kzlsuosriuahkqrmiiac`. There is no Supabase CLI in this repo. A task that adds a migration is not complete until the human has run it and confirmed.
- **Production is live** with real donations, one real expense and its payment. No migration may modify or delete a row in `donations`, `expenses`, `expense_payments`, `committee_members` or `fund_settings`.
- **Pledged money must never enter `collected`, `available`, `cashInHand` or `inBank`.** `src/domain/balance.ts` is not modified by any task in this plan. If you find yourself editing it, stop — you have misread the design.
- **Query keys live in leaf modules.** `pledgeKeys` goes in `src/features/pledges/keys.ts` and nothing else lives there. `useDonations.ts` may import that file; `usePledges.ts` may import `donationKeys` from `useDonations.ts`. Never make `useDonations.ts` import from `usePledges.ts` — that recreates a circular-import hazard this repo has already been bitten by.
- **Nothing about pledges reaches the public statement.** Do not add `pledges` or `pledge_id` to `public_donations`, `public_expenses` or `public_summary`.
- **Every task ends green:** `npm run typecheck` and `npm run build` must both pass before that task's commit.
- **Follow existing style:** feature folders under `src/features/`, pure functions in `src/domain/`, hooks named `useX`, Tailwind tokens (`bg-surface`, `bg-surface-2`, `border-line`, `text-ink`, `text-ink-soft`, `text-neg`, `text-pos`, `from-primary`, `rounded-2xl`), no comments explaining the obvious.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Pledges table, donation link, and status view

**Files:**
- Create: `supabase/migrations/0013_pledges.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: table `pledges(id uuid, donor_name text, phone text, address text, amount int, note text, assigned_to text, closed_at timestamptz, closed_note text, created_at timestamptz)`; column `donations.pledge_id uuid`; view `pledge_status(pledge_id uuid, pledged int, received int, balance int, is_settled boolean)`.

Additive only. Adding a nullable column to `donations` does not disturb `public_donations`, which selects named columns.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0013_pledges.sql
-- Expected collections: named promises to give.
--
-- A pledge's payments are ordinary donations carrying pledge_id, so money
-- becomes real through the existing insert path and picks up its receipt number
-- from trg_set_receipt_no. There is no separate payment table.
--
-- Additive only: a new table, a new nullable column, a new view. No existing
-- row is modified. public_donations selects named columns and never sees
-- pledge_id, so the public statement is untouched.

create table pledges (
  id          uuid primary key default gen_random_uuid(),
  donor_name  text not null,
  phone       text,
  address     text,
  amount      int  not null check (amount > 0),
  note        text,
  assigned_to text references committee_members(mobile),
  closed_at   timestamptz,
  closed_note text,
  created_at  timestamptz not null default now()
);

-- on delete set null: deleting a pledge must NEVER delete a receipt.
-- Promises are disposable; money is not.
alter table donations add column pledge_id uuid references pledges(id) on delete set null;

create index on donations (pledge_id);

create or replace view pledge_status as
  select
    p.id                                          as pledge_id,
    p.amount                                      as pledged,
    coalesce(sum(d.amount), 0)::int               as received,
    greatest(p.amount - coalesce(sum(d.amount), 0), 0)::int as balance,
    coalesce(sum(d.amount), 0) >= p.amount        as is_settled
  from pledges p
  left join donations d on d.pledge_id = p.id
  group by p.id, p.amount;

alter table pledges enable row level security;
create policy p_all on pledges for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on pledges to anon, authenticated;
grant select on pledge_status to anon, authenticated;
```

Note `greatest(..., 0)` on `balance`: the floor lives in the view as well as in the client, so an over-received pledge can never report a negative balance to any caller.

- [ ] **Step 2: Ask the human to run it**

Print the SQL and ask them to paste it into the Supabase SQL editor for project `kzlsuosriuahkqrmiiac`. Do not proceed until they confirm. This migration creates a table, a column and a view; it cannot alter existing rows.

- [ ] **Step 3: Verify it landed, read-only**

```bash
cd /d/Repos/ganesh-chanda-tracker
URL=$(grep -oE "https://[a-z0-9]+\.supabase\.co" .env | head -1)
KEY=$(grep "^VITE_SUPABASE_ANON_KEY=" .env | sed 's/^VITE_SUPABASE_ANON_KEY=//' | tr -d '"\r')
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/pledge_status?select=*"
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/donations?select=id,pledge_id" | head -c 200
```

Expected: `pledge_status` returns `[]`; the donations query returns the 5 existing rows each with `"pledge_id":null`. A "relation does not exist" or "column does not exist" error means the migration did not run.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0013_pledges.sql
git commit -m "feat(db): pledges table, donation link, and status view"
```

---

### Task 2: Pledge types and query hooks

**Files:**
- Modify: `src/types/db.ts`
- Create: `src/features/pledges/keys.ts`
- Create: `src/features/pledges/usePledges.ts`

**Interfaces:**
- Consumes: Task 1's `pledges` table and `pledge_status` view.
- Produces: types `Pledge`, `PledgeStatus`; `Donation` gains `pledge_id: string | null`; `pledgeKeys`; `usePledges()`, `usePledgeStatus()`, `useCreatePledge()`, `useUpdatePledge()`, `useClosePledge()`, `useReopenPledge()`, `useDeletePledge()`; input types `CreatePledgeInput`, `UpdatePledgeInput`.

- [ ] **Step 1: Add the types**

Append to `src/types/db.ts`, and add `pledge_id: string | null` to the existing `Donation` interface:

```ts
export interface Pledge {
  id: string
  donor_name: string
  phone: string | null
  address: string | null
  amount: number
  note: string | null
  assigned_to: string | null
  closed_at: string | null
  closed_note: string | null
  created_at: string
}

export interface PledgeStatus {
  pledge_id: string
  pledged: number
  received: number
  balance: number
  is_settled: boolean
}
```

- [ ] **Step 2: Create the keys module**

```ts
// src/features/pledges/keys.ts
export const pledgeKeys = {
  all: ['pledges'] as const,
  status: ['pledge_status'] as const,
}
```

Nothing else goes in this file. `useDonations.ts` imports it so a receipt can invalidate pledge state without importing the pledges hook module.

- [ ] **Step 3: Create the hooks**

```ts
// src/features/pledges/usePledges.ts
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { donationKeys } from '../donations/useDonations'
import { pledgeKeys } from './keys'
import type { Pledge, PledgeStatus } from '../../types/db'

export function usePledges() {
  return useQuery({
    queryKey: pledgeKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as Pledge[]
    },
  })
}

export function usePledgeStatus() {
  return useQuery({
    queryKey: pledgeKeys.status,
    queryFn: async () => {
      const { data, error } = await supabase.from('pledge_status').select('*')
      if (error) throw new Error(error.message)
      return data as PledgeStatus[]
    },
  })
}

/** A pledge change moves the expected figure and, on delete, the donations that
 *  pointed at it, so every dependent key is invalidated together. */
export function invalidatePledges(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: pledgeKeys.all })
  queryClient.invalidateQueries({ queryKey: pledgeKeys.status })
  queryClient.invalidateQueries({ queryKey: donationKeys.all })
}

export interface CreatePledgeInput {
  donor_name: string
  phone: string | null
  address: string | null
  amount: number
  note: string | null
  assigned_to: string | null
}

export function useCreatePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePledgeInput) => {
      const { data, error } = await supabase.from('pledges').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data as Pledge
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export type UpdatePledgeInput = Partial<CreatePledgeInput> & { id: string }

export function useUpdatePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePledgeInput) => {
      const { data, error } = await supabase
        .from('pledges')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Pledge
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export function useClosePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, closed_note }: { id: string; closed_note: string | null }) => {
      const { error } = await supabase
        .from('pledges')
        .update({ closed_at: new Date().toISOString(), closed_note })
        .eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export function useReopenPledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pledges')
        .update({ closed_at: null, closed_note: null })
        .eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}

export function useDeletePledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pledges').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidatePledges(queryClient),
  })
}
```

- [ ] **Step 4: Verify green**

Run: `npm run typecheck && npm run build`
Expected: both pass. Nothing consumes these yet.

- [ ] **Step 5: Commit**

```bash
git add src/types/db.ts src/features/pledges/
git commit -m "feat(pledges): types and query hooks"
```

---

### Task 3: Donations can carry a pledge

**Files:**
- Modify: `src/features/donations/useDonations.ts`

**Interfaces:**
- Consumes: `pledgeKeys` from `src/features/pledges/keys.ts` (Task 2).
- Produces: `CreateDonationInput` gains `pledge_id?: string | null`; donation mutations invalidate pledge state.

Recording a receipt against a pledge is an ordinary donation insert. The only new behaviour is carrying the link and refreshing the pledge figures afterwards.

- [ ] **Step 1: Accept and write the link**

Add `pledge_id?: string | null` to `CreateDonationInput`. The existing insert already spreads the whole input, so no change is needed to the insert statement itself — verify that by reading it rather than assuming.

- [ ] **Step 2: Invalidate pledge state on every donation mutation**

Import `pledgeKeys` from `../pledges/keys` — NOT from `../pledges/usePledges`, which would create an import cycle. In the `onSuccess` of the create, update and delete donation mutations, add:

```ts
queryClient.invalidateQueries({ queryKey: pledgeKeys.all })
queryClient.invalidateQueries({ queryKey: pledgeKeys.status })
```

All three matter: creating a receipt reduces a pledge's balance, editing a donation's amount changes it, and deleting a donation returns that money to the expected figure.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/features/donations/useDonations.ts
git commit -m "feat(donations): carry an optional pledge link"
```

---

### Task 4: The expected-collections calculation

**Files:**
- Create: `src/domain/pledges.ts`

**Interfaces:**
- Consumes: `Pledge`, `PledgeStatus` (Task 2).
- Produces: `PledgeRow`, `PledgeSummary`, `buildPledges(pledges, statuses): PledgeSummary`.

This is a pure function in `src/domain/`, with no React or query imports. **Do not modify `src/domain/balance.ts`** — pledged money never enters any balance figure.

- [ ] **Step 1: Write the calculation**

```ts
// src/domain/pledges.ts
import type { Pledge, PledgeStatus } from '../types/db'

export type PledgeState = 'open' | 'received' | 'closed'

export interface PledgeRow {
  pledge: Pledge
  pledged: number
  received: number
  balance: number
  state: PledgeState
}

export interface PledgeSummary {
  open: PledgeRow[] // still chasing, largest outstanding first
  done: PledgeRow[] // received or closed, newest first
  expectedOutstanding: number
}

/**
 * State precedence is received -> closed -> open: what actually happened matters
 * more than an administrative flag, and both non-open states are excluded from
 * the expected figure anyway.
 *
 * expectedOutstanding floors EACH pledge at zero before summing. Flooring the
 * total instead would let one donor's over-payment silently cancel another
 * donor's outstanding promise.
 */
export function buildPledges(pledges: Pledge[], statuses: PledgeStatus[]): PledgeSummary {
  const statusById = new Map(statuses.map((s) => [s.pledge_id, s]))

  const rows: PledgeRow[] = pledges.map((pledge) => {
    const status = statusById.get(pledge.id)
    const pledged = status?.pledged ?? pledge.amount
    const received = status?.received ?? 0
    const balance = Math.max(0, pledged - received)

    const state: PledgeState =
      received >= pledged ? 'received' : pledge.closed_at ? 'closed' : 'open'

    return { pledge, pledged, received, balance, state }
  })

  const open = rows
    .filter((r) => r.state === 'open')
    .sort((a, b) => b.balance - a.balance)

  const done = rows
    .filter((r) => r.state !== 'open')
    .sort((a, b) => b.pledge.created_at.localeCompare(a.pledge.created_at))

  return {
    open,
    done,
    expectedOutstanding: open.reduce((total, r) => total + r.balance, 0),
  }
}
```

- [ ] **Step 2: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/domain/pledges.ts
git commit -m "feat(domain): expected collections from pledges"
```

---

### Task 5: Pledge form

**Files:**
- Create: `src/features/pledges/pledgeSchema.ts`
- Create: `src/features/pledges/PledgeForm.tsx`

**Interfaces:**
- Consumes: `useCreatePledge()`, `useUpdatePledge()`, `CreatePledgeInput` (Task 2).
- Produces: `pledgeSchema`, `PledgeInput`; `<PledgeForm pledge?={Pledge} onSaved={() => void} />`.

- [ ] **Step 1: Write the schema**

```ts
// src/features/pledges/pledgeSchema.ts
import { z } from 'zod'

export const pledgeSchema = z.object({
  donor_name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  amount: z.number().int().positive('Enter an amount'),
  assigned_to: z.string().optional(),
  note: z.string().optional(),
})

export type PledgeInput = z.infer<typeof pledgeSchema>
```

- [ ] **Step 2: Build the form**

Model it directly on `src/features/donations/DonationForm.tsx` — same `useForm` + `zodResolver` shape, same `blankToNull` helper for optional text, same card markup (`bg-surface border border-line rounded-2xl p-4 shadow-sm`), same `AmountInput` via `Controller` for the amount.

Fields: donor name, phone (`type="tel"`), amount, **assigned to** (a `<select>` of committee members, optional, labelled "Who's chasing"), and note. Address is in the schema and the table for parity with donations but is NOT rendered — a pledge is chased by phone, and the address is captured on the donation when money actually arrives.

Editing a pledge uses the same form with the `pledge` prop supplied, exactly as `DonationForm` does. Reducing the amount below what has already been received is allowed and needs no guard: `buildPledges` floors the balance at zero and the row becomes `received`.

Render mutation errors inline in `text-neg`.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/features/pledges/pledgeSchema.ts src/features/pledges/PledgeForm.tsx
git commit -m "feat(pledges): create and edit form"
```

---

### Task 6: The Expected tab

**Files:**
- Create: `src/features/pledges/PledgeList.tsx`
- Modify: `src/features/donations/DonationsListPage.tsx`

**Interfaces:**
- Consumes: `usePledges()`, `usePledgeStatus()`, `useClosePledge()`, `useReopenPledge()`, `useDeletePledge()` (Task 2), `buildPledges` (Task 4), `<PledgeForm>` (Task 5).
- Produces: `<PledgeList onRecordReceipt={(row: PledgeRow) => void} />`.

- [ ] **Step 1: Add tabs to the collections page**

In `DonationsListPage.tsx`, add `const [tab, setTab] = useState<'received' | 'expected'>('received')` and a two-button switcher below the page heading, styled like the existing pill buttons: the active tab uses `bg-gradient-to-b from-primary to-primary-deep text-white`, the inactive uses `bg-surface text-ink-soft border border-line`.

The entire existing donations UI — the New Donation button, the form, the search box and the list — renders only when `tab === 'received'`, unchanged. `<PledgeList>` renders when `tab === 'expected'`.

Label the expected tab with its figure: `Expected (₹75,000)` using `formatINR`, so the number is visible without switching tabs. When `expectedOutstanding` is zero, label it just `Expected`.

- [ ] **Step 2: Build the list**

`PledgeList.tsx` renders, from `buildPledges(pledges ?? [], statuses ?? [])`:

- A **New Pledge** button toggling `<PledgeForm>`, matching how the donations tab toggles `<DonationForm>`.
- The **open** group, largest outstanding first. Each row: donor name, `{formatINR(received)} of {formatINR(pledged)}` (or just the pledged amount when nothing is received), who is chasing, and a prominent **Record receipt** button calling `onRecordReceipt(row)`.
- Each open row also offers **Close**. Use `confirm` to decide whether to close and `prompt` only for the note, because `prompt` returns `null` both when the user cancels and when they submit an empty note — it cannot tell you which happened, so it must not be the thing that decides:

```tsx
const onClose = (row: PledgeRow) => {
  if (!window.confirm(`Stop expecting ${formatINR(row.balance)} from ${row.pledge.donor_name}?`)) return
  const reason = window.prompt('Reason? (optional)')
  closePledge.mutate({ id: row.pledge.id, closed_note: reason?.trim() || null })
}
```
- The **done** group below, visually quieter (`text-ink-soft`), showing received pledges as `✓ {formatINR(received)}` and closed ones as `{formatINR(received)} of {formatINR(pledged)} · closed` plus the `closed_note` when present. Closed rows offer **Reopen**:

```tsx
{row.state === 'closed' && (
  <>
    <p className="text-xs text-ink-soft">
      {formatINR(row.received)} of {formatINR(row.pledged)} · closed
      {row.pledge.closed_note ? ` — ${row.pledge.closed_note}` : ''}
    </p>
    <button
      type="button"
      onClick={() => reopenPledge.mutate(row.pledge.id)}
      className="text-sm text-ink-soft border border-line rounded-xl px-3 py-2"
    >
      Reopen
    </button>
  </>
)}
```
- **Delete** is admin-gated (`useAuth().isAdmin`) and behind a confirm naming the donor, matching the pattern in `ExpenseEditPage.tsx`. The wording must reassure that money already received is kept, because the FK is `on delete set null` and deleting a pledge genuinely cannot destroy a receipt:

```tsx
const onDelete = (row: PledgeRow) => {
  const kept = row.received > 0 ? ` Receipts already recorded (${formatINR(row.received)}) will be kept.` : ''
  if (!window.confirm(`Delete ${row.pledge.donor_name}'s pledge?${kept}`)) return
  deletePledge.mutate(row.pledge.id)
}
```
- Empty state: "No pledges yet. Add what people have promised so you can see how much more to expect."

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Manual check**

Run `npm run dev`, open `/collect`, switch to Expected, add a ₹5,000 pledge, confirm it appears in the open group and the tab label reads `Expected (₹5,000)`.

- [ ] **Step 5: Commit**

```bash
git add src/features/pledges/PledgeList.tsx src/features/donations/DonationsListPage.tsx
git commit -m "feat(pledges): expected tab on the collections page"
```

---

### Task 7: Recording a receipt against a pledge

**Files:**
- Modify: `src/features/donations/DonationForm.tsx`
- Modify: `src/features/donations/DonationsListPage.tsx`

**Interfaces:**
- Consumes: `PledgeRow` (Task 4), `CreateDonationInput.pledge_id` (Task 3).
- Produces: `<DonationForm>` accepts an optional `prefill` prop.

This is the moment a promise becomes money. It must go through the ordinary donation insert so the receipt number is generated by the existing trigger.

- [ ] **Step 1: Let the donation form be prefilled**

Add an optional prop:

```ts
prefill?: {
  pledge_id: string
  donor_name: string
  phone: string | null
  amount: number
}
```

When `prefill` is supplied and `donation` is not, seed `defaultValues` from it (`donor_name`, `phone`, `amount` = the pledge's outstanding balance) and include `pledge_id` in the `CreateDonationInput` the form submits. The amount stays fully editable — someone paying less than promised is the normal case, not an exception.

When `prefill` is absent, behaviour is exactly as today.

- [ ] **Step 2: Wire the button**

In `DonationsListPage.tsx`, hold `const [receiptFor, setReceiptFor] = useState<PledgeRow | null>(null)`. `<PledgeList onRecordReceipt={setReceiptFor} />` sets it; when it is non-null, render `<DonationForm prefill={...} onSaved={...} />` above the pledge list with a heading naming the donor, e.g. `Receipt for Ramesh Kumar`. Clear it on save.

Keep the existing `onSaved` behaviour: if the action is `share`, navigate to the receipt page.

- [ ] **Step 3: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Manual check**

Against the ₹5,000 pledge, tap Record receipt, save ₹3,000, and confirm: a donation of ₹3,000 exists with a receipt number, Collected rose by ₹3,000, and the pledge now reads `₹3,000 of ₹5,000` with ₹2,000 still expected.

- [ ] **Step 5: Commit**

```bash
git add src/features/donations/
git commit -m "feat(pledges): record a receipt against a pledge"
```

---

### Task 8: Yet to receive on Home

**Files:**
- Modify: `src/features/home/HomePage.tsx`

**Interfaces:**
- Consumes: `usePledges()`, `usePledgeStatus()` (Task 2), `buildPledges` (Task 4).
- Produces: no new exports.

- [ ] **Step 1: Add the tile**

Call `usePledges()` and `usePledgeStatus()`, compute `buildPledges(...)` in a `useMemo`, and add a `StatCard` for `expectedOutstanding` labelled **Yet to receive**, placed beside Collected — so the two dues face each other: money owed to the mandal, and money it owes.

Render the tile only when `expectedOutstanding > 0`, so a mandal not using pledges sees no empty tile.

Add both queries to the page's existing loading and error guards, following exactly how `useExpensePayments()` was added there.

- [ ] **Step 2: Verify green**

Run: `npm run typecheck && npm run build`

- [ ] **Step 3: Manual check**

With the ₹5,000 pledge part-received at ₹3,000, Home shows **Yet to receive ₹2,000**, and Available is unchanged by the pledge itself — only the ₹3,000 donation moved it.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/HomePage.tsx
git commit -m "feat(home): yet-to-receive tile"
```

---

## Rollout order

1. Task 1's migration `0013` is run **before** any of this deploys.
2. Tasks 2–8 merge together; there is no intermediate state that needs its own deploy.
3. Nothing in this plan touches the public statement, the balance maths, or any existing money figure — a rollback is `git revert` plus a redeploy, with the pledges table left harmlessly in place.
