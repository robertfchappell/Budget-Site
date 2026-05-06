ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS income_frequency TEXT;

UPDATE income_entries
SET income_frequency = CASE
  WHEN recurrence = 'recurring' THEN 'monthly'
  ELSE 'one_time'
END
WHERE income_frequency IS NULL;

ALTER TABLE income_entries
  ALTER COLUMN income_frequency SET DEFAULT 'one_time',
  ALTER COLUMN income_frequency SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'income_entries_income_frequency_check'
  ) THEN
    ALTER TABLE income_entries
      ADD CONSTRAINT income_entries_income_frequency_check
      CHECK (income_frequency IN ('weekly', 'biweekly', 'monthly', 'one_time'));
  END IF;
END $$;
