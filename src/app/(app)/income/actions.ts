"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { applyAccountDelta } from "@/lib/budget/accounting";
import { defaultGuaranteedForIncomeType, defaultRecurrenceForIncomeType, incomeTypeLabel } from "@/lib/budget/income-types";
import { incomeSchema } from "@/lib/validators";

export async function createIncomeEntry(formData: FormData) {
  const user = await requireUser();
  const values = incomeSchema.parse({
    ...Object.fromEntries(formData),
    guaranteed: formData.has("guaranteed")
      ? true
      : defaultGuaranteedForIncomeType(formData.get("incomeType")),
    recurrence: String(formData.get("recurrence") || defaultRecurrenceForIncomeType(formData.get("incomeType")))
  });

  await withTransaction(async (client) => {
    const categoryId =
      values.categoryId ||
      (await findIncomeCategoryId(client, user.householdId, incomeTypeLabel(values.incomeType)));

    await client.query(
      `
        INSERT INTO income_entries (
          household_id, user_id, account_id, category_id, employer, income_type,
          recurrence, guaranteed, paycheck_date, base_pay,
          overtime_pay, bonus_pay, va_income, taxes_withheld, deposit_amount, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
      [
        user.householdId,
        user.id,
        values.accountId || null,
        categoryId,
        values.employer,
        values.incomeType,
        values.recurrence,
        values.guaranteed,
        values.paycheckDate,
        values.basePay,
        values.overtimePay,
        values.bonusPay,
        values.vaIncome,
        values.taxesWithheld,
        values.depositAmount,
        values.notes || null
      ]
    );

    if (values.accountId) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: values.accountId,
        userId: user.id,
        amount: values.depositAmount,
        activityType: "income_deposit",
        description: `Income: ${values.employer}`,
        activityDate: values.paycheckDate
      });
    }
  });

  revalidateFinancialPaths();
}

export async function updateIncomeEntry(formData: FormData) {
  const user = await requireUser();
  const incomeId = String(formData.get("incomeId") ?? "");
  const values = incomeSchema.parse({
    ...Object.fromEntries(formData),
    guaranteed: formData.has("guaranteed"),
    recurrence: String(formData.get("recurrence") || defaultRecurrenceForIncomeType(formData.get("incomeType")))
  });

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      deposit_amount: number;
      account_id: string | null;
      employer: string;
    }>(
      `
        SELECT id, deposit_amount, account_id, employer
        FROM income_entries
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [incomeId, user.householdId]
    );

    const current = existing.rows[0];

    if (!current) {
      return;
    }

    const categoryId =
      values.categoryId ||
      (await findIncomeCategoryId(client, user.householdId, incomeTypeLabel(values.incomeType)));

    await client.query(
      `
        UPDATE income_entries
        SET account_id = $3,
            category_id = $4,
            employer = $5,
            income_type = $6,
            recurrence = $7,
            guaranteed = $8,
            paycheck_date = $9,
            base_pay = $10,
            overtime_pay = $11,
            bonus_pay = $12,
            va_income = $13,
            taxes_withheld = $14,
            deposit_amount = $15,
            notes = $16
        WHERE id = $1 AND household_id = $2
      `,
      [
        incomeId,
        user.householdId,
        values.accountId || null,
        categoryId,
        values.employer,
        values.incomeType,
        values.recurrence,
        values.guaranteed,
        values.paycheckDate,
        values.basePay,
        values.overtimePay,
        values.bonusPay,
        values.vaIncome,
        values.taxesWithheld,
        values.depositAmount,
        values.notes || null
      ]
    );

    if (current.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: current.account_id,
        userId: user.id,
        amount: -current.deposit_amount,
        activityType: "income_deposit",
        description: `Income edit reversal: ${current.employer}`,
        activityDate: values.paycheckDate
      });
    }

    if (values.accountId) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: values.accountId,
        userId: user.id,
        amount: values.depositAmount,
        activityType: "income_deposit",
        description: `Income: ${values.employer}`,
        activityDate: values.paycheckDate
      });
    }
  });

  revalidateFinancialPaths();
}

export async function deleteIncomeEntry(formData: FormData) {
  const user = await requireUser();
  const incomeId = String(formData.get("incomeId") ?? "");

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      deposit_amount: number;
      account_id: string | null;
      employer: string;
    }>(
      `
        SELECT id, deposit_amount, account_id, employer
        FROM income_entries
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [incomeId, user.householdId]
    );

    const current = existing.rows[0];

    if (!current) {
      return;
    }

    await client.query(
      "DELETE FROM income_entries WHERE id = $1 AND household_id = $2",
      [incomeId, user.householdId]
    );

    if (current.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: current.account_id,
        userId: user.id,
        amount: -current.deposit_amount,
        activityType: "income_deposit",
        description: `Deleted income: ${current.employer}`,
        activityDate: new Date().toISOString().slice(0, 10)
      });
    }
  });

  revalidateFinancialPaths();
}

async function findIncomeCategoryId(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  householdId: string,
  label: string
) {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM categories WHERE household_id = $1 AND kind = 'income' AND lower(name) = lower($2) LIMIT 1",
    [householdId, label]
  );

  return result.rows[0]?.id ?? null;
}

function revalidateFinancialPaths() {
  revalidatePath("/income");
  revalidatePath("/dashboard");
  revalidatePath("/planning");
  revalidatePath("/settings");
}
