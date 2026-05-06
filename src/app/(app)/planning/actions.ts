"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { getDashboardData } from "@/lib/budget/data";
import { currentMonthIso } from "@/lib/budget/data";
import { syncLinkedSavingsGoals } from "@/lib/budget/accounting";
import { revalidateFinancialPaths } from "@/lib/budget/revalidation";
import { savingsGoalSchema } from "@/lib/validators";

export async function createSavingsGoal(formData: FormData) {
  const user = await requireUser();
  const values = savingsGoalSchema.parse(Object.fromEntries(formData));

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO savings_goals (
          household_id, account_id, name, target_amount, current_amount, monthly_target, target_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (household_id, name)
        DO UPDATE SET
          account_id = EXCLUDED.account_id,
          target_amount = EXCLUDED.target_amount,
          current_amount = EXCLUDED.current_amount,
          monthly_target = EXCLUDED.monthly_target,
          target_date = EXCLUDED.target_date
      `,
      [
        user.householdId,
        values.accountId || null,
        values.name,
        values.targetAmount,
        values.currentAmount,
        values.monthlyTarget,
        values.targetDate || null
      ]
    );

    if (values.accountId) {
      await syncLinkedSavingsGoals(client, user.householdId, [values.accountId]);
    }
  });

  revalidateFinancialPaths();
}

export async function updateSavingsGoal(formData: FormData) {
  const user = await requireUser();
  const goalId = String(formData.get("goalId") ?? "");
  const values = savingsGoalSchema.parse(Object.fromEntries(formData));

  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE savings_goals
        SET account_id = $3,
            name = $4,
            target_amount = $5,
            current_amount = $6,
            monthly_target = $7,
            target_date = $8
        WHERE id = $1 AND household_id = $2
      `,
      [
        goalId,
        user.householdId,
        values.accountId || null,
        values.name,
        values.targetAmount,
        values.currentAmount,
        values.monthlyTarget,
        values.targetDate || null
      ]
    );

    if (values.accountId) {
      await syncLinkedSavingsGoals(client, user.householdId, [values.accountId]);
    }
  });

  revalidateFinancialPaths();
}

export async function deleteSavingsGoal(formData: FormData) {
  const user = await requireUser();
  const goalId = String(formData.get("goalId") ?? "");

  await query(
    "DELETE FROM savings_goals WHERE id = $1 AND household_id = $2",
    [goalId, user.householdId]
  );

  revalidateFinancialPaths();
}

export async function saveMonthlySnapshot() {
  const user = await requireUser();
  const dashboard = await getDashboardData(user.householdId);

  await query(
    `
      INSERT INTO monthly_snapshots (
        household_id, month, checking_balance, income_total, bill_total,
        expense_total, projected_end_balance, safe_to_spend, savings_total,
        rollover_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (household_id, month)
      DO UPDATE SET
        checking_balance = EXCLUDED.checking_balance,
        income_total = EXCLUDED.income_total,
        bill_total = EXCLUDED.bill_total,
        expense_total = EXCLUDED.expense_total,
        projected_end_balance = EXCLUDED.projected_end_balance,
        safe_to_spend = EXCLUDED.safe_to_spend,
        savings_total = EXCLUDED.savings_total,
        rollover_amount = EXCLUDED.rollover_amount,
        created_at = now()
    `,
    [
      user.householdId,
      currentMonthIso(),
      dashboard.checkingBalance,
      dashboard.monthlyIncome,
      dashboard.monthlyBills,
      dashboard.monthlyExpenses,
      dashboard.projection.projectedEndOfMonthBalance,
      dashboard.projection.remainingSafeToSpend,
      dashboard.projection.projectedSavingsBalance,
      dashboard.projection.monthlyRollover
    ]
  );

  revalidatePath("/planning");
}
