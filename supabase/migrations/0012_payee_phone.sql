-- Vendor contact number.
--
-- expenses.payee already records who a spend was paid to (the band person, the
-- lighting person, the tent house). This stores their number alongside it, so
-- next year's committee can reach them without asking around.
--
-- Additive and nullable: safe on live data, no backfill, nothing to change in
-- existing rows. Numbered 0012 because 0011a/0011b are reserved for dropping
-- expenses.source and expenses.paid_by.
--
-- DELIBERATELY NOT exposed in public_expenses or public_summary. Those views are
-- readable by anyone holding the shared statement link and already exclude donor
-- phone and address; a vendor's number gets the same treatment.

alter table expenses add column payee_phone text;
