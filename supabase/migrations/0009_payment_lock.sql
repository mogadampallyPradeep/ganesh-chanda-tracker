-- supabase/migrations/0009_payment_lock.sql
-- Make the overpayment guard hold under concurrency. 0008's version read the
-- parent total without a lock, so two simultaneous payments could each see the
-- other as invisible and both pass. FOR UPDATE serialises them on the parent
-- expense row.

create or replace function assert_payment_within_total() returns trigger
language plpgsql as $fn$
declare
  v_total int;
  v_paid  int;
begin
  select amount into v_total from expenses where id = new.expense_id for update;

  if v_total is null then
    raise exception 'Expense not found.';
  end if;

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
