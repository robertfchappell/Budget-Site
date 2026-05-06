ALTER TABLE recurring_bills
  DROP CONSTRAINT IF EXISTS recurring_bills_frequency_check;

ALTER TABLE recurring_bills
  ADD CONSTRAINT recurring_bills_frequency_check
  CHECK (frequency IN ('monthly', 'weekly', 'biweekly', 'yearly', 'one_time'));

ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS term TEXT;
