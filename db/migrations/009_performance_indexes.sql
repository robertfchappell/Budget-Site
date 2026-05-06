CREATE INDEX IF NOT EXISTS idx_income_due_unposted
  ON income_entries(household_id, paycheck_date, created_at)
  WHERE account_id IS NOT NULL AND balance_posted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bill_instances_household_status_due
  ON bill_instances(household_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_bill_instances_recurring_status
  ON bill_instances(recurring_bill_id, household_id, status);

CREATE INDEX IF NOT EXISTS idx_expenses_household_recent
  ON expenses(household_id, expense_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_income_household_recent
  ON income_entries(household_id, paycheck_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_household_type_name
  ON accounts(household_id, type, name);

CREATE INDEX IF NOT EXISTS idx_categories_household_kind_lower_name
  ON categories(household_id, kind, lower(name));
