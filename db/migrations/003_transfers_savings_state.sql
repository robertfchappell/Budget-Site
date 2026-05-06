ALTER TABLE savings_goals
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

UPDATE savings_goals
SET account_id = accounts.id,
    current_amount = accounts.current_balance
FROM accounts
WHERE savings_goals.household_id = accounts.household_id
  AND savings_goals.account_id IS NULL
  AND accounts.type = 'savings'
  AND lower(savings_goals.name) LIKE '%emergency%'
  AND lower(accounts.name) LIKE '%emergency%';

CREATE TABLE IF NOT EXISTS account_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);

CREATE TABLE IF NOT EXISTS account_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  transfer_id UUID REFERENCES account_transfers(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'balance_adjustment',
    'transfer_in',
    'transfer_out',
    'income_deposit',
    'expense',
    'bill_payment'
  )),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_transfers_household_date
  ON account_transfers(household_id, transfer_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_activity_household_date
  ON account_activity(household_id, activity_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_savings_goals_account
  ON savings_goals(account_id);
