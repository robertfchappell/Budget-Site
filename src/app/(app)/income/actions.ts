"use server";

import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { applyAccountDelta } from "@/lib/budget/accounting";
import { revalidateFinancialPaths } from "@/lib/budget/revalidation";
import {
  defaultGuaranteedForIncomeType,
  defaultFrequencyForIncomeType,
  incomeTypeLabel,
  normalizeIncomeFrequency,
  normalizeIncomeType
} from "@/lib/budget/income-types";
import { incomeSchema } from "@/lib/validators";
import type { IncomeType } from "@/lib/types";

export async function createIncomeEntry(formData: FormData) {
  const user = await requireUser();
  const values = normalizeIncomeForm(formData);

  await withTransaction(async (client) => {
    const categoryId =
      values.categoryId ||
      (await findIncomeCategoryId(client, user.householdId, incomeTypeLabel(values.incomeType)));

    await client.query(
      `
        INSERT INTO income_entries (
          household_id, user_id, account_id, category_id, employer, income_type,
          recurrence, income_frequency, guaranteed, paycheck_date, base_pay,
          overtime_pay, bonus_pay, va_income, taxes_withheld, deposit_amount, notes, term
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        user.householdId,
        user.id,
        values.accountId || null,
        categoryId,
        values.employer,
        values.incomeType,
        values.recurrence,
        values.incomeFrequency,
        values.guaranteed,
        values.paycheckDate,
        values.basePay,
        values.overtimePay,
        values.bonusPay,
        values.vaIncome,
        values.taxesWithheld,
        values.depositAmount,
        values.notes || null,
        values.term || null
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
  const values = normalizeIncomeForm(formData);

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
            income_frequency = $8,
            guaranteed = $9,
            paycheck_date = $10,
            base_pay = $11,
            overtime_pay = $12,
            bonus_pay = $13,
            va_income = $14,
            taxes_withheld = $15,
            deposit_amount = $16,
            notes = $17,
            term = $18
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
        values.incomeFrequency,
        values.guaranteed,
        values.paycheckDate,
        values.basePay,
        values.overtimePay,
        values.bonusPay,
        values.vaIncome,
        values.taxesWithheld,
        values.depositAmount,
        values.notes || null,
        values.term || null
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

function normalizeIncomeForm(formData: FormData) {
  const incomeType = normalizeIncomeType(formData.get("incomeType"));
  const incomeFrequency = resolveIncomeFrequency(formData, incomeType);
  const recurrence = incomeFrequency === "one_time" ? "one_time" : "recurring";
  const parsed = incomeSchema.parse({
    ...Object.fromEntries(formData),
    incomeType,
    incomeFrequency,
    recurrence,
    guaranteed: recurrence === "recurring" && defaultGuaranteedForIncomeType(incomeType)
  });
  const employer = displayNameForIncomeType(incomeType, parsed.employer, parsed.term);
  const guaranteed = parsed.recurrence === "recurring" && defaultGuaranteedForIncomeType(parsed.incomeType);
  const payroll = normalizePayrollFields(parsed.incomeType, {
    basePay: parsed.basePay,
    overtimePay: parsed.overtimePay,
    bonusPay: parsed.bonusPay,
    vaIncome: parsed.vaIncome,
    taxesWithheld: parsed.taxesWithheld,
    depositAmount: parsed.depositAmount
  });

  return {
    ...parsed,
    ...payroll,
    employer,
    guaranteed
  };
}

function resolveIncomeFrequency(formData: FormData, incomeType: IncomeType) {
  const frequency = normalizeIncomeFrequency(formData.get("incomeFrequency"));

  if (frequency !== "one_time") {
    return frequency;
  }

  const recurrenceValues = formData.getAll("recurrence").map(String);

  if (recurrenceValues.includes("recurring")) {
    return defaultFrequencyForIncomeType(incomeType) === "one_time"
      ? "monthly"
      : defaultFrequencyForIncomeType(incomeType);
  }

  if (recurrenceValues.includes("one_time")) {
    return "one_time";
  }

  return defaultFrequencyForIncomeType(incomeType);
}

function displayNameForIncomeType(incomeType: IncomeType, value: string | undefined, term: string | undefined) {
  const trimmed = value?.trim();

  if (trimmed) {
    return trimmed;
  }

  if (incomeType === "pell_grant") {
    return term ? `Pell Grant - ${term}` : "Pell Grant";
  }

  if (incomeType === "student_loan") {
    return term ? `Student Loan - ${term}` : "Student Loan";
  }

  return incomeTypeLabel(incomeType);
}

function normalizePayrollFields(
  incomeType: IncomeType,
  values: {
    basePay: number;
    overtimePay: number;
    bonusPay: number;
    vaIncome: number;
    taxesWithheld: number;
    depositAmount: number;
  }
) {
  if (incomeType === "regular_paycheck") {
    return values;
  }

  return {
    basePay: 0,
    overtimePay: incomeType === "overtime" ? values.depositAmount : 0,
    bonusPay: incomeType === "bonus" ? values.depositAmount : 0,
    vaIncome: incomeType === "va_disability" ? values.depositAmount : 0,
    taxesWithheld: 0,
    depositAmount: values.depositAmount
  };
}
