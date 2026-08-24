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
