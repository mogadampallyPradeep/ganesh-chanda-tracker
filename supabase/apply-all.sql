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
-- Sequential receipt numbers: <prefix><year>-<0000>, e.g. GNP2026-0001

create sequence if not exists donation_receipt_seq;

create or replace function set_receipt_no() returns trigger
language plpgsql as $$
declare
  s fund_settings%rowtype;
  n bigint;
begin
  if new.receipt_no is null then
    select * into s from fund_settings limit 1;
    n := nextval('donation_receipt_seq');
    new.receipt_no := coalesce(s.receipt_prefix, 'GNP')
                      || coalesce(s.festival_year, extract(year from now())::int)::text
                      || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_receipt_no on donations;
create trigger trg_set_receipt_no before insert on donations
for each row execute function set_receipt_no();
-- Config-based auth: mobile + static password. Passwords are bcrypt-hashed and
-- never leave the database. All access to committee_members goes through these
-- SECURITY DEFINER functions + the safe view (password_hash is never exposed).

-- Safe, public-facing member list (no password_hash)
create or replace view committee_public as
  select mobile, name, is_admin from committee_members;

-- Verify credentials; returns safe fields or no rows.
create or replace function member_login(p_mobile text, p_password text)
returns table (mobile text, name text, is_admin boolean)
language sql security definer set search_path = public as $$
  select m.mobile, m.name, m.is_admin
  from committee_members m
  where m.mobile = p_mobile
    and m.password_hash = crypt(p_password, m.password_hash);
$$;

-- Add or update a member (name/admin). Sets password only on first insert.
create or replace function add_member(p_mobile text, p_name text, p_password text, p_is_admin boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into committee_members (mobile, name, password_hash, is_admin)
  values (p_mobile, p_name, crypt(p_password, gen_salt('bf')), coalesce(p_is_admin, false))
  on conflict (mobile) do update
    set name = excluded.name, is_admin = excluded.is_admin;
$$;

create or replace function set_member_password(p_mobile text, p_password text)
returns void language sql security definer set search_path = public as $$
  update committee_members set password_hash = crypt(p_password, gen_salt('bf'))
  where mobile = p_mobile;
$$;

create or replace function set_member_admin(p_mobile text, p_is_admin boolean)
returns void language sql security definer set search_path = public as $$
  update committee_members set is_admin = p_is_admin where mobile = p_mobile;
$$;

create or replace function remove_member(p_mobile text)
returns void language sql security definer set search_path = public as $$
  delete from committee_members where mobile = p_mobile;
$$;

grant select on committee_public to anon, authenticated;
grant execute on function member_login(text, text)         to anon, authenticated;
grant execute on function add_member(text, text, text, boolean) to anon, authenticated;
grant execute on function set_member_password(text, text)  to anon, authenticated;
grant execute on function set_member_admin(text, boolean)  to anon, authenticated;
grant execute on function remove_member(text)              to anon, authenticated;
-- Row Level Security.
-- v1 model: the app authenticates members client-side and uses the anon key for
-- data access, so the committee-managed tables allow full CRUD to anon.
-- committee_members is the exception: RLS on with NO policy = no direct access;
-- it is reachable only through the SECURITY DEFINER functions + committee_public view.
-- (Accepted v1 trade-off: not hardened against a determined technical user.)

alter table fund_settings      enable row level security;
alter table categories         enable row level security;
alter table estimates          enable row level security;
alter table donations          enable row level security;
alter table expenses           enable row level security;
alter table reimbursements     enable row level security;
alter table committee_members  enable row level security;  -- deny direct access

create policy p_all on fund_settings  for all to anon, authenticated using (true) with check (true);
create policy p_all on categories     for all to anon, authenticated using (true) with check (true);
create policy p_all on estimates      for all to anon, authenticated using (true) with check (true);
create policy p_all on donations      for all to anon, authenticated using (true) with check (true);
create policy p_all on expenses       for all to anon, authenticated using (true) with check (true);
create policy p_all on reimbursements for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on
  fund_settings, categories, estimates, donations, expenses, reimbursements
  to anon, authenticated;
grant usage on sequence donation_receipt_seq to anon, authenticated;
-- Public statement views (for the shareable /s/:token link).
-- Donor phone & address are NEVER included here.

create or replace view public_donations as
  select receipt_no, donor_name, amount, method, created_at
  from donations;

create or replace view public_expenses as
  select c.name as category_name, e.description, e.amount, e.source, e.created_at
  from expenses e
  join categories c on c.id = e.category_id;

create or replace view public_summary as
  select collected, spent, cash_in_hand, in_bank, (cash_in_hand + in_bank) as available
  from (
    select
      (select coalesce(sum(amount), 0) from donations) as collected,
      (select coalesce(sum(amount), 0) from expenses)  as spent,
      ( (select coalesce(sum(amount), 0) from donations where method = 'offline')
        - (select coalesce(sum(amount), 0) from expenses where source = 'cash')
        - (select coalesce(sum(amount), 0) from reimbursements where source = 'cash')
      ) as cash_in_hand,
      ( (select coalesce(sum(amount), 0) from donations where method = 'online')
        - (select coalesce(sum(amount), 0) from expenses where source = 'bank')
        - (select coalesce(sum(amount), 0) from reimbursements where source = 'bank')
      ) as in_bank
  ) t;

grant select on public_donations, public_expenses, public_summary to anon, authenticated;
-- Seed: fund settings, preset categories (+ zero estimates), and a bootstrap admin.

insert into fund_settings (mandal_name, festival_year, receipt_prefix)
values ('Shri Ganesh Utsav Mandal', 2026, 'GNP');

insert into categories (name, display_order, is_locked) values
  ('Ganesh Idol',          1, false),
  ('Decoration',           2, false),
  ('Lighting',             3, false),
  ('Tent House / Mandap',  4, false),
  ('Annadanam',            5, false),
  ('Pandit / Pooja cost',  6, false),
  ('Miscellaneous',       99, true);

insert into estimates (category_id, estimated_amount)
  select id, 0 from categories;

-- ⬇️ BOOTSTRAP ADMIN — change the mobile and password before running, then log in
--    with these and add the rest of your committee from the app.
select add_member('9999999999', 'Admin', 'change-me-now', true);
