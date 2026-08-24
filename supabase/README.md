# Database setup (Supabase)

Project ref: `kzlsuosriuahkqrmiiac`

## Apply the schema

1. Open the Supabase dashboard → **SQL Editor**.
2. Before running, open `migrations/0006_seed.sql` (or the seed section at the bottom of
   `apply-all.sql`) and **change the bootstrap admin** mobile + password:
   ```sql
   select add_member('9999999999', 'Admin', 'change-me-now', true);
   ```
   Use your own mobile number and a password you'll remember.
3. Paste the entire contents of **`apply-all.sql`** and run it. (Or run `migrations/0001…0006`
   in order.)

## What it creates

- Tables: `fund_settings`, `categories`, `estimates`, `committee_members`, `donations`,
  `expenses`, `reimbursements`.
- Receipt-number trigger (`GNP2026-0001`…).
- Auth functions: `member_login`, `add_member`, `set_member_password`, `set_member_admin`,
  `remove_member` (+ the `committee_public` view). Passwords are bcrypt-hashed; `password_hash`
  is never exposed to the client.
- RLS: committee tables allow app access via the anon key; `committee_members` is reachable
  only through the functions/view.
- Public statement views: `public_donations`, `public_expenses`, `public_summary` (no donor
  phone/address).
- Seed: fund settings, preset categories with zero estimates, and one bootstrap admin.

## After applying

Log in to the app with the bootstrap admin mobile + password, then add the rest of your
committee (Committee screen → Add member) and flag which numbers are admins.

## Re-running

The schema is not idempotent (it uses `create table`). To reset during development, drop the
public tables/types first or use a fresh Supabase project.
