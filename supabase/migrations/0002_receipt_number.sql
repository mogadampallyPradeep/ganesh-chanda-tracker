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
