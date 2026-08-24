-- Atharva Nidhi — core schema
-- Amounts are integer rupees. Phone number (mobile) is the primary identity.

create extension if not exists pgcrypto;

create type donation_method as enum ('online', 'offline');
create type spend_source   as enum ('cash', 'bank', 'personal');
create type reimb_source   as enum ('cash', 'bank');

-- Single fund / festival config
create table fund_settings (
  id             uuid primary key default gen_random_uuid(),
  mandal_name    text not null,
  festival_year  int  not null,
  receipt_prefix text not null default 'GNP',
  currency       text not null default 'INR',
  public_token   text unique default encode(gen_random_bytes(8), 'hex')
);

-- Preset spend/estimate categories (config-driven)
create table categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  display_order int  not null default 0,
  is_locked     boolean not null default false
);

-- Planned budget: one line per category
create table estimates (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references categories(id) on delete cascade,
  estimated_amount int  not null default 0 check (estimated_amount >= 0),
  unique (category_id)
);

-- Committee = configured member list + login table. Mobile is the primary identity.
create table committee_members (
  mobile        text primary key,
  name          text not null,
  password_hash text not null,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Donations (money in)
create table donations (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   text unique,
  donor_name   text not null,
  address      text,
  phone        text,
  amount       int  not null check (amount > 0),
  method       donation_method not null,
  note         text,
  collected_by text references committee_members(mobile),
  created_at   timestamptz not null default now()
);

-- Spends (money out). source = where the money came from.
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  description text not null,
  payee       text,
  amount      int  not null check (amount > 0),
  paid_by     text references committee_members(mobile),
  source      spend_source not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- Reimbursements: paying a member back for a personal spend (settles owed).
create table reimbursements (
  id             uuid primary key default gen_random_uuid(),
  member_id      text not null references committee_members(mobile),
  from_member_id text references committee_members(mobile),
  amount         int  not null check (amount > 0),
  source         reimb_source not null,
  created_at     timestamptz not null default now()
);

create index on donations (collected_by);
create index on expenses (category_id);
create index on expenses (paid_by);
create index on reimbursements (member_id);
