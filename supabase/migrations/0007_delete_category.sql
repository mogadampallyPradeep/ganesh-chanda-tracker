-- Deletable expense categories.
--
-- Additive only: creates a view and a function. No ALTER TABLE, no DROP,
-- and no statement here modifies existing rows. Safe to run on a live fund.
--
-- The expenses.category_id FK is deliberately left as NO ACTION: it is the
-- backstop that makes an orphaned expense impossible even if the app misbehaves.

-- What is filed under each category, so the UI can show it before deleting.
create or replace view category_usage as
  select
    c.id                            as category_id,
    count(e.id)::int                as expense_count,
    coalesce(sum(e.amount), 0)::int as total_amount
  from categories c
  left join expenses e on e.category_id = c.id
  group by c.id;

grant select on category_usage to anon, authenticated;

-- Delete a category, first moving any expenses filed under it to p_move_to.
-- Both steps run in one transaction, so this can never half-apply and leave
-- moved expenses behind a surviving category.
create or replace function delete_category(p_category_id uuid, p_move_to uuid default null)
returns void
language plpgsql
as $$
declare
  v_locked boolean;
  v_count  int;
  v_name   text;
begin
  select is_locked, name into v_locked, v_name from categories where id = p_category_id;

  if v_name is null then
    raise exception 'Category not found.';
  end if;

  if v_locked then
    raise exception '% is locked and cannot be removed.', v_name;
  end if;

  select count(*) into v_count from expenses where category_id = p_category_id;

  if v_count > 0 then
    if p_move_to is null then
      raise exception 'Choose a category to move % expense(s) into.', v_count;
    end if;

    if p_move_to = p_category_id then
      raise exception 'Cannot move expenses into the category being removed.';
    end if;

    if not exists (select 1 from categories where id = p_move_to) then
      raise exception 'Destination category not found.';
    end if;

    update expenses set category_id = p_move_to where category_id = p_category_id;
  end if;

  -- The matching estimates row cascades away via its own FK.
  delete from categories where id = p_category_id;
end;
$$;

grant execute on function delete_category(uuid, uuid) to anon, authenticated;
