# Ganesh Chanda Tracker — Design Spec

**Date:** 2026-08-24
**Status:** Approved design → ready for implementation plan
**Repo:** `mogadampallyPradeep/ganesh-chanda-tracker`

## Purpose

A simple, installable app for a Ganesh Chaturthi mandal to:

1. **Collect chanda** (donations) with donor details and a WhatsApp-shareable receipt.
2. **Track spends** against the collected funds, deducting from a live balance.
3. **Estimate** the festival budget (planned costs) and compare planned vs actual per item.

At any time, anyone with a shared link can see the live **balance** — total received, total spent, and what's left — without logging in.

## Scope (v1)

- **One fund, one festival** (Ganesh 2026). No multi-year / multi-fund.
- **Manual entry only.** No payment-app, bank, or WhatsApp-API integration. "Online / offline" is a label chosen per entry.
- **Volunteers add** entries (login required). **Public views** the balance/statement via a link (no login).
- Keep the database and the build deliberately lite.

## Non-goals (explicitly deferred)

Offline-write queue, multi-year/multi-fund, donor logins, PDF/print exports, role hierarchies, SMS/email. Easy to add later; not in v1. (Excel/CSV export **is** in v1 — see UI/UX.)

## Architecture

- **Frontend:** React **PWA** with **Tailwind CSS + shadcn/ui** — installable to the home screen (behaves like an app, tolerant of weak pandal connectivity for reads) and simultaneously a shareable public URL. One codebase serves both the volunteer app and the public statement. See **UI stack & theming**.
- **Backend + DB:** **Supabase** (hosted Postgres + Auth + auto-generated REST API + Row Level Security). Almost no server code — the app talks to Supabase directly; RLS enforces who can read/write.
- **Hosting:** static PWA on a free static host (Vercel/Netlify) or Railway; Supabase is fully managed.

### Why this stack

Matches "very lite database" and "keep it simple": Supabase provides the DB, login, and API so the only thing built is the UI. PWA resolves the "installable app **and** public share link" requirement from a single codebase without app-store friction.

## Data model

Four small tables.

### `categories` — preset spend/estimate categories (config-driven)
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | e.g. "Ganesh Idol" |
| display_order | int | sort order |

Seeded with: **Ganesh Idol, Decoration, Lighting, Tent House / Mandap, Annadanam, Pandit / Pooja cost, Miscellaneous**. Editable (add/rename/remove) without code changes. Miscellaneous is the catch-all.

### `estimates` — planned budget (one line per category)
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| category_id | uuid fk → categories | |
| estimated_amount | numeric | |
| note | text | optional |

Screen is **pre-seeded with all categories at ₹0**; volunteer fills in amounts. Sum = **Total Estimated Cost**.

### `donations` — chanda received (money in)
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| receipt_no | text | sequential, e.g. `GNP2026-0001` |
| donor_name | text | |
| address | text | private to volunteers |
| phone | text | private; used for WhatsApp receipt |
| amount | numeric | |
| method | enum | `online` \| `offline` |
| note | text | optional |
| collected_by | text fk → committee_members.mobile | **who collected** this donation |
| created_at | timestamptz | |

### `expenses` — spends (money out)
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| category_id | uuid fk → categories | chosen from preset list; links spend to its estimate line |
| description | text | **what the spend was for**, so it's remembered (e.g. "Advance to Kumar Arts for idol") |
| payee | text | optional (the vendor) |
| amount | int | |
| paid_by | text fk → committee_members.mobile | **who paid** for this spend |
| source | enum | `cash` \| `bank` \| `personal` — where the money came from |
| note | text | optional extra detail |
| created_at | timestamptz | |

`source` replaces the old online/offline label for spends: **`cash`** draws down fund cash-in-hand,
**`bank`** draws down fund bank, **`personal`** is out-of-pocket by `paid_by` (creates a reimbursement
owed — see below). Expenses whose category has no estimate line still count in Total Spent, surfaced
as an **"Unbudgeted"** bucket.

### `reimbursements` — paying a member back for a personal spend
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| member_id | text fk → committee_members.mobile | **who is being reimbursed** (e.g. Y) |
| from_member_id | text fk → committee_members.mobile | **who paid them from the fund** (the holder, e.g. X) |
| amount | int | |
| source | enum | `cash` \| `bank` — which fund quota it came from |
| created_at | timestamptz | |

