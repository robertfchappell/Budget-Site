ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS balance_posted_at TIMESTAMPTZ;

WITH future_income AS (
  SELECT household_id, account_id, SUM(deposit_amount) AS total
  FROM income_entries
  WHERE account_id IS NOT NULL
    AND balance_posted_at IS NULL
    AND paycheck_date > CURRENT_DATE
  GROUP BY household_id, account_id
),
corrected_accounts AS (
  UPDATE accounts
  SET current_balance = accounts.current_balance - future_income.total
  FROM future_income
  WHERE accounts.id = future_income.account_id
    AND accounts.household_id = future_income.household_id
  RETURNING accounts.household_id, accounts.id AS account_id, accounts.current_balance, future_income.total
)
INSERT INTO account_activity (
  household_id, account_id, user_id, transfer_id, activity_type,
  amount, balance_after, description, activity_date
)
SELECT household_id, account_id, NULL, NULL, 'income_deposit',
       -total, current_balance, 'Future-dated income held until pay date', CURRENT_DATE
FROM corrected_accounts
WHERE total <> 0;

UPDATE income_entries
SET balance_posted_at = COALESCE(updated_at, created_at, now())
WHERE account_id IS NOT NULL
  AND balance_posted_at IS NULL
  AND paycheck_date <= CURRENT_DATE;

UPDATE savings_goals
SET current_amount = accounts.current_balance
FROM accounts
WHERE savings_goals.account_id = accounts.id
  AND savings_goals.household_id = accounts.household_id;
