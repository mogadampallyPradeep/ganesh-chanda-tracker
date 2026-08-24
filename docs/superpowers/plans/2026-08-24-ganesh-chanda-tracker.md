# Ganesh Chanda Tracker Implementation Plan

> **For agentic workers:** the **spec is the authoritative source of truth** — read it first
> (`docs/superpowers/specs/2026-08-24-ganesh-chanda-tracker-design.md`). The task breakdown below
> is a build guide; where its details conflict with the spec, **the spec wins**. See
> "Design updates (supersede earlier task text)" immediately below the constraints.

**Goal:** Build an installable PWA for a Ganesh Chaturthi mandal to collect donations (with WhatsApp receipts), track spends against a live balance with per-member custody, and plan the budget — with a public shareable statement.

**Architecture:** React + TypeScript SPA (Vite) styled with Tailwind + shadcn/ui, talking directly to Supabase (Postgres). Money totals and per-member holdings are always computed from rows, never stored. Login is mobile + static password verified by a Postgres RPC; the public reads a restricted statement through Postgres views that expose only safe columns.

**Tech Stack:** Vite, React 18, TypeScript (strict), Tailwind CSS, shadcn/ui, React Router, TanStack Query, @supabase/supabase-js, react-hook-form + zod, SheetJS (`xlsx`), vite-plugin-pwa. **No test framework — build directly, verify with `tsc --noEmit` + `npm run build` + manual click-through.**

**Spec:** `docs/superpowers/specs/2026-08-24-ganesh-chanda-tracker-design.md`

## Global Constraints

- **One fund, one festival (Ganesh 2026).** No multi-year/multi-fund tables or switching.
- **Manual entry only.** No payment/bank/WhatsApp API integration.
- **Amounts are integer rupees** (Postgres `integer`, TS `number`). No paise. Currency display via `formatINR` (Indian grouping, `₹` prefix). **All calculations automatic, live, and exact.**
- **Phone number is the primary identity.** `committee_members.mobile` is the PK; `collected_by`, `paid_by`, and reimbursement member refs are all `text` mobiles.
- **Auth:** mobile + static password, verified by a `SECURITY DEFINER` RPC `member_login` (never expose `password_hash`). Session in localStorage. **Admins** = `is_admin` members; they delete entries and manage committee/settings and can add members/admins. All members can add + **edit any spend/donation at any time**; delete is admin-only.
- **Privacy:** donor `phone`/`address` and `password_hash` NEVER reach anon/public. Public sees donor name + amount only, via views.
- **Spend source:** `cash` / `bank` / `personal` — UI presents "Committee fund → Cash/Bank" vs "Self". `cash`/`bank` draw down the fund quota; `personal` creates a reimbursement owed to `paid_by`.
- **Receipt numbers** server-generated, sequential, `<prefix><year>-<0000>` (default `GNP`, e.g. `GNP2026-0042`).
- **Theme:** festival design tokens (marigold/temple-red/gold on warm cream) as CSS variables; light + dark.
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never commit real values; `.env` gitignored; provide `.env.example`.
- **Supabase project ref:** `kzlsuosriuahkqrmiiac`. **GitHub:** `mogadampallyPradeep/ganesh-chanda-tracker`.

## Design updates (supersede earlier task text)

These decisions were made after the task list below was first drafted. **They override any
conflicting task detail; follow the spec.**

1. **No automated tests.** Ignore every "Write the failing test / Run to verify fail" step and all
   Vitest/RTL setup. Each task = implement per spec → `tsc --noEmit` + `npm run build` clean → commit.
   Keep logic in pure `src/domain/*` functions for reliability.
2. **Auth is config-based, not Supabase Auth.** Replace Task 13 entirely: no email/password signup, no
   `supabase.auth`. Instead — `member_login(mobile, password)` Postgres RPC returns safe member fields or
   null; `AuthProvider` stores the member in localStorage; `useAuth()` exposes `{ member, isAdmin, signIn, signOut }`; `RequireAuth` redirects to `/login`.
3. **Custody & reimbursements** (new — see spec): `expenses` has `paid_by` (mobile) + `source` (cash/bank/personal); add a `reimbursements` table. New domain fn `computeHoldings(members, donations, expenses, reimbursements)` → per-member `{ collected, holdingCash, holdingBank, owedBack, over }`. Committee screen shows these + a Reimburse action.
4. **Spend form** uses "Paid from: Committee fund (Cash/Bank) / Self" + "Paid by" member; **calculator** built into every amount field.
5. **Budget** screen adds a slider (actual vs estimated, red when over) and an overall **shortfall** (`estimated − collected` and `estimated − spent`).
6. **Committee = configured members** (no auto-provision on login). Seed the initial admin numbers.

---

## File Structure

```
supabase/migrations/
  0001_schema.sql          # tables: fund_settings, categories, estimates, donations, expenses
  0002_receipt_number.sql  # sequence + trigger for donation receipt_no
  0003_rls.sql             # enable RLS; authenticated full access
  0004_public_views.sql    # public_donations / public_expenses / public_summary views + anon grants
  0005_seed.sql            # seed fund_settings + preset categories
  0006_public_token.sql    # opaque share token on fund_settings (Task 25)
  0007_committee.sql       # committee_members table + RLS (Task 28)
src/
  main.tsx, App.tsx, routes.tsx
  index.css                # tailwind entry + design tokens
  lib/
    supabase.ts            # supabase client
    format.ts              # formatINR, formatDate
    queryClient.ts         # TanStack Query client
  types/db.ts              # Method + row types
  domain/
    balance.ts             # computeBalance (pure)
    budget.ts              # computeBudgetRows (pure)
    receipt.ts             # buildReceiptText, buildWhatsAppLink (pure)
    statement.ts           # buildStatementSheets (pure, for export)
  components/
    ui/                    # shadcn primitives (button, input, select, dialog, ...)
    layout/AppShell.tsx, TopBar.tsx, BottomNav.tsx
    common/AmountInput.tsx, MethodToggle.tsx, CategorySelect.tsx, DataTable.tsx, StatCard.tsx, EmptyState.tsx
  features/
    auth/{AuthProvider.tsx, useAuth.ts, LoginPage.tsx, RequireAuth.tsx}
    donations/{DonationsListPage.tsx, DonationForm.tsx, DonationEditPage.tsx, ReceiptPage.tsx, donationSchema.ts, useDonations.ts}
    expenses/{ExpensesListPage.tsx, ExpenseForm.tsx, ExpenseEditPage.tsx, expenseSchema.ts, useExpenses.ts}
    budget/{BudgetPage.tsx, EstimatesEditor.tsx, useEstimates.ts}
    dashboard/{HomePage.tsx, BalanceHero.tsx, SplitCard.tsx, BudgetProgress.tsx, RecentActivity.tsx}
    categories/{CategoriesPage.tsx, useCategories.ts}
    committee/{CommitteePage.tsx, useCommittee.ts}
    settings/{FundSettingsPage.tsx}
    export/exportExcel.ts  # thin wrapper over statement.ts + xlsx
    public/PublicStatementPage.tsx
```

Pure logic lives in `src/domain/*` and is unit-tested exhaustively. React pieces get focused component/smoke tests. Tests are colocated as `*.test.ts(x)` next to the file under test.

---

## Phase 0 — Scaffolding