A reimbursement **draws down fund cash/bank** (from the holder X) and **clears that much of the
member's owed-back**. It is a settlement, not a new expense — it does **not** add to Total Spent.

### `committee_members` — configured member list (also the login table)
| field | type | notes |
|---|---|---|
| mobile | text **primary key** | **the primary identity** everywhere — login id and the key all entries attribute to |
| name | text | shown on the Committee screen |
| password_hash | text | hashed static password; never sent to the client |
| is_admin | boolean | **grants elevated powers** (default false) |
| created_at | timestamptz | |

**Phone number is the primary identity** across the whole app: `donations.collected_by`,
`expenses.paid_by`, and `reimbursements.member_id` / `from_member_id` all reference
`committee_members.mobile`. Members are shown as name + mobile.

**The member list is the config.** Anyone whose mobile number is in this table can log in
with their static password; there is no email, OTP, or self-signup. `donations.collected_by`
and `expenses.spent_by` reference `committee_members.id`, so every entry is attributed to a member.
**Admins** are members with `is_admin = true` — a configured list of admin numbers. Admins can
add members and flag any number as admin (admins add admins).

### Derived (never stored — always computed for correctness)
- `Total Collected = sum(donations.amount)`
- `Total Spent = sum(expenses.amount)`
- `Available Balance = Total Collected − Total Spent`
- `Cash in hand = offline donations − offline expenses`
- `In bank = online donations − online expenses`
- Per-category: `estimated vs actual(sum of linked expenses) vs remaining/over`
- **Spends deduct the matching quota by source:** `cash` spend → **cash in hand**, `bank` spend →
  **in bank**, `personal` spend → neither (creates a reimbursement owed).
- **Budget shortfall:** `Collected − Total Estimated` (negative = still to raise); per category `remaining`.

**Per-member custody (Committee screen):**
- `collected(m) = sum(donations where collected_by = m)` — split cash/bank by donation method.
- `paid_from_fund(m) = sum(expenses where paid_by = m and source in (cash,bank))`.
- `reimbursed_out(m) = sum(reimbursements where from_member_id = m)`.
- **`holding(m) = collected(m) − paid_from_fund(m) − reimbursed_out(m)`** (cash & bank tracked separately).
- `owed_back(m) = sum(personal expenses where paid_by = m) − sum(reimbursements where member_id = m)`.
- **Over-spend flag:** raised if any member's `holding` goes negative (they spent fund money they weren't holding).

**Editing:** any committee member can **add and edit any spend at any time**; deleting an entry is
**admin-only** (protects the money trail). Donations follow the same rule.

All calculations are **automatic and always accurate** — derived from rows on every render (never
stored), using integer-rupee arithmetic so there is no rounding error.

## Features by part

### Part 1 — Collect Chanda
- Form: **name, address, phone, amount**, online/offline toggle.
- On save: generate the next **sequential receipt number** (`GNP2026-000N`).
- **WhatsApp receipt:** "Share receipt" opens WhatsApp directly to the donor's number via a `wa.me/<phone>?text=<message>` deep link, prefilled with a thank-you, receipt number, amount, date, and a link to the receipt page. No API, no keys — the volunteer taps send.

