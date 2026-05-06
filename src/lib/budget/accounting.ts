import type { PoolClient } from "pg";
import { asNumber } from "@/lib/coerce";

export type AccountActivityType =
  | "balance_adjustment"
  | "transfer_in"
  | "transfer_out"
  | "income_deposit"
  | "expense"
  | "bill_payment";

export async function syncLinkedSavingsGoals(
  client: PoolClient,
  householdId: string,
  accountIds: string[] = []
) {
  await client.query(
    `
      UPDATE savings_goals
      SET current_amount = accounts.current_balance
      FROM accounts
      WHERE savings_goals.account_id = accounts.id
        AND savings_goals.household_id = $1
        AND accounts.household_id = $1
        AND ($2::uuid[] IS NULL OR accounts.id = ANY($2::uuid[]))
    `,
    [householdId, accountIds.length ? accountIds : null]
  );
}

export async function applyAccountDelta(
  client: PoolClient,
  {
    householdId,
    accountId,
    userId,
    amount,
    activityType,
    description,
    activityDate,
    transferId = null
  }: {
    householdId: string;
    accountId: string;
    userId: string;
    amount: number;
    activityType: AccountActivityType;
    description: string;
    activityDate: string;
    transferId?: string | null;
  }
) {
  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  const updated = await client.query<{ current_balance: number }>(
    `
      UPDATE accounts
      SET current_balance = current_balance + $1
      WHERE id = $2 AND household_id = $3
      RETURNING current_balance
    `,
    [amount, accountId, householdId]
  );

  const balanceAfter = updated.rows[0]?.current_balance;

  if (balanceAfter == null) {
    throw new Error(`Account ${accountId} was not found for household ${householdId}.`);
  }

  await recordAccountActivity(client, {
    householdId,
    accountId,
    userId,
    transferId,
    activityType,
    amount,
    balanceAfter: asNumber(balanceAfter),
    description,
    activityDate
  });
  await syncLinkedSavingsGoals(client, householdId, [accountId]);

  return asNumber(balanceAfter);
}

export async function setAccountBalance(
  client: PoolClient,
  {
    householdId,
    accountId,
    userId,
    currentBalance,
    activityDate,
    description
  }: {
    householdId: string;
    accountId: string;
    userId: string;
    currentBalance: number;
    activityDate: string;
    description: string;
  }
) {
  const existing = await client.query<{ current_balance: number }>(
    `
      SELECT current_balance
      FROM accounts
      WHERE id = $1 AND household_id = $2
      FOR UPDATE
    `,
    [accountId, householdId]
  );
  const previousBalance = existing.rows[0]?.current_balance;

  if (previousBalance == null) {
    throw new Error(`Account ${accountId} was not found for household ${householdId}.`);
  }

  const delta = currentBalance - asNumber(previousBalance);

  await client.query(
    `
      UPDATE accounts
      SET current_balance = $1
      WHERE id = $2 AND household_id = $3
    `,
    [currentBalance, accountId, householdId]
  );

  if (delta !== 0) {
    await recordAccountActivity(client, {
      householdId,
      accountId,
      userId,
      transferId: null,
      activityType: "balance_adjustment",
      amount: delta,
      balanceAfter: currentBalance,
      description,
      activityDate
    });
  }

  await syncLinkedSavingsGoals(client, householdId, [accountId]);

  return currentBalance;
}

async function recordAccountActivity(
  client: PoolClient,
  {
    householdId,
    accountId,
    userId,
    transferId,
    activityType,
    amount,
    balanceAfter,
    description,
    activityDate
  }: {
    householdId: string;
    accountId: string;
    userId: string;
    transferId: string | null;
    activityType: AccountActivityType;
    amount: number;
    balanceAfter: number;
    description: string;
    activityDate: string;
  }
) {
  await client.query(
    `
      INSERT INTO account_activity (
        household_id, account_id, user_id, transfer_id, activity_type,
        amount, balance_after, description, activity_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      householdId,
      accountId,
      userId,
      transferId,
      activityType,
      amount,
      balanceAfter,
      description,
      activityDate
    ]
  );
}
