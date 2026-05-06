ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS income_type TEXT,
  ADD COLUMN IF NOT EXISTS recurrence TEXT,
  ADD COLUMN IF NOT EXISTS guaranteed BOOLEAN,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE recurring_bills
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

INSERT INTO categories (household_id, name, kind, color, icon, is_system)
SELECT households.id, income_category.name, 'income', income_category.color, income_category.icon, true
FROM households
CROSS JOIN (
  VALUES
    ('Regular Paycheck', '#22c55e', 'briefcase'),
    ('Overtime', '#38bdf8', 'clock'),
    ('VA Disability', '#2dd4bf', 'shield'),
    ('Pell Grants', '#a78bfa', 'graduation-cap'),
    ('Student Loans', '#f97316', 'landmark'),
    ('VA Education Stipend', '#14b8a6', 'book-open'),
    ('Bonuses', '#fbbf24', 'sparkles'),
    ('Miscellaneous Income', '#94a3b8', 'circle-dollar-sign')
) AS income_category(name, color, icon)
ON CONFLICT (household_id, name, kind) DO NOTHING;

UPDATE income_entries
SET income_type = CASE
  WHEN COALESCE(va_income, 0) > 0 AND COALESCE(base_pay, 0) = 0 THEN 'va_disability'
  WHEN COALESCE(bonus_pay, 0) > 0 AND COALESCE(base_pay, 0) = 0 THEN 'bonus'
  WHEN COALESCE(overtime_pay, 0) > 0 AND COALESCE(base_pay, 0) = 0 THEN 'overtime'
  ELSE 'regular_paycheck'
END
WHERE income_type IS NULL;

UPDATE income_entries
SET recurrence = CASE
  WHEN income_type IN ('regular_paycheck', 'va_disability', 'va_education_stipend') THEN 'recurring'
  ELSE 'one_time'
END
WHERE recurrence IS NULL;

UPDATE income_entries
SET guaranteed = income_type IN ('regular_paycheck', 'va_disability', 'va_education_stipend')
WHERE guaranteed IS NULL;

UPDATE income_entries
SET category_id = categories.id
FROM categories
WHERE categories.household_id = income_entries.household_id
  AND categories.kind = 'income'
  AND categories.name = CASE income_entries.income_type
    WHEN 'regular_paycheck' THEN 'Regular Paycheck'
    WHEN 'overtime' THEN 'Overtime'
    WHEN 'va_disability' THEN 'VA Disability'
    WHEN 'pell_grant' THEN 'Pell Grants'
    WHEN 'student_loan' THEN 'Student Loans'
    WHEN 'va_education_stipend' THEN 'VA Education Stipend'
    WHEN 'bonus' THEN 'Bonuses'
    ELSE 'Miscellaneous Income'
  END
  AND income_entries.category_id IS NULL;

ALTER TABLE income_entries
  ALTER COLUMN income_type SET DEFAULT 'regular_paycheck',
  ALTER COLUMN income_type SET NOT NULL,
  ALTER COLUMN recurrence SET DEFAULT 'one_time',
  ALTER COLUMN recurrence SET NOT NULL,
  ALTER COLUMN guaranteed SET DEFAULT false,
  ALTER COLUMN guaranteed SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'income_entries_income_type_check'
  ) THEN
    ALTER TABLE income_entries
      ADD CONSTRAINT income_entries_income_type_check
      CHECK (income_type IN (
        'regular_paycheck',
        'overtime',
        'va_disability',
        'pell_grant',
        'student_loan',
        'va_education_stipend',
        'bonus',
        'misc'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'income_entries_recurrence_check'
  ) THEN
    ALTER TABLE income_entries
      ADD CONSTRAINT income_entries_recurrence_check
      CHECK (recurrence IN ('recurring', 'one_time'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_income_household_type ON income_entries(household_id, income_type, paycheck_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'income_entries_updated_at'
  ) THEN
    CREATE TRIGGER income_entries_updated_at
    BEFORE UPDATE ON income_entries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'expenses_updated_at'
  ) THEN
    CREATE TRIGGER expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
