-- supabase/migrations/0010_public_views_payments.sql
-- Public statement reflects committed vs paid. Donor phone and address remain
-- excluded, exactly as before.
--
-- The views are DROPPED and recreated, not replaced. CREATE OR REPLACE VIEW can
-- only append columns — it cannot rename or retype an existing one. Both of
-- these do exactly that (public_expenses: source -> paid at column 4;
-- public_summary: spent -> committed at column 2), so a plain CREATE OR REPLACE
-- fails with: cannot change name of view column "source" to "paid".

drop view if exists public_expenses;
drop view if exists public_summary;

create view public_expenses as
  select
    c.name as category_name,
    e.description,
    e.amount as amount,
    s.paid,
    s.balance,
    e.created_at
  from expenses e
  join categories c on c.id = e.category_id
  join expense_status s on s.expense_id = e.id;

create view public_summary as
  select collected, committed, spent, outstanding, cash_in_hand, in_bank,
         (cash_in_hand + in_bank) as available
  from (
    select
      (select coalesce(sum(amount), 0) from donations)        as collected,
      (select coalesce(sum(amount), 0) from expenses)         as committed,
      (select coalesce(sum(amount), 0) from expense_payments) as spent,
      (select coalesce(sum(amount), 0) from expenses)
        - (select coalesce(sum(amount), 0) from expense_payments) as outstanding,
      ( (select coalesce(sum(amount), 0) from donations where method = 'offline')
        - (select coalesce(sum(amount), 0) from expense_payments where source = 'cash')
        - (select coalesce(sum(amount), 0) from reimbursements where source = 'cash')
      ) as cash_in_hand,
      ( (select coalesce(sum(amount), 0) from donations where method = 'online')
        - (select coalesce(sum(amount), 0) from expense_payments where source = 'bank')
        - (select coalesce(sum(amount), 0) from reimbursements where source = 'bank')
      ) as in_bank
  ) t;

grant select on public_expenses, public_summary to anon, authenticated;
