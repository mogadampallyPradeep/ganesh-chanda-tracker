-- supabase/migrations/0008_expense_payments.sql
-- Expense advances & balance, phase 1 (additive).
--
-- expenses.amount stops meaning "money that left" and starts meaning
-- "total agreed". Actual movements of money live in expense_payments.
--
-- expenses.source / expenses.paid_by are intentionally LEFT IN PLACE here and
-- dropped in 0011a/0011b, after the app has stopped reading them. That keeps the
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
