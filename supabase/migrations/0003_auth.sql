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
