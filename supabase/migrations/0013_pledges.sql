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
