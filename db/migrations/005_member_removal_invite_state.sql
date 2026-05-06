ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_household_active
  ON users(household_id, deactivated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_household_invites_active_email
  ON household_invites(household_id, lower(invited_email), expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
