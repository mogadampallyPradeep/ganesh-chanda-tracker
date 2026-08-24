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
- **Backend/DB:** Supabase (Postgres + Auth + auto API + Row Level Security)

## Design

See the full design spec: [`docs/superpowers/specs/2026-08-24-ganesh-chanda-tracker-design.md`](docs/superpowers/specs/2026-08-24-ganesh-chanda-tracker-design.md)

## Status

Design approved — implementation plan next.