### Task 1: Project scaffold, Tailwind, tokens, test harness

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.env.example`, `vitest.setup.ts`
- Test: `src/domain/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Vite dev server, `npm test` (Vitest) and `npm run build` scripts, Tailwind wired with festival tokens in `src/index.css`.

- [ ] **Step 1: Scaffold Vite React-TS app**

Run:
```bash
cd d:/Repos/ganesh-chanda-tracker
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install react-router-dom @tanstack/react-query @supabase/supabase-js react-hook-form zod @hookform/resolvers xlsx
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Vitest**

Add to `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] },
})
```
`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```
Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Configure Tailwind + festival tokens**

`tailwind.config.ts` `content`: `["./index.html", "./src/**/*.{ts,tsx}"]`. Replace `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg:#FBF4E6; --surface:#FFFDF7; --surface-2:#F6EAD2; --ink:#3A2A18; --ink-soft:#836A4A;
  --line:#E7D7B8; --primary:#E5860A; --primary-deep:#B96500; --red:#A81E24; --gold:#B98C1E;
  --pos:#2E7D4F; --neg:#A81E24; --wa:#128C4B;
}
:root[data-theme="dark"]{
  --bg:#211710; --surface:#2C2014; --surface-2:#3A2B1A; --ink:#F5E9D2; --ink-soft:#C2AB84;
  --line:#4A3924; --primary:#F2A62E; --primary-deep:#E5860A; --red:#E5726F; --gold:#DDB856;
  --pos:#56C088; --neg:#E5726F; --wa:#25B265;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ /* mirror dark tokens */ } }
body{ background:var(--bg); color:var(--ink); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
```
(Copy the dark token block verbatim into the media query to honor OS preference.)

- [ ] **Step 4: Write a smoke test**

`src/domain/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('harness', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```

- [ ] **Step 5: Run test + build to verify**

Run: `npm test` → Expected: PASS. Run: `npm run build` → Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold vite+react+ts, tailwind tokens, vitest harness"
```

---

## Phase 1 — Database (Supabase SQL migrations)

> Migrations are applied via the Supabase SQL editor or CLI against project `kzlsuosriuahkqrmiiac`. Each task writes SQL and verifies by running it and querying.

### Task 2: Core schema

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces tables: `fund_settings(id, mandal_name, festival_year, receipt_prefix, currency)`, `categories(id, name, display_order, is_locked)`, `estimates(id, category_id, estimated_amount)`, `donations(id, receipt_no, donor_name, address, phone, amount, method, note, collected_by, created_at)`, `expenses(id, category_id, description, payee, amount, method, note, spent_by, created_at)`.

- [ ] **Step 1: Write schema SQL**

`supabase/migrations/0001_schema.sql`:
```sql
create type payment_method as enum ('online','offline');

create table fund_settings (
  id uuid primary key default gen_random_uuid(),
  mandal_name text not null,
  festival_year int not null,
  receipt_prefix text not null default 'GNP',
  currency text not null default 'INR'
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0,
  is_locked boolean not null default false
);

create table estimates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  estimated_amount int not null default 0 check (estimated_amount >= 0),
  unique (category_id)
);

create table donations (
  id uuid primary key default gen_random_uuid(),
  receipt_no text unique,
  donor_name text not null,
  address text,
  phone text,
  amount int not null check (amount > 0),
  method payment_method not null,
  note text,
  collected_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  description text not null,
  payee text,
  amount int not null check (amount > 0),
  method payment_method not null,
  note text,
  spent_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Apply + verify**

Run the SQL in the Supabase SQL editor. Verify: `select * from categories;` returns 0 rows without error, and `\d donations` shows the `receipt_no` unique column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_schema.sql && git commit -m "feat(db): core schema for fund, categories, estimates, donations, expenses"
```

### Task 3: Receipt-number generation

**Files:**
- Create: `supabase/migrations/0002_receipt_number.sql`

**Interfaces:**
- Produces: a `before insert` trigger on `donations` that sets `receipt_no = <prefix><year>-<zero-padded sequence>` when null.

- [ ] **Step 1: Write sequence + trigger SQL**

`supabase/migrations/0002_receipt_number.sql`:
```sql
create sequence if not exists donation_receipt_seq;

create or replace function set_receipt_no() returns trigger as $$
declare
  s fund_settings%rowtype;
  n bigint;
begin
  if new.receipt_no is null then
    select * into s from fund_settings limit 1;
    n := nextval('donation_receipt_seq');
    new.receipt_no := coalesce(s.receipt_prefix,'GNP') || coalesce(s.festival_year, extract(year from now())::int)
                      || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_receipt_no before insert on donations
for each row execute function set_receipt_no();
```

- [ ] **Step 2: Verify**

After Task 12 seeds `fund_settings`, insert a test donation and confirm `receipt_no` looks like `GNP2026-0001`. For now, apply the SQL and confirm no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_receipt_number.sql && git commit -m "feat(db): sequential receipt number trigger"
```

### Task 4: RLS policies

**Files:**
- Create: `supabase/migrations/0003_rls.sql`

**Interfaces:**
- Produces: RLS enabled on all five tables; authenticated users get full CRUD; anon gets nothing directly (public access is via views in Task 5).

- [ ] **Step 1: Write RLS SQL**

`supabase/migrations/0003_rls.sql`:
```sql
alter table fund_settings enable row level security;
alter table categories   enable row level security;
alter table estimates    enable row level security;
alter table donations    enable row level security;
alter table expenses     enable row level security;

-- authenticated volunteers: full access
create policy auth_all on fund_settings for all to authenticated using (true) with check (true);
create policy auth_all on categories   for all to authenticated using (true) with check (true);
create policy auth_all on estimates    for all to authenticated using (true) with check (true);
create policy auth_all on donations    for all to authenticated using (true) with check (true);
create policy auth_all on expenses     for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Verify**

In SQL editor confirm `select relrowsecurity from pg_class where relname='donations';` returns `t`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_rls.sql && git commit -m "feat(db): enable RLS with authenticated full-access policies"
```

### Task 5: Public views (privacy boundary)

**Files:**
- Create: `supabase/migrations/0004_public_views.sql`

**Interfaces:**
- Produces: `public_donations(receipt_no, donor_name, amount, method, created_at)`, `public_expenses(category_name, description, amount, method, created_at)`, `public_summary(collected, spent, available, cash_in_hand, in_bank)` — all selectable by `anon`. No phone/address exposed.

- [ ] **Step 1: Write views SQL**

`supabase/migrations/0004_public_views.sql`:
```sql
create view public_donations as
  select receipt_no, donor_name, amount, method, created_at from donations;

create view public_expenses as
  select c.name as category_name, e.description, e.amount, e.method, e.created_at
  from expenses e join categories c on c.id = e.category_id;

create view public_summary as
  select
    coalesce((select sum(amount) from donations),0) as collected,
    coalesce((select sum(amount) from expenses),0)  as spent,
    coalesce((select sum(amount) from donations),0) - coalesce((select sum(amount) from expenses),0) as available,
    coalesce((select sum(amount) from donations where method='offline'),0)
      - coalesce((select sum(amount) from expenses where method='offline'),0) as cash_in_hand,
    coalesce((select sum(amount) from donations where method='online'),0)
      - coalesce((select sum(amount) from expenses where method='online'),0) as in_bank;

grant select on public_donations, public_expenses, public_summary to anon, authenticated;
```

- [ ] **Step 2: Verify no leakage**

Confirm `select * from public_donations limit 1;` has no `phone`/`address` columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_public_views.sql && git commit -m "feat(db): public statement views with privacy boundary"
```

### Task 6: Seed fund + categories

**Files:**
- Create: `supabase/migrations/0005_seed.sql`

**Interfaces:**
- Produces: one `fund_settings` row (`Shri Ganesh Utsav Mandal`, 2026, prefix `GNP`) and the seven preset categories with `Miscellaneous` locked, each with a matching `estimates` row at 0.

- [ ] **Step 1: Write seed SQL**

`supabase/migrations/0005_seed.sql`:
```sql
insert into fund_settings (mandal_name, festival_year, receipt_prefix)
values ('Shri Ganesh Utsav Mandal', 2026, 'GNP');

insert into categories (name, display_order, is_locked) values
  ('Ganesh Idol', 1, false),
  ('Decoration', 2, false),
  ('Lighting', 3, false),
  ('Tent House / Mandap', 4, false),
  ('Annadanam', 5, false),
  ('Pandit / Pooja cost', 6, false),
  ('Miscellaneous', 99, true);

insert into estimates (category_id, estimated_amount)
  select id, 0 from categories;
```

- [ ] **Step 2: Verify seed + receipt trigger end-to-end**

Run: `insert into donations (donor_name, amount, method) values ('Test', 100, 'offline') returning receipt_no;`
Expected: returns `GNP2026-0001`. Then `delete from donations where donor_name='Test';`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_seed.sql && git commit -m "feat(db): seed fund settings and preset categories"
```

---

## Phase 2 — Core libs & domain logic (TDD)

### Task 7: Supabase client, types, TanStack Query

**Files:**
- Create: `src/lib/supabase.ts`, `src/types/db.ts`, `src/lib/queryClient.ts`

**Interfaces:**
- Produces: `supabase` client; TS types `Method`, `Category`, `Estimate`, `Donation`, `Expense`, `FundSettings`; `queryClient`.

- [ ] **Step 1: Write client + types**

`src/types/db.ts`:
```ts
export type Method = 'online' | 'offline'
export interface FundSettings { id: string; mandal_name: string; festival_year: number; receipt_prefix: string; currency: string }
export interface Category { id: string; name: string; display_order: number; is_locked: boolean }
export interface Estimate { id: string; category_id: string; estimated_amount: number }
export interface Donation { id: string; receipt_no: string | null; donor_name: string; address: string | null; phone: string | null; amount: number; method: Method; note: string | null; collected_by: string | null; created_at: string }
export interface Expense { id: string; category_id: string; description: string; payee: string | null; amount: number; method: Method; note: string | null; spent_by: string | null; created_at: string }
```
`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```
`src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'
export const queryClient = new QueryClient()
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts src/types/db.ts src/lib/queryClient.ts && git commit -m "feat: supabase client, db types, query client"
```

### Task 8: `formatINR` + `formatDate` (TDD)

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatINR(n: number): string`, `formatDate(iso: string): string`.

- [ ] **Step 1: Write failing tests**

`src/lib/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatINR, formatDate } from './format'

describe('formatINR', () => {
  it('groups Indian-style with rupee sign', () => {
    expect(formatINR(141000)).toBe('₹1,41,000')
    expect(formatINR(5000)).toBe('₹5,000')
    expect(formatINR(0)).toBe('₹0')
  })
  it('renders negatives with sign before symbol', () => {
    expect(formatINR(-4000)).toBe('-₹4,000')
  })
})

describe('formatDate', () => {
  it('formats ISO to d MMM yyyy', () => {
    expect(formatDate('2026-08-24T10:00:00Z')).toBe('24 Aug 2026')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/format.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/format.ts`:
```ts
export function formatINR(n: number): string {
  const sign = n < 0 ? '-' : ''
  const grouped = new Intl.NumberFormat('en-IN').format(Math.abs(n))
  return `${sign}₹${grouped}`
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/,/g, '')
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/format.test.ts` → Expected: PASS. (If `formatDate` returns `24 Aug 2026` — note `en-GB` uses no comma; keep the `.replace`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts && git commit -m "feat: Indian rupee + date formatting utils"
```

### Task 9: `computeBalance` (TDD)

**Files:**
- Create: `src/domain/balance.ts`, `src/domain/balance.test.ts`

**Interfaces:**
- Produces: `computeBalance(donations: Pick<Donation,'amount'|'method'>[], expenses: Pick<Expense,'amount'|'method'>[]): { collected: number; spent: number; available: number; cashInHand: number; inBank: number }`.

- [ ] **Step 1: Write failing tests**

`src/domain/balance.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeBalance } from './balance'

const donations = [
  { amount: 58500, method: 'offline' as const },
  { amount: 38000, method: 'online' as const },
]
const expenses = [
  { amount: 32300, method: 'offline' as const },
  { amount: 30000, method: 'online' as const },
]

describe('computeBalance', () => {
  it('totals collected, spent, available', () => {
    const b = computeBalance(donations, expenses)
    expect(b.collected).toBe(96500)
    expect(b.spent).toBe(62300)
    expect(b.available).toBe(34200)
  })
  it('splits cash-in-hand (offline) and in-bank (online)', () => {
    const b = computeBalance(donations, expenses)
    expect(b.cashInHand).toBe(26200)
    expect(b.inBank).toBe(8000)
  })
  it('handles empty input', () => {
    expect(computeBalance([], [])).toEqual({ collected: 0, spent: 0, available: 0, cashInHand: 0, inBank: 0 })
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/domain/balance.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/balance.ts`:
```ts
import type { Method } from '../types/db'
type Row = { amount: number; method: Method }
export function computeBalance(donations: Row[], expenses: Row[]) {
  const sum = (rows: Row[], m?: Method) =>
    rows.filter(r => !m || r.method === m).reduce((t, r) => t + r.amount, 0)
  const collected = sum(donations)
  const spent = sum(expenses)
  return {
    collected, spent, available: collected - spent,
    cashInHand: sum(donations, 'offline') - sum(expenses, 'offline'),
    inBank: sum(donations, 'online') - sum(expenses, 'online'),
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domain/balance.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/balance.ts src/domain/balance.test.ts && git commit -m "feat: computeBalance domain logic"
```

### Task 10: `computeBudgetRows` (TDD)

**Files:**
- Create: `src/domain/budget.ts`, `src/domain/budget.test.ts`

**Interfaces:**
- Produces: `computeBudgetRows(categories: Category[], estimates: Estimate[], expenses: Pick<Expense,'category_id'|'amount'>[]): { rows: BudgetRow[]; totalEstimated: number; totalActual: number; unbudgeted: number }` where `BudgetRow = { categoryId: string; name: string; estimated: number; actual: number; remaining: number; over: boolean }`.

- [ ] **Step 1: Write failing tests**

`src/domain/budget.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeBudgetRows } from './budget'

const categories = [
  { id: 'c1', name: 'Decoration', display_order: 2, is_locked: false },
  { id: 'c2', name: 'Misc', display_order: 99, is_locked: true },
]
const estimates = [
  { id: 'e1', category_id: 'c1', estimated_amount: 40000 },
  { id: 'e2', category_id: 'c2', estimated_amount: 5000 },
]
const expenses = [
  { category_id: 'c1', amount: 22000 },
  { category_id: 'c2', amount: 6000 },
]

describe('computeBudgetRows', () => {
  it('computes estimated/actual/remaining per category', () => {
    const { rows } = computeBudgetRows(categories, estimates, expenses)
    const deco = rows.find(r => r.categoryId === 'c1')!
    expect(deco.actual).toBe(22000)
    expect(deco.remaining).toBe(18000)
    expect(deco.over).toBe(false)
  })
  it('flags over-budget categories', () => {
    const { rows } = computeBudgetRows(categories, estimates, expenses)
    const misc = rows.find(r => r.categoryId === 'c2')!
    expect(misc.over).toBe(true)
    expect(misc.remaining).toBe(-1000)
  })
  it('totals estimated and actual', () => {
    const t = computeBudgetRows(categories, estimates, expenses)
    expect(t.totalEstimated).toBe(45000)
    expect(t.totalActual).toBe(28000)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/domain/budget.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/budget.ts`:
```ts
import type { Category, Estimate } from '../types/db'
export interface BudgetRow { categoryId: string; name: string; estimated: number; actual: number; remaining: number; over: boolean }
type Exp = { category_id: string; amount: number }

export function computeBudgetRows(categories: Category[], estimates: Estimate[], expenses: Exp[]) {
  const estByCat = new Map(estimates.map(e => [e.category_id, e.estimated_amount]))
  const actualByCat = new Map<string, number>()
  for (const e of expenses) actualByCat.set(e.category_id, (actualByCat.get(e.category_id) ?? 0) + e.amount)

  const known = new Set(categories.map(c => c.id))
  const rows: BudgetRow[] = [...categories]
    .sort((a, b) => a.display_order - b.display_order)
    .map(c => {
      const estimated = estByCat.get(c.id) ?? 0
      const actual = actualByCat.get(c.id) ?? 0
      const remaining = estimated - actual
      return { categoryId: c.id, name: c.name, estimated, actual, remaining, over: actual > estimated }
    })
  const unbudgeted = expenses.filter(e => !known.has(e.category_id)).reduce((t, e) => t + e.amount, 0)
  return {
    rows,
    totalEstimated: rows.reduce((t, r) => t + r.estimated, 0),
    totalActual: rows.reduce((t, r) => t + r.actual, 0) + unbudgeted,
    unbudgeted,
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domain/budget.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/budget.ts src/domain/budget.test.ts && git commit -m "feat: computeBudgetRows domain logic"
```

### Task 11: Receipt text + WhatsApp link (TDD)

**Files:**
- Create: `src/domain/receipt.ts`, `src/domain/receipt.test.ts`

**Interfaces:**
- Produces: `buildReceiptText(o: { mandalName: string; receiptNo: string; donorName: string; amount: number; method: Method; date: string }): string` and `buildWhatsAppLink(phone: string, text: string, defaultCountry?: string): string`.

- [ ] **Step 1: Write failing tests**

`src/domain/receipt.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildReceiptText, buildWhatsAppLink } from './receipt'

describe('buildReceiptText', () => {
  it('includes mandal, receipt no, donor, amount', () => {
    const t = buildReceiptText({ mandalName: 'Shri Ganesh Utsav Mandal', receiptNo: 'GNP2026-0042', donorName: 'Ramesh Patil', amount: 5000, method: 'offline', date: '2026-08-24T00:00:00Z' })
    expect(t).toContain('Shri Ganesh Utsav Mandal')
    expect(t).toContain('GNP2026-0042')
    expect(t).toContain('Ramesh Patil')
    expect(t).toContain('₹5,000')
  })
})

describe('buildWhatsAppLink', () => {
  it('normalizes an Indian number and url-encodes the text', () => {
    const link = buildWhatsAppLink('98765 43210', 'Hi & thanks')
    expect(link).toBe('https://wa.me/919876543210?text=Hi%20%26%20thanks')
  })
  it('keeps an existing country code', () => {
    expect(buildWhatsAppLink('+91 98765 43210', 'x')).toBe('https://wa.me/919876543210?text=x')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/domain/receipt.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/receipt.ts`:
```ts
import type { Method } from '../types/db'
import { formatINR, formatDate } from '../lib/format'

export function buildReceiptText(o: { mandalName: string; receiptNo: string; donorName: string; amount: number; method: Method; date: string }): string {
  const kind = o.method === 'offline' ? 'Cash' : 'Online'
  return [
    `🙏 ${o.mandalName}`,
    `Receipt ${o.receiptNo} · ${formatDate(o.date)}`,
    `Received with thanks from ${o.donorName}`,
    `Amount: ${formatINR(o.amount)} (${kind})`,
    `Towards Ganesh Chaturthi 2026. Dhanyawad!`,
  ].join('\n')
}

export function buildWhatsAppLink(phone: string, text: string, defaultCountry = '91'): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = defaultCountry + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domain/receipt.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/receipt.ts src/domain/receipt.test.ts && git commit -m "feat: receipt text + whatsapp deep link builders"
```

### Task 12: Statement sheet builder for export (TDD)

**Files:**
- Create: `src/domain/statement.ts`, `src/domain/statement.test.ts`

**Interfaces:**
- Produces: `buildStatementSheets(input: { donations: PublicDonation[]; expenses: PublicExpense[]; summary: Summary }): { donations: (string|number)[][]; expenses: (string|number)[][]; summary: (string|number)[][] }` returning array-of-rows (header + data + total) suitable for `xlsx.utils.aoa_to_sheet`. Types `PublicDonation = { receipt_no: string; donor_name: string; amount: number; method: Method }`, `PublicExpense = { category_name: string; description: string; amount: number; method: Method }`, `Summary = { collected: number; spent: number; available: number; cashInHand: number; inBank: number }`.

- [ ] **Step 1: Write failing tests**

`src/domain/statement.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildStatementSheets } from './statement'

it('builds donations sheet with header and total row', () => {
  const out = buildStatementSheets({
    donations: [{ receipt_no: 'GNP2026-0001', donor_name: 'A', amount: 5000, method: 'offline' }],
    expenses: [{ category_name: 'Lighting', description: 'lights', amount: 2000, method: 'online' }],
    summary: { collected: 5000, spent: 2000, available: 3000, cashInHand: 5000, inBank: -2000 },
  })
  expect(out.donations[0]).toEqual(['Receipt No', 'Donor', 'Method', 'Amount'])
  expect(out.donations[1]).toEqual(['GNP2026-0001', 'A', 'offline', 5000])
  expect(out.donations[out.donations.length - 1]).toEqual(['', '', 'Total Collected', 5000])
  expect(out.expenses[1]).toEqual(['Lighting', 'lights', 'online', 2000])
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/domain/statement.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/statement.ts`:
```ts
import type { Method } from '../types/db'
export type PublicDonation = { receipt_no: string; donor_name: string; amount: number; method: Method }
export type PublicExpense = { category_name: string; description: string; amount: number; method: Method }
export type Summary = { collected: number; spent: number; available: number; cashInHand: number; inBank: number }

export function buildStatementSheets(i: { donations: PublicDonation[]; expenses: PublicExpense[]; summary: Summary }) {
  const donations: (string | number)[][] = [['Receipt No', 'Donor', 'Method', 'Amount']]
  i.donations.forEach(d => donations.push([d.receipt_no, d.donor_name, d.method, d.amount]))
  donations.push(['', '', 'Total Collected', i.summary.collected])

  const expenses: (string | number)[][] = [['Category', 'Description', 'Method', 'Amount']]
  i.expenses.forEach(e => expenses.push([e.category_name, e.description, e.method, e.amount]))
  expenses.push(['', '', 'Total Spent', i.summary.spent])

  const s = i.summary
  const summary: (string | number)[][] = [
    ['Collected', s.collected], ['Spent', s.spent], ['Available', s.available],
    ['Cash in hand', s.cashInHand], ['In bank', s.inBank],
  ]
  return { donations, expenses, summary }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domain/statement.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/statement.ts src/domain/statement.test.ts && git commit -m "feat: statement sheet builder for excel export"
```

---

## Phase 3 — Auth & shell

### Task 13: Auth provider, login, route guard

**Files:**
- Create: `src/features/auth/AuthProvider.tsx`, `src/features/auth/useAuth.ts`, `src/features/auth/LoginPage.tsx`, `src/features/auth/RequireAuth.tsx`
- Test: `src/features/auth/RequireAuth.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 7).
- Produces: `<AuthProvider>`, `useAuth(): { user, loading, signIn(email,password), signOut() }`, `<RequireAuth>` that redirects to `/login` when no user.

- [ ] **Step 1: Write failing test**

`src/features/auth/RequireAuth.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import { AuthContext } from './useAuth'

function wrap(user: unknown) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, signIn: async () => {}, signOut: async () => {} } as any}>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/home" element={<div>secret home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('redirects to login when signed out', () => { wrap(null); expect(screen.getByText('login page')).toBeInTheDocument() })
  it('renders children when signed in', () => { wrap({ id: 'u1' }); expect(screen.getByText('secret home')).toBeInTheDocument() })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/features/auth/RequireAuth.test.tsx` → Expected: FAIL.

- [ ] **Step 3: Implement auth**

`src/features/auth/useAuth.ts`:
```ts
import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
export interface AuthValue { user: User | null; loading: boolean; signIn: (e: string, p: string) => Promise<void>; signOut: () => Promise<void> }
export const AuthContext = createContext<AuthValue | null>(null)
export const useAuth = () => { const c = useContext(AuthContext); if (!c) throw new Error('useAuth outside provider'); return c }
```
`src/features/auth/AuthProvider.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])
  const signIn = async (email: string, password: string) => { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error }
  const signOut = async () => { await supabase.auth.signOut() }
  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}
```
`src/features/auth/RequireAuth.tsx`:
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'
export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
```
`src/features/auth/LoginPage.tsx`: a festival-styled form calling `signIn(email, password)` then navigating to `/`; show error text on failure.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/auth/RequireAuth.test.tsx` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth && git commit -m "feat(auth): provider, login, route guard"
```

### Task 14: App shell — top bar, bottom nav, routing

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `src/components/layout/TopBar.tsx`, `src/components/layout/BottomNav.tsx`, `src/routes.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `src/components/layout/BottomNav.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `RequireAuth`.
- Produces: `<AppShell>` wrapping `<Outlet/>` with `<TopBar/>` + `<BottomNav/>`; route tree with tabs `/` (Home), `/collect`, `/spend`, `/budget`, plus `/login` and `/s/:token` (public, outside shell). BottomNav has 4 links; active tab highlighted.

- [ ] **Step 1: Write failing test**

`src/components/layout/BottomNav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

it('renders the four tabs', () => {
  render(<MemoryRouter><BottomNav /></MemoryRouter>)
  ;['Home', 'Collect', 'Spend', 'Budget'].forEach(t => expect(screen.getByText(t)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/components/layout/BottomNav.test.tsx` → Expected: FAIL.

- [ ] **Step 3: Implement shell + routes**

`BottomNav.tsx`: four `<NavLink>`s (`/`, `/collect`, `/spend`, `/budget`) with labels Home/Collect/Spend/Budget and inline SVG icons; active class uses `--primary-deep`. `TopBar.tsx`: mandal name + overflow menu (Share link, Export, Categories, Committee, Fund settings, Sign out via `useAuth().signOut`). `AppShell.tsx`: `<div><TopBar/><main><Outlet/></main><BottomNav/></div>`. `routes.tsx`: assemble with `RequireAuth` guarding the shell; `/login` and `/s/:token` public. Update `App.tsx` to render `<RouterProvider>`; `main.tsx` wraps with `AuthProvider` + `QueryClientProvider`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/layout/BottomNav.test.tsx` → Expected: PASS. Then `npm run build` → Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout src/routes.tsx src/App.tsx src/main.tsx && git commit -m "feat: app shell with bottom-tab navigation and routing"
```

---

## Phase 4 — Shared UI components

### Task 15: MethodToggle, AmountInput, CategorySelect, StatCard, DataTable

**Files:**
- Create: `src/components/common/MethodToggle.tsx`, `AmountInput.tsx`, `CategorySelect.tsx`, `StatCard.tsx`, `DataTable.tsx`
- Test: `src/components/common/MethodToggle.test.tsx`, `src/components/common/AmountInput.test.tsx`

**Interfaces:**
- Produces:
  - `MethodToggle({ value: Method; onChange: (m: Method) => void })` — two-segment control.
  - `AmountInput({ value: number; onChange: (n: number) => void })` — displays `formatINR`, edits integer rupees.
  - `CategorySelect({ categories: Category[]; value: string; onChange: (id: string) => void })`.
  - `StatCard({ label: string; value: string; tone?: 'pos'|'neg'|'default' })`.
  - `DataTable({ columns: {key:string;label:string;align?:'right'}[]; rows: Record<string,React.ReactNode>[]; totalRow?: React.ReactNode[] })` — Excel-style.

- [ ] **Step 1: Write failing tests**

`MethodToggle.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MethodToggle } from './MethodToggle'

it('calls onChange with the picked method', async () => {
  const onChange = vi.fn()
  render(<MethodToggle value="offline" onChange={onChange} />)
  await userEvent.click(screen.getByText('Online'))
  expect(onChange).toHaveBeenCalledWith('online')
})
```
`AmountInput.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountInput } from './AmountInput'

it('emits integer rupees as the user types digits', async () => {
  const onChange = vi.fn()
  render(<AmountInput value={0} onChange={onChange} />)
  await userEvent.type(screen.getByRole('textbox'), '5000')
  expect(onChange).toHaveBeenLastCalledWith(5000)
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/components/common` → Expected: FAIL.

- [ ] **Step 3: Implement components**

Build each per its interface. `MethodToggle`: two buttons, active styled with `--primary`. `AmountInput`: a text input; on change strip non-digits, `onChange(Number(digits || 0))`, show `formatINR(value)` as the display; `role="textbox"`. `CategorySelect`: native `<select>` ordered by `display_order`. `StatCard`: label + value, tone maps to `--pos`/`--neg`. `DataTable`: semantic `<table>` with header, zebra rows, right-aligned numeric columns, bold total row, wrapped in `overflow-x:auto`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/common` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common && git commit -m "feat: shared UI — method toggle, amount input, category select, stat card, data table"
```

---

## Phase 5 — Donations

### Task 16: Donations data hooks

**Files:**
- Create: `src/features/donations/useDonations.ts`
- Test: `src/features/donations/useDonations.test.ts` (unit-test the query/mutation key + mapping helpers; mock `supabase`)

**Interfaces:**
- Consumes: `supabase`, `Donation`.
- Produces: `useDonations()` (list, ordered `created_at desc`), `useDonation(id)`, `useCreateDonation()`, `useUpdateDonation()`, `useDeleteDonation()` — TanStack Query hooks. Create returns the inserted row including `receipt_no`.

- [ ] **Step 1: Write failing test**

Test the pure query-key helpers exported alongside hooks:
```ts
import { describe, it, expect } from 'vitest'
import { donationKeys } from './useDonations'
it('has stable query keys', () => {
  expect(donationKeys.all).toEqual(['donations'])
  expect(donationKeys.detail('x')).toEqual(['donations', 'x'])
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/features/donations/useDonations.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement hooks**

Export `donationKeys = { all: ['donations'], detail: (id:string) => ['donations', id] }`. Implement hooks with `useQuery`/`useMutation` calling `supabase.from('donations')`. `useCreateDonation` inserts `{ donor_name, address, phone, amount, method, note }` and `.select().single()` to get `receipt_no`; invalidate `donationKeys.all` on success.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/donations/useDonations.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/donations/useDonations.ts src/features/donations/useDonations.test.ts && git commit -m "feat(donations): data hooks"
```

### Task 17: Donation form + validation

**Files:**
- Create: `src/features/donations/donationSchema.ts`, `src/features/donations/DonationForm.tsx`
- Test: `src/features/donations/donationSchema.test.ts`

**Interfaces:**
- Consumes: `MethodToggle`, `AmountInput`, `useCreateDonation`.
- Produces: `donationSchema` (zod) requiring `donor_name` non-empty and `amount > 0`, phone optional; `<DonationForm onSaved={(d: Donation) => void}>`.

- [ ] **Step 1: Write failing test**

`donationSchema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { donationSchema } from './donationSchema'
it('rejects empty name and non-positive amount', () => {
  expect(donationSchema.safeParse({ donor_name: '', amount: 0, method: 'offline' }).success).toBe(false)
})
it('accepts a valid donation', () => {
  expect(donationSchema.safeParse({ donor_name: 'A', amount: 100, method: 'offline' }).success).toBe(true)
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/features/donations/donationSchema.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement schema + form**

`donationSchema.ts`:
```ts
import { z } from 'zod'
export const donationSchema = z.object({
  donor_name: z.string().min(1, 'Donor name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  amount: z.number().int().positive('Enter an amount'),
  method: z.enum(['online', 'offline']),
  note: z.string().optional(),
})
export type DonationInput = z.infer<typeof donationSchema>
```
`DonationForm.tsx`: react-hook-form with `zodResolver`, fields per the UX (name, address, phone, AmountInput, MethodToggle, note), `Save & Share Receipt` + `Save only` buttons; on submit call `useCreateDonation` then `onSaved(row)`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/donations/donationSchema.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/donations/donationSchema.ts src/features/donations/donationSchema.test.ts src/features/donations/DonationForm.tsx && git commit -m "feat(donations): form + zod validation"
```

### Task 18: Receipt page (WhatsApp share)

**Files:**
- Create: `src/features/donations/ReceiptPage.tsx`
- Test: `src/features/donations/ReceiptPage.test.tsx`

**Interfaces:**
- Consumes: `buildReceiptText`, `buildWhatsAppLink`, `useDonation`, `useFundSettings` (from Task 23; until then read mandal name from a passed prop/loader).
- Produces: `<ReceiptPage>` showing the receipt card + a WhatsApp button whose `href` is the deep link, plus Download/Print.

- [ ] **Step 1: Write failing test**

`ReceiptPage.test.tsx` renders with a fixed donation + mandal name and asserts the WhatsApp link:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReceiptView } from './ReceiptPage'

it('builds a wa.me link to the donor number with the receipt text', () => {
  render(<ReceiptView mandalName="Shri Ganesh Utsav Mandal" donation={{ receipt_no:'GNP2026-0042', donor_name:'Ramesh Patil', phone:'9876543210', amount:5000, method:'offline', created_at:'2026-08-24T00:00:00Z' } as any} />)
  const link = screen.getByRole('link', { name: /whatsapp/i }) as HTMLAnchorElement
  expect(link.href).toContain('https://wa.me/919876543210')
  expect(decodeURIComponent(link.href)).toContain('GNP2026-0042')
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/features/donations/ReceiptPage.test.tsx` → Expected: FAIL.

- [ ] **Step 3: Implement**

Export a presentational `ReceiptView({ mandalName, donation })` that composes `buildReceiptText` + `buildWhatsAppLink(donation.phone, text)` into an `<a role="link" href=...>Send Receipt on WhatsApp</a>`, plus a print button (`window.print()`). `ReceiptPage` loads the donation by route param via `useDonation` and renders `ReceiptView`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/donations/ReceiptPage.test.tsx` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/donations/ReceiptPage.tsx src/features/donations/ReceiptPage.test.tsx && git commit -m "feat(donations): receipt page with whatsapp share"
```

### Task 19: Donations list + edit pages

**Files:**
- Create: `src/features/donations/DonationsListPage.tsx`, `src/features/donations/DonationEditPage.tsx`
- Test: `src/features/donations/DonationsListPage.test.tsx`

**Interfaces:**
- Consumes: `useDonations`, `useUpdateDonation`, `useDeleteDonation`, `DonationForm`, `formatINR`.
- Produces: list page (search + `+ New Donation` → form → on save navigate to receipt) and an edit page (prefilled form + Delete behind confirm).

- [ ] **Step 1: Write failing test**

Render `DonationsListPage` with a mocked `useDonations` returning two rows; assert both donor names and formatted amounts appear and the `+ New Donation` control exists.

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** list (map rows to tappable items showing name + amount + method pill), search filter over donor name, `+ New Donation` opens `DonationForm`. Edit page prefetches the donation, renders `DonationForm` in edit mode, Delete calls `useDeleteDonation` after a confirm dialog.

- [ ] **Step 4: Run to verify pass** — Run the test file → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/donations && git commit -m "feat(donations): list and edit pages"
```

---

## Phase 6 — Expenses

### Task 20: Expenses hooks, schema, form, list/edit

**Files:**
- Create: `src/features/expenses/useExpenses.ts`, `expenseSchema.ts`, `ExpenseForm.tsx`, `ExpensesListPage.tsx`, `ExpenseEditPage.tsx`
- Test: `src/features/expenses/expenseSchema.test.ts`, `src/features/expenses/ExpensesListPage.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `CategorySelect`, `AmountInput`, `MethodToggle`, `useCategories` (Task 22).
- Produces: `useExpenses`/`useExpense`/`useCreateExpense`/`useUpdateExpense`/`useDeleteExpense` with `expenseKeys`; `expenseSchema` requiring `category_id`, `description` (min 1), `amount > 0`; form and list/edit pages mirroring donations.

- [ ] **Step 1: Write failing tests**

`expenseSchema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { expenseSchema } from './expenseSchema'
it('requires category, description, positive amount', () => {
  expect(expenseSchema.safeParse({ category_id: '', description: '', amount: 0, method: 'online' }).success).toBe(false)
  expect(expenseSchema.safeParse({ category_id: 'c1', description: 'Lights', amount: 500, method: 'online' }).success).toBe(true)
})
```
And a list render test asserting a spend's category + description + amount show.

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** hooks (`expenseKeys = { all:['expenses'], detail:(id)=>['expenses',id] }`), `expenseSchema` (zod, per interface), `ExpenseForm` (CategorySelect + description + AmountInput + MethodToggle + payee), list page (rows show category + description + amount, `+ New Spend`), edit page with Delete behind confirm.

- [ ] **Step 4: Run to verify pass** — Run both test files → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/expenses && git commit -m "feat(expenses): hooks, schema, form, list and edit pages"
```

---

## Phase 7 — Categories, Estimates, Budget

### Task 21: Categories hooks + admin page

**Files:**
- Create: `src/features/categories/useCategories.ts`, `src/features/categories/CategoriesPage.tsx`
- Test: `src/features/categories/useCategories.test.ts`

**Interfaces:**
- Consumes: `supabase`, `Category`.
- Produces: `useCategories()` (ordered by `display_order`), `useCreateCategory`, `useRenameCategory`, `useDeleteCategory` (blocks when `is_locked`); `categoryKeys`. Admin page lists categories with add/rename/remove; the locked `Miscellaneous` row shows no delete.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { canDeleteCategory } from './useCategories'
it('prevents deleting a locked category', () => {
  expect(canDeleteCategory({ id:'c', name:'Miscellaneous', display_order:99, is_locked:true })).toBe(false)
  expect(canDeleteCategory({ id:'c', name:'Lighting', display_order:3, is_locked:false })).toBe(true)
})
```

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** `canDeleteCategory(c) => !c.is_locked` plus the hooks and admin page (add field, inline rename, delete with confirm hidden for locked).

- [ ] **Step 4: Run to verify pass** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/categories && git commit -m "feat(categories): hooks and admin page with locked Miscellaneous"
```

### Task 22: Estimates hooks + Budget page

**Files:**
- Create: `src/features/budget/useEstimates.ts`, `src/features/budget/EstimatesEditor.tsx`, `src/features/budget/BudgetPage.tsx`
- Test: `src/features/budget/BudgetPage.test.tsx`

**Interfaces:**
- Consumes: `useCategories`, `useExpenses`, `computeBudgetRows`, `formatINR`, `AmountInput`.
- Produces: `useEstimates()`, `useUpsertEstimate()`; `EstimatesEditor` (one AmountInput per category, saves to `estimates`); `BudgetPage` rendering `computeBudgetRows` output as rows with `spent / estimated`, a fill bar (red when `over`), Total row, and an Unbudgeted bucket when `unbudgeted > 0`.

- [ ] **Step 1: Write failing test**

Render `BudgetPage` with mocked categories/estimates/expenses (reuse Task 10 fixtures); assert a category shows both its estimated and actual formatted amounts and that an over-budget row carries a `data-over="true"` marker.

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** hooks + editor + page. Page calls `computeBudgetRows`, renders each row (name, `formatINR(actual) / formatINR(estimated)`, bar width `min(100, actual/estimated*100)`, `data-over` when over), Total row, and Unbudgeted row. `Edit Estimates` opens `EstimatesEditor`.

- [ ] **Step 4: Run to verify pass** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/budget && git commit -m "feat(budget): estimates editor and planned-vs-actual budget page"
```

---

## Phase 8 — Dashboard

### Task 23: Fund settings hook + dashboard

**Files:**
- Create: `src/features/settings/useFundSettings.ts`, `src/features/settings/FundSettingsPage.tsx`, `src/features/dashboard/HomePage.tsx`, `BalanceHero.tsx`, `SplitCard.tsx`, `BudgetProgress.tsx`, `RecentActivity.tsx`
- Test: `src/features/dashboard/BalanceHero.test.tsx`

**Interfaces:**
- Consumes: `useDonations`, `useExpenses`, `useEstimates`, `computeBalance`, `computeBudgetRows`, `formatINR`, `useFundSettings`.
- Produces: `useFundSettings()` (single row) + settings page (mandal name, year, prefix); `HomePage` composing `BalanceHero` (available/collected/spent), `SplitCard` (cash/bank), `BudgetProgress` (collected vs total estimated), `RecentActivity` (last 5).

- [ ] **Step 1: Write failing test**

`BalanceHero.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceHero } from './BalanceHero'
it('shows available, collected, spent formatted', () => {
  render(<BalanceHero collected={96500} spent={62300} available={34200} />)
  expect(screen.getByText('₹34,200')).toBeInTheDocument()
  expect(screen.getByText('₹96,500')).toBeInTheDocument()
  expect(screen.getByText('₹62,300')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** `useFundSettings`, settings page, and dashboard components. `HomePage` loads donations/expenses/estimates, derives `computeBalance` + budget totals, and renders the four cards + quick action buttons linking to `/collect` and `/spend`.

- [ ] **Step 4: Run to verify pass** — Expected: PASS. Then `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings src/features/dashboard && git commit -m "feat(dashboard): fund settings + home balance cards"
```

---

## Phase 9 — Public statement & export

### Task 24: Excel export wrapper

**Files:**
- Create: `src/features/export/exportExcel.ts`
- Test: `src/features/export/exportExcel.test.ts`

**Interfaces:**
- Consumes: `buildStatementSheets` (Task 12), `xlsx`.
- Produces: `buildWorkbook(input): XLSX.WorkBook` (pure, testable) with three named sheets, and `downloadStatement(input, filename?)` calling `XLSX.writeFile`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildWorkbook } from './exportExcel'
it('builds a workbook with three sheets', () => {
  const wb = buildWorkbook({ donations: [], expenses: [], summary: { collected:0,spent:0,available:0,cashInHand:0,inBank:0 } })
  expect(wb.SheetNames).toEqual(['Donations', 'Spends', 'Summary'])
  expect(XLSX.utils.sheet_to_json(wb.Sheets['Donations'], { header: 1 })[0]).toEqual(['Receipt No','Donor','Method','Amount'])
})
```

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import * as XLSX from 'xlsx'
import { buildStatementSheets } from '../../domain/statement'
import type { PublicDonation, PublicExpense, Summary } from '../../domain/statement'
export function buildWorkbook(input: { donations: PublicDonation[]; expenses: PublicExpense[]; summary: Summary }) {
  const s = buildStatementSheets(input)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.donations), 'Donations')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.expenses), 'Spends')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.summary), 'Summary')
  return wb
}
export function downloadStatement(input: Parameters<typeof buildWorkbook>[0], filename = 'ganesh-chanda-statement.xlsx') {
  XLSX.writeFile(buildWorkbook(input), filename)
}
```

- [ ] **Step 4: Run to verify pass** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/export && git commit -m "feat(export): excel workbook builder + download"
```

### Task 25: Public statement page

**Files:**
- Create: `src/features/public/PublicStatementPage.tsx`, `src/features/public/usePublicStatement.ts`
- Test: `src/features/public/PublicStatementPage.test.tsx`

**Interfaces:**
- Consumes: `supabase` (reads `public_donations`, `public_expenses`, `public_summary`), `DataTable`, `formatINR`, `buildWhatsAppLink`, `downloadStatement`.
- Produces: `usePublicStatement()` and `<PublicStatementPage>` at `/s/:token` — Excel-style donations table (name + amount only), summary, `Share on WhatsApp` + `Export to Excel`. No auth. Must not request phone/address.

- [ ] **Step 1: Write failing test**

Render `PublicStatementPage` with mocked `usePublicStatement` data; assert donor names + total appear, and assert the component never renders any phone/address text (query for a sample phone string returns null).

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** hook querying the three public views; page renders `DataTable` for donations (columns Receipt/Donor/Method/Amount) with a total row, a summary block, and share/export buttons. `:token` is an opaque share slug stored in `fund_settings` (add `public_token text` in a follow-up migration `0006_public_token.sql`; validate token matches before rendering).

- [ ] **Step 4: Run to verify pass** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/public supabase/migrations/0006_public_token.sql && git commit -m "feat(public): shareable read-only statement with excel export"
```

---

## Phase 10 — PWA & deploy

### Task 26: PWA manifest, icons, install

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/manifest.webmanifest`
- Test: `src/pwa.test.ts` (asserts manifest fields)

**Interfaces:**
- Produces: installable PWA (name "Ganesh Chanda", theme color marigold `#E5860A`), offline app-shell caching via `vite-plugin-pwa`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import manifest from '../public/manifest.webmanifest'
it('declares an installable app', () => {
  expect(manifest.name).toBe('Ganesh Chanda')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
})
```
(Enable JSON import of `.webmanifest` via a tiny `vite` assert or read the file with `fs` in the test.)

- [ ] **Step 2: Run to verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** — `npm i -D vite-plugin-pwa`, register `VitePWA({ registerType:'autoUpdate', manifest:{ name:'Ganesh Chanda', short_name:'Chanda', display:'standalone', theme_color:'#E5860A', background_color:'#FBF4E6', icons:[...] } })`. Add marigold-tinted icons (a simple ॐ / lotus glyph is fine).

- [ ] **Step 4: Run to verify pass** — Expected: PASS. Then `npm run build` and confirm `dist/manifest.webmanifest` + service worker emitted.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts index.html public && git commit -m "feat(pwa): installable manifest, icons, offline shell"
```

### Task 27: Deploy config + docs

**Files:**
- Create: `vercel.json` (SPA rewrite to `/index.html`), `README.md` deploy section, `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: a documented deploy path (Vercel static + env vars) and a working production build.

- [ ] **Step 1: Add SPA rewrite + env docs**

`vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
`.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
README: steps to set env vars in Vercel + apply Supabase migrations in order.

- [ ] **Step 2: Verify full build + tests green**

Run: `npm test` → Expected: all PASS. Run: `npm run build` → Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example README.md && git commit -m "chore: deploy config and setup docs"
```

---

### Task 28: Committee members — schema, auto-provision, page

**Files:**
- Create: `supabase/migrations/0007_committee.sql`, `src/features/committee/useCommittee.ts`, `src/features/committee/CommitteePage.tsx`
- Modify: `src/features/auth/AuthProvider.tsx` (auto-provision on login)
- Test: `src/features/committee/useCommittee.test.ts`

**Interfaces:**
- Consumes: `supabase`, `useAuth`, `useDonations`, `formatINR`.
- Produces: `committee_members` table (id = auth user id); `useCommittee()` (list), `useUpsertMyMembership()`, `useUpdateMyProfile()`; `committeeCollections(donations, members)` pure helper mapping each member to their collected total; `<CommitteePage>` listing members (name · role · phone) with the current user highlighted and their collected total.

- [ ] **Step 1: Write committee schema + RLS SQL**

`supabase/migrations/0007_committee.sql`:
```sql
create table committee_members (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role text,
  joined_at timestamptz not null default now()
);
alter table committee_members enable row level security;
-- everyone signed in can see the committee
create policy committee_read on committee_members for select to authenticated using (true);
-- but you may only create/update your own row
create policy committee_insert_self on committee_members for insert to authenticated with check (id = auth.uid());
create policy committee_update_self on committee_members for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
```
Apply in the Supabase SQL editor; verify `select * from committee_members;` returns 0 rows without error.

- [ ] **Step 2: Write failing test for the pure helper**

`src/features/committee/useCommittee.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { committeeCollections } from './useCommittee'
it('sums each member\'s collected donations', () => {
  const members = [{ id: 'u1', name: 'Asha', joined_at: '' }, { id: 'u2', name: 'Ravi', joined_at: '' }] as any
  const donations = [
    { collected_by: 'u1', amount: 5000 }, { collected_by: 'u1', amount: 2000 }, { collected_by: 'u2', amount: 1000 },
  ] as any
  const out = committeeCollections(members, donations)
  expect(out.find(m => m.id === 'u1')!.collected).toBe(7000)
  expect(out.find(m => m.id === 'u2')!.collected).toBe(1000)
})
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run src/features/committee/useCommittee.test.ts` → Expected: FAIL.

- [ ] **Step 4: Implement helper, hooks, page, and auto-provision**

`useCommittee.ts` exports `committeeCollections(members, donations)`:
```ts
import type { Donation } from '../../types/db'
export interface CommitteeMember { id: string; name: string; phone?: string | null; role?: string | null; joined_at: string }
export function committeeCollections(members: CommitteeMember[], donations: Pick<Donation,'collected_by'|'amount'>[]) {
  const byUser = new Map<string, number>()
  for (const d of donations) if (d.collected_by) byUser.set(d.collected_by, (byUser.get(d.collected_by) ?? 0) + d.amount)
  return members.map(m => ({ ...m, collected: byUser.get(m.id) ?? 0 }))
}
```
Plus `useCommittee()` (query `committee_members`), `useUpdateMyProfile()` (update own row). In `AuthProvider`, after a session is established, call an idempotent upsert so first login provisions membership:
```ts
// inside AuthProvider, when a user becomes available:
await supabase.from('committee_members')
  .upsert({ id: user.id, name: user.email?.split('@')[0] ?? 'Member' }, { onConflict: 'id', ignoreDuplicates: true })
```
`CommitteePage`: render `committeeCollections(members, donations)` — each row name · role · phone · `formatINR(collected)`, current user (`useAuth().user.id`) highlighted, with an "Edit my details" action calling `useUpdateMyProfile`.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/features/committee/useCommittee.test.ts` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_committee.sql src/features/committee src/features/auth/AuthProvider.tsx && git commit -m "feat(committee): auto-provision members on login + committee page"
```

---

## Self-Review

**Spec coverage:**
- Committee (login = member, auto-provision, per-member collections) → Task 28.
- Collect chanda (name/address/phone/amount + WhatsApp receipt) → Tasks 16–19, 11, 3.
- Track spends (preset category, description, deduct balance) → Tasks 20, 9, 22.
- Estimates (pre-seeded, planned vs actual per item, unbudgeted) → Tasks 6, 10, 22.
- Preset categories (editable, Miscellaneous locked) → Tasks 6, 21.
- Balance + online/offline split → Tasks 9, 23.
- Public statement + privacy (name+amount only) → Tasks 5, 25.
- Excel-style tables + export → Tasks 12, 15, 24, 25.
- Traditional theme + friendly controls → Tasks 1, 14, 15 (tokens + shell + components).
- PWA installable + shareable link → Tasks 26, 25.
- Auth (volunteers add / public views) → Tasks 4, 13.
- Navigation/screens/buttons (complete UX) → Tasks 14–25.

**Type consistency:** `Method` used consistently; `computeBalance`/`computeBudgetRows`/`buildStatementSheets` signatures referenced identically by dashboard, budget, and export tasks; `donationKeys`/`expenseKeys`/`categoryKeys` naming consistent.

**Placeholder scan:** UI-assembly steps reference concrete interfaces and reuse tested domain functions; no "TBD"/"handle edge cases" left as implementation substance.

**Open follow-ups (non-blocking):** `public_token` migration introduced in Task 25; icon art in Task 26 is a simple glyph.
