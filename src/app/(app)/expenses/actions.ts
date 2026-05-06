"use server";

import Papa from "papaparse";
import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { applyAccountDelta } from "@/lib/budget/accounting";
import { revalidateFinancialPaths } from "@/lib/budget/revalidation";
import { expenseSchema } from "@/lib/validators";
import type { PaymentMethod } from "@/lib/types";

export async function createExpense(formData: FormData) {
  const user = await requireUser();
  const values = expenseSchema.parse(Object.fromEntries(formData));
  const categoryName = await findCategoryName(user.householdId, values.categoryId || null);

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO expenses (
          household_id, user_id, account_id, category_id, amount, category_snapshot,
          merchant, notes, expense_date, payment_method
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        user.householdId,
        user.id,
        values.accountId || null,
        values.categoryId || null,
        values.amount,
        categoryName,
        values.merchant,
        values.notes || null,
        values.expenseDate,
        values.paymentMethod
      ]
    );

    if (values.accountId) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: values.accountId,
        userId: user.id,
        amount: -values.amount,
        activityType: "expense",
        description: `Expense: ${values.merchant}`,
        activityDate: values.expenseDate
      });
    }
  });

  revalidateFinancialPaths();
}

export async function updateExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");
  const values = expenseSchema.parse(Object.fromEntries(formData));
  const categoryName = await findCategoryName(user.householdId, values.categoryId || null);

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      amount: number;
      account_id: string | null;
      merchant: string;
    }>(
      `
        SELECT id, amount, account_id, merchant
        FROM expenses
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [expenseId, user.householdId]
    );

    const current = existing.rows[0];

    if (!current) {
      return;
    }

    await client.query(
      `
        UPDATE expenses
        SET account_id = $3,
            category_id = $4,
            amount = $5,
            category_snapshot = $6,
            merchant = $7,
            notes = $8,
            expense_date = $9,
            payment_method = $10
        WHERE id = $1 AND household_id = $2
      `,
      [
        expenseId,
        user.householdId,
        values.accountId || null,
        values.categoryId || null,
        values.amount,
        categoryName,
        values.merchant,
        values.notes || null,
        values.expenseDate,
        values.paymentMethod
      ]
    );

    if (current.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: current.account_id,
        userId: user.id,
        amount: current.amount,
        activityType: "expense",
        description: `Expense edit reversal: ${current.merchant}`,
        activityDate: values.expenseDate
      });
    }

    if (values.accountId) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: values.accountId,
        userId: user.id,
        amount: -values.amount,
        activityType: "expense",
        description: `Expense: ${values.merchant}`,
        activityDate: values.expenseDate
      });
    }
  });

  revalidateFinancialPaths();
}

export async function deleteExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      amount: number;
      account_id: string | null;
      merchant: string;
    }>(
      `
        SELECT id, amount, account_id, merchant
        FROM expenses
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [expenseId, user.householdId]
    );

    const current = existing.rows[0];

    if (!current) {
      return;
    }

    await client.query(
      "DELETE FROM expenses WHERE id = $1 AND household_id = $2",
      [expenseId, user.householdId]
    );

    if (current.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: current.account_id,
        userId: user.id,
        amount: current.amount,
        activityType: "expense",
        description: `Deleted expense: ${current.merchant}`,
        activityDate: new Date().toISOString().slice(0, 10)
      });
    }
  });

  revalidateFinancialPaths();
}

export async function importExpensesCsv(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  const accountId = String(formData.get("accountId") ?? "");

  if (!(file instanceof File) || !file.size) {
    return;
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true
  });

  const rows = parsed.data.filter(Boolean).slice(0, 500);

  await withTransaction(async (client) => {
    for (const row of rows) {
      const amount = Number(row.amount ?? row.Amount ?? 0);
      const merchant = row.merchant ?? row.Merchant ?? row.description ?? row.Description;
      const expenseDate = row.date ?? row.Date ?? row.expense_date;
      const paymentMethod = normalizePaymentMethod(row.payment_method ?? row.PaymentMethod);
      const categoryName = row.category ?? row.Category ?? "Imported";

      if (!Number.isFinite(amount) || !merchant || !expenseDate) {
        continue;
      }

      const categoryId = await findOrCreateExpenseCategory(client, user.householdId, categoryName);

      await client.query(
        `
          INSERT INTO expenses (
            household_id, user_id, account_id, category_id, amount, category_snapshot,
            merchant, notes, expense_date, payment_method, external_source, imported_transaction_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'csv', $11)
        `,
        [
          user.householdId,
          user.id,
          accountId || null,
          categoryId,
          Math.abs(amount),
          categoryName,
          merchant,
          row.notes ?? row.Notes ?? null,
          expenseDate,
          paymentMethod,
          row.id ?? row.ID ?? null
        ]
      );

      if (accountId) {
        await applyAccountDelta(client, {
          householdId: user.householdId,
          accountId,
          userId: user.id,
          amount: -Math.abs(amount),
          activityType: "expense",
          description: `Imported expense: ${merchant}`,
          activityDate: expenseDate
        });
      }
    }
  });

  revalidateFinancialPaths();
}

async function findCategoryName(householdId: string, categoryId: string | null) {
  if (!categoryId) {
    return null;
  }

  const result = await query<{ name: string }>(
    "SELECT name FROM categories WHERE id = $1 AND household_id = $2",
    [categoryId, householdId]
  );

  return result.rows[0]?.name ?? null;
}

async function findOrCreateExpenseCategory(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  householdId: string,
  name: string
) {
  const normalized = name.trim() || "Imported";
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM categories WHERE household_id = $1 AND name = $2 AND kind = 'expense'",
    [householdId, normalized]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO categories (household_id, name, kind, color, icon)
      VALUES ($1, $2, 'expense', '#60a5fa', 'upload')
      RETURNING id
    `,
    [householdId, normalized]
  );

  return created.rows[0].id;
}

function normalizePaymentMethod(value: string | undefined): PaymentMethod {
  const normalized = value?.toLowerCase().trim();

  if (
    normalized === "cash" ||
    normalized === "debit" ||
    normalized === "credit" ||
    normalized === "ach" ||
    normalized === "check"
  ) {
    return normalized;
  }

  return "other";
}
