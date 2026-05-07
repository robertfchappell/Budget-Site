-- Adds balance_posted_at to expenses so future-dated expenses are not
-- immediately deducted from accounts.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS balance_posted_at TIMESTAMPTZ;

-- All existing account-linked expenses were deducted immediately under the
-- old code, so mark them as already posted.
UPDATE expenses
SET balance_posted_at = NOW()
WHERE account_id IS NOT NULL
  AND balance_posted_at IS NULL;
