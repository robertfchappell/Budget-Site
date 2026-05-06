import Papa from "papaparse";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  billStatusDisplayLabel,
  categoryDisplayLabel,
  incomeFrequencyDisplayLabel,
  incomeTypeDisplayLabel,
  paymentMethodDisplayLabel
} from "@/lib/display-labels";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    kind: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser("api_export");
  const { kind } = await context.params;

  const rows = await exportRows(kind, user.householdId);
  const csv = Papa.unparse(rows);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${kind}.csv"`
    }
  });
}

async function exportRows(kind: string, householdId: string): Promise<Array<Record<string, unknown>>> {
  if (kind === "expenses") {
    const result = await query(
      `
        SELECT expenses.expense_date AS date, expenses.merchant, expenses.amount,
               COALESCE(categories.name, expenses.category_snapshot) AS category,
               expenses.payment_method, accounts.name AS account, users.name AS entered_by,
               expenses.notes
        FROM expenses
        JOIN users ON users.id = expenses.user_id
        LEFT JOIN categories ON categories.id = expenses.category_id
        LEFT JOIN accounts ON accounts.id = expenses.account_id
        WHERE expenses.household_id = $1
        ORDER BY expenses.expense_date DESC
      `,
      [householdId]
    );
    return result.rows.map((row) => ({
      ...row,
      category: categoryDisplayLabel(row.category),
      payment_method: paymentMethodDisplayLabel(row.payment_method)
    }));
  }

  if (kind === "income") {
    const result = await query(
      `
        SELECT income_entries.paycheck_date AS date, income_entries.employer,
               income_entries.income_type, income_entries.recurrence,
               income_entries.income_frequency, income_entries.guaranteed,
               income_entries.base_pay, income_entries.overtime_pay,
               income_entries.bonus_pay, income_entries.va_income,
               income_entries.taxes_withheld, income_entries.deposit_amount,
               accounts.name AS account, users.name AS entered_by, income_entries.notes
        FROM income_entries
        JOIN users ON users.id = income_entries.user_id
        LEFT JOIN accounts ON accounts.id = income_entries.account_id
        WHERE income_entries.household_id = $1
        ORDER BY income_entries.paycheck_date DESC
      `,
      [householdId]
    );
    return result.rows.map((row) => ({
      ...row,
      income_type: incomeTypeDisplayLabel(row.income_type),
      recurrence: incomeFrequencyDisplayLabel(row.recurrence),
      income_frequency: incomeFrequencyDisplayLabel(row.income_frequency)
    }));
  }

  if (kind === "bills") {
    const result = await query(
      `
        SELECT bill_instances.due_date, bill_instances.bill_name, bill_instances.amount,
               bill_instances.status, categories.name AS category, accounts.name AS account,
               bill_instances.notes
        FROM bill_instances
        LEFT JOIN categories ON categories.id = bill_instances.category_id
        LEFT JOIN accounts ON accounts.id = bill_instances.account_id
        WHERE bill_instances.household_id = $1
        ORDER BY bill_instances.due_date DESC
      `,
      [householdId]
    );
    return result.rows.map((row) => ({
      ...row,
      status: billStatusDisplayLabel(row.status),
      category: categoryDisplayLabel(row.category)
    }));
  }

  return [];
}
