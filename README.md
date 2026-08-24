# Atharva Nidhi

A simple, installable app for a Ganesh Chaturthi mandal to collect chanda (donations),
track spends against a live balance, and plan the festival budget — with a shareable
public link so anyone can see the balance at any time.

## What it does

1. **Collect chanda** — record donor name, address, phone, amount (online/offline) and
   share a receipt to the donor over WhatsApp.
2. **Track spends** — record expenses by preset category; the available balance deducts live.
3. **Estimates** — plan the budget per category and compare planned vs actual.

Volunteers log in to add entries; anyone with the link can view the live balance and
statement (read-only). Donor phone/address stay private.

## Stack

- **Frontend:** React PWA (installable + shareable link)
- **Backend/DB:** Supabase (Postgres + auto API + Row Level Security; custom mobile+password auth via SECURITY DEFINER RPC, not Supabase Auth)

## Design

See the full design spec: [`docs/superpowers/specs/2026-08-24-ganesh-chanda-tracker-design.md`](docs/superpowers/specs/2026-08-24-ganesh-chanda-tracker-design.md)

## Deploy

To deploy to Vercel (or any static host):

1. **Set environment variables** in your host's dashboard:
   - `VITE_SUPABASE_URL` — your Supabase project's API URL (Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` — your Supabase project's anon key (same location)

2. **Apply the Supabase schema** to your project:
   - Follow the setup steps in [`supabase/README.md`](supabase/README.md)
   - Apply the migrations via the Supabase SQL Editor
   - Set the bootstrap admin mobile and password before running the migrations

3. **Build and deploy:**
   ```bash
   npm run build
   # Deploy the `dist/` folder to Vercel (or your chosen static host)
   ```

See [`supabase/README.md`](supabase/README.md) for detailed database setup and troubleshooting.

## Status

v1 complete — React PWA with live donation/expense tracking, budget estimates, and public statement views.
