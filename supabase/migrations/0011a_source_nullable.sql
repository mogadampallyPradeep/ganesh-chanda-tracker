-- Task 11, step 1 of 3. Run this FIRST, before deploying the code that stops
-- writing these columns.
--
-- expenses.source is NOT NULL with no default, so there is no two-step order
-- that avoids a broken window:
--   drop the column first  -> the deployed code still writes it, inserts fail
--   deploy the code first  -> it omits source, NOT NULL rejects every insert
-- Making it nullable first means both the old and the new code work, so the
-- deploy in step 2 has no failing window at all.
--
-- Reversible, and safe to sit in this state indefinitely.

alter table expenses alter column source drop not null;
