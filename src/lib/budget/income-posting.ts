import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
import { applyAccountDelta } from "@/lib/budget/accounting";
import { asNumber, asString } from "@/lib/coerce";
import { todayIso } from "@/lib/dates";

type IncomePostingRow = {
  id: string;
  household_id: string;
  user_id: string;
  account_id: string;
  employer: string;
  deposit_amount: number;
  paycheck_date: string;
};

export function shouldPostToBalance(dateIso: string) {
  return dateIso <= todayIso();
}

export async function postDueIncomeDeposits(householdId: string) {
  await withTransaction(async (client) => {
    await postDueIncomeDepositsWithClient(client, householdId);
  });
}

export async function postDueIncomeDepositsWithClient(client: PoolClient, householdId: string) {
  const due = await client.query<IncomePostingRow>(
    `
      SELECT id, household_id, user_id, account_id, employer, deposit_amount, paycheck_date::text
      FROM income_entries
      WHERE household_id = $1
        AND account_id IS NOT NULL
        AND balance_posted_at IS NULL
        AND paycheck_date <= CURRENT_DATE
      ORDER BY paycheck_date ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
    `,
    [householdId]
  );

  for (const entry of due.rows) {
    await applyAccountDelta(client, {
      householdId,
      accountId: asString(entry.account_id),
      userId: asString(entry.user_id),
      amount: asNumber(entry.deposit_amount),
      activityType: "income_deposit",
      description: `Income: ${asString(entry.employer, "Income")}`,
      activityDate: asString(entry.paycheck_date)
    });

    await client.query(
      `
        UPDATE income_entries
        SET balance_posted_at = now()
        WHERE id = $1 AND household_id = $2
      `,
      [entry.id, householdId]
    );
  }
}
