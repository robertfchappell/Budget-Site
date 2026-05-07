import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
import { applyAccountDelta } from "@/lib/budget/accounting";
import { asNumber, asString } from "@/lib/coerce";
import { todayIso } from "@/lib/dates";

export function shouldPostExpense(dateIso: string) {
  return dateIso <= todayIso();
}

export async function postDueExpenses(householdId: string) {
  await withTransaction(async (client) => {
    await postDueExpensesWithClient(client, householdId);
  });
}

export async function postDueExpensesWithClient(client: PoolClient, householdId: string) {
  const due = await client.query<{
    id: string;
    user_id: string;
    account_id: string;
    merchant: string;
    amount: number;
    expense_date: string;
  }>(
    `
      SELECT id, user_id, account_id, merchant, amount, expense_date::text
      FROM expenses
      WHERE household_id = $1
        AND account_id IS NOT NULL
        AND balance_posted_at IS NULL
        AND expense_date <= CURRENT_DATE
      ORDER BY expense_date ASC
      FOR UPDATE SKIP LOCKED
    `,
    [householdId]
  );

  for (const expense of due.rows) {
    await applyAccountDelta(client, {
      householdId,
      accountId: asString(expense.account_id),
      userId: asString(expense.user_id),
      amount: -asNumber(expense.amount),
      activityType: "expense",
      description: `Expense: ${asString(expense.merchant, "Expense")}`,
      activityDate: asString(expense.expense_date)
    });

    await client.query(
      "UPDATE expenses SET balance_posted_at = now() WHERE id = $1",
      [expense.id]
    );
  }
}
