-- Task 11, step 3 of 3. Run this LAST — only after the step-2 deploy is live
-- and has been used for a session.
--
-- These columns were superseded by expense_payments in 0008, and that migration
-- copied their values across. Nothing reads or writes them any more.
--
-- NEVER add CASCADE to these statements. If a view still depends on the column
-- the drop FAILS, and that failure is the safe outcome. Adding CASCADE to "fix"
-- it silently drops public_expenses AND public_summary, and the shared public
-- statement link goes dead for everyone holding it. 0010 already removed the
-- last view dependency, so this should simply succeed.

alter table expenses drop column source;
alter table expenses drop column paid_by;
