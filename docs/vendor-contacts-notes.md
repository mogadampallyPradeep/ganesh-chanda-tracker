# Vendor contacts — captured idea (not designed, not built)

Feature #4 in the queue. Store a contact number against the person a spend is
paid to — the band person, the lighting person, the tent house — so next year's
committee can reach them without asking around.

## What exists already

`expenses.payee` is a nullable `text` column, written by the expense form and
otherwise unused: nothing displays it prominently and nothing links it anywhere.
So the name is already captured; only the number is missing.

## Two shapes, materially different in cost

**A. A phone column on the expense.** Add `payee_phone text` beside `payee`,
show it on the expense with a `tel:` link so it dials from the phone. Roughly
one migration and one form field. The number is attached to that spend and is
re-typed for the next spend with the same vendor.

**B. A vendors table.** `vendors(id, name, phone, note, category_id?)`, with
`expenses.vendor_id` referencing it. The band's number is entered once and
reused across years and spends; a Vendors page lists everyone the mandal has
ever paid. More build, and it needs a migration path for `payee` strings already
recorded.

Worth noting the category list already reads like a vendor list — Band (PAD),
Lighting, Tent House / Mandap, Pandit / Pooja cost — which is an argument for B,
since a vendor naturally belongs to a category.

## Open question, blocks the choice

Is the value in **reaching this year's vendor quickly** (A is enough), or in
**building a reusable contact book across festivals** (needs B)? If the mandal
mostly rehires the same people every year, B pays for itself; if vendors change
yearly, A is the right size.

## Non-negotiable

A phone number is personal data. It must NEVER appear in the public statement
views (`public_expenses`, `public_summary`) or the shareable link — those already
deliberately exclude donor phone and address, and vendor numbers get the same
treatment.
