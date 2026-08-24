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
