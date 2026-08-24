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