### Part 2 — Track Spends
- Form: **category (preset dropdown)**, **description** (what it was for — so it's remembered), amount
  (with built-in calculator), **paid by** (committee member, defaults to the current user), and a
  **"Paid from"** choice:
  - **Committee fund** → then pick **Cash** or **Bank** (draws down that fund quota).
  - **Self (out-of-pocket)** → logged as a **reimbursement owed** to the payer; fund untouched.
- On save: counts toward Total Spent and the linked category's actual; **balances update live** (computed).
- Any committee member can **edit any spend at any time**.
- Chronological expense list showing **category + description + amount + who paid / source** at a glance.

### Part 3 — Estimates
- Pre-seeded budget list (one line per category, ₹0 default) — fill in amounts.
- **Planned vs actual per item:** each category row shows `Estimated · Actual · Remaining/Over`.
- Unbudgeted spends shown in their own bucket.

### Dashboard / Balance card (shared)
- **Total Estimated · Total Collected · Total Spent · Available Balance**, plus **Cash-in-hand (offline) vs In-bank (online)** split.

### Public statement (shareable link)
- Read-only totals + statement, WhatsApp-shareable.
- **Excel-style layout:** donations and spends shown as clean spreadsheet-like tables
  (headers, aligned amounts, a bold totals row), so the shared balance is easy for anyone
  to understand. **Export to Excel/CSV** available.
- **Privacy:** public sees donor **name + amount only** — phone and address are never exposed publicly (enforced via a public view / RLS that excludes those columns).

## Auth & access

- **Login = mobile number + static password** (no email, no OTP, no self-signup). Credentials are
  verified server-side via a Supabase `SECURITY DEFINER` RPC (`member_login`) that checks the
  hashed password and returns safe member fields; `password_hash` is never exposed to the client.
  Session is kept client-side (localStorage).
- **Committee members:** any mobile number in `committee_members` can log in and add donations,
  spends, estimates, and edit categories, and edit **their own** entries.
- **Admins** (`is_admin = true` — the configured admin-numbers list) additionally can **delete/edit
  any entry** and **manage committee & fund settings** (including adding members and granting admin).
- **Public:** no login; read-only access to non-private fields via public views only.
- **Security note (v1):** this is app-level auth with a shared Supabase anon key; adequate for a
  small trusted committee, not hardened against a determined technical user. Upgradeable later.

## Built-in calculator

- A **calculator** is built into the **amount field** on both the donation and spend forms: tap the
  calculator icon, add up cash as you count it (e.g. `500 + 500 + 200 + 100`), and the total drops
  straight into the amount. Prevents mental-math errors during collection.
- Also available as a standalone quick tool from the top bar. Standard operations, integer-rupee output.

## Budget slider & shortfall

- The Budget screen shows, per category, a **slider/progress bar of actual vs estimated** (fills toward
  the estimate, turns red past it) with `spent / estimated` and **remaining/over**.
- A prominent **overall shortfall**: `Total Estimated − Collected` — "how much we still need to raise",
  and `Total Estimated − Total Spent` — "how much budget is left to spend".
- Everything recomputes live as donations and spends change.

## Reimbursements UX

- On the **Committee** screen, each member shows **Collected · Holding (cash/bank) · Owed back**.
- A member with `owed_back > 0` shows a **"Reimburse"** action → pick source (cash/bank) and the
  holder paying (defaults to the main holder) → records a `reimbursements` row, clearing the owed
  amount and drawing down fund cash/bank.

## Engineering notes (v1)

- **No automated tests** — build directly for speed, but keep the code **reliable**: TypeScript
  strict mode, all money as integers, calculations centralized in pure `src/domain/*` functions,
  verified by `tsc --noEmit` + `npm run build` + a manual click-through before merge.

## Receipt numbering

Sequential per fund with a festival prefix, e.g. `GNP2026-0001`. Generated server-side (Supabase) to avoid gaps/duplicates.

## UI / UX direction

**Traditional and friendly.** The audience is mandal volunteers, not tech users — the
interface should feel festive and be effortless to operate.

- **Aesthetic:** a traditional Ganesh-festival look — warm saffron / marigold / deep red
  with gold accents, a clean readable typeface, and subtle cultural motifs. Celebratory,
  not corporate.
- **Simple, friendly controls:** large tap targets and buttons, minimal fields per screen,
  clear labels in plain language, a prominent online/offline toggle, and obvious primary
  actions ("Add Donation", "Share Receipt", "Add Spend").
- **Fast entry:** category as a dropdown of presets, sensible defaults (today's date,
  last-used method), and immediate feedback (balance updates on save).
- **Legible balance:** the balance card is the hero — big numbers, high contrast, readable
  at a glance on a phone in daylight.
- **Spreadsheet feel where it's shared:** statements and lists use a familiar **Excel-style
  table** — clear column headers, right-aligned amounts, alternating row shading, and a bold
  **totals row** at the bottom. It should read like a spreadsheet anyone has seen before, so
  the shared balance is instantly understandable. Offer **export to Excel/CSV** for the
  statement so it can be saved or forwarded as a familiar file.
- **Accessible:** works one-handed on a phone, high contrast, and installable to the home
  screen for quick access during collection rounds.

## UI stack & theming

Invest in a polished, cohesive look driven by a proper design system — not ad-hoc styles.

- **Component/styling stack:** **Tailwind CSS + shadcn/ui** (Radix primitives). We own and
  restyle every component, which is ideal for a custom festival theme and keeps the PWA light.
- **Design tokens (CSS variables):** a single festival theme defined once and reused
  everywhere — semantic tokens for background, surface, primary (saffron/marigold), accent
  (gold), success/positive (received), danger/negative (over-budget), plus radius, spacing,
  and shadow scales. Changing the theme = changing tokens, nothing else.
- **Palette:** warm saffron / marigold primary, deep temple-red secondary, gold accents on a
  soft cream background; a legible dark variant for night use.
- **Typography:** a warm, highly readable typeface; choose a font with **Devanagari** support
  so Marathi/Hindi labels can be added later without rework.
- **Charts/visuals:** if any charts are added (e.g. spend-by-category), follow a single
  accessible palette derived from the theme tokens so visuals read as one system in both
  light and dark.
- **Consistency:** shared table, card, button, and form components used across all three
  parts so the whole app feels like one designed product, and the Excel-style statement
  inherits the same tokens.

## Navigation & screens (complete UX)

**Model:** a persistent **bottom tab bar** (4 tabs) for volunteers + a **top app bar**
(mandal name + overflow `⋮` menu). No hamburger — core actions are one tap away.

- **Bottom tabs:** Home · Collect · Spend · Budget
- **Overflow menu:** Share public link · Export to Excel · Categories · Committee · Fund settings · Sign out

### Home (Dashboard)
- Balance hero card: **Available Balance** (big) with Collected + Spent beneath.
- Split card: **Cash in hand** (offline) · **In bank** (online).
- Progress card: Collected vs Estimated budget (% + "need ₹X more").
- Recent activity: last 5 entries (donations + spends).
- Quick actions: `+ Collect Chanda`, `+ Add Spend`; `Share balance` in top bar.

### Collect (chanda in)
- List view (newest first) + search + `+ New Donation`.
- Form: donor name · address · phone · amount · method toggle (offline/online) · optional note.
- Buttons: `Save & Share Receipt` (primary), `Save only`.
- Receipt screen after save: receipt no. `GNP2026-####`, amount, donor, date →
  `Send Receipt on WhatsApp`, `Download / Print`, `Done`.
- Row tap → view → edit.

### Spend (money out)
- List view (category + description + amount) + `+ New Spend`.
- Form: category (preset dropdown) · **description** (what it's for) · amount · method toggle · optional payee.
- Buttons: `Save Spend`, `Cancel`. Row tap → view → edit.

### Budget (Estimates)
- Planned-vs-actual table: per category `spent / estimated` + fill bar (green, red when over), Total row.
- `Edit Estimates` opens pre-seeded category list (₹0 default) to fill amounts.
- Per-row tap → its linked spends; **Unbudgeted** bucket for spends with no estimate.

### Overflow / admin
- Share public link (copy · WhatsApp · QR); Export to Excel (donations + spends + summary);
  Categories (list, add, rename, reorder, remove — Miscellaneous locked);
  Committee (see below); Fund settings (mandal name, festival year, receipt prefix, currency); Sign out.

### Committee
- Lists all committee members (name · role · phone), newest first, with the **current user highlighted**.
- Anyone who logs in appears here automatically; each member can **edit their own** name/role/phone.
- Shows **how much each member has collected** (sum of their donations) for accountability.

### Public statement (no login — shared link)
- Excel-style **Chanda Received** table (name + amount only) + balance summary + spends summary.
- Buttons: `Share on WhatsApp`, `Export to Excel`. Read-only; phone/address never shown.

### UX conventions
- Row tap opens **view → edit** (no inline editing).
- **Delete** lives behind the edit screen (not swipe) to protect money records.

## Open items for the implementation plan

- Static host choice (Vercel/Netlify vs Railway).
- Exact RLS policies / public view definition for privacy.
- Receipt-number generation mechanism (sequence vs function).
- PWA manifest + icon.

## Provisioned resources

- **GitHub:** `mogadampallyPradeep/ganesh-chanda-tracker` (personal account).
- **Supabase project:** ref `kzlsuosriuahkqrmiiac`.
- **Approved visual mockups:** see the published UI/UX mockups (traditional festival theme,
  all screens + public statement).
