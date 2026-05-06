import { query } from "@/lib/db";
import { monthBounds } from "@/lib/dates";
import { calculateProjection } from "@/lib/budget/projections";
import { incomeTypeLabel, normalizeIncomeType } from "@/lib/budget/income-types";
import { ensureBillInstancesForRange } from "@/lib/budget/recurrence";
import { asBoolean, asNumber, asNullableString, asString } from "@/lib/coerce";
import {
  firstTotal,
  normalizeAccountType,
  normalizeColor
} from "@/lib/budget/normalizers";
import type { Account, IncomeType, IncomeTypeSummary } from "@/lib/types";

type SumRow = { total: number };

export type FinancialState = {
  month: ReturnType<typeof monthBounds>;
  accounts: Account[];
  checkingBalance: number;
  savingsBalance: number;
  netCash: number;
  monthlyIncome: number;
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
  monthlyBills: number;
  paidBills: number;
  monthlyExpenses: number;
  unpaidBillsRemaining: number;
  monthlySavingsTarget: number;
  incomeByType: IncomeTypeSummary[];
  projection: ReturnType<typeof calculateProjection>;
};

export async function getFinancialState(householdId: string): Promise<FinancialState> {
  await ensureBillInstancesForRange(householdId);

  const month = monthBounds(new Date());
  const [
    accounts,
    income,
    guaranteedIncome,
    variableIncome,
    oneTimeIncome,
    bills,
    paidBills,
    unpaidBills,
    expenses,
    savings,
    incomeByType
  ] = await Promise.all([
    getFinancialAccounts(householdId),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(deposit_amount), 0) AS total
        FROM income_entries
        WHERE household_id = $1 AND paycheck_date >= $2 AND paycheck_date < $3
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(deposit_amount), 0) AS total
        FROM income_entries
        WHERE household_id = $1
          AND paycheck_date >= $2
          AND paycheck_date < $3
          AND guaranteed = true
          AND recurrence = 'recurring'
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(deposit_amount), 0) AS total
        FROM income_entries
        WHERE household_id = $1
          AND paycheck_date >= $2
          AND paycheck_date < $3
          AND recurrence = 'recurring'
          AND guaranteed = false
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(deposit_amount), 0) AS total
        FROM income_entries
        WHERE household_id = $1
          AND paycheck_date >= $2
          AND paycheck_date < $3
          AND recurrence = 'one_time'
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM bill_instances
        WHERE household_id = $1 AND due_date >= $2 AND due_date < $3 AND status <> 'skipped'
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM bill_instances
        WHERE household_id = $1 AND due_date >= $2 AND due_date < $3 AND status = 'paid'
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM bill_instances
        WHERE household_id = $1
          AND due_date >= CURRENT_DATE
          AND due_date < $2
          AND status = 'unpaid'
      `,
      [householdId, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE household_id = $1 AND expense_date >= $2 AND expense_date < $3
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(monthly_target), 0) AS total
        FROM savings_goals
        WHERE household_id = $1
      `,
      [householdId]
    ),
    query<{
      income_type: IncomeType;
      color: string | null;
      total: number;
      recurring: number;
      one_time: number;
      guaranteed: number;
    }>(
      `
        SELECT income_entries.income_type,
               COALESCE(categories.color, '#94a3b8') AS color,
               SUM(income_entries.deposit_amount) AS total,
               SUM(CASE WHEN income_entries.recurrence = 'recurring' THEN income_entries.deposit_amount ELSE 0 END) AS recurring,
               SUM(CASE WHEN income_entries.recurrence = 'one_time' THEN income_entries.deposit_amount ELSE 0 END) AS one_time,
               SUM(CASE WHEN income_entries.guaranteed = true THEN income_entries.deposit_amount ELSE 0 END) AS guaranteed
        FROM income_entries
        LEFT JOIN categories ON categories.id = income_entries.category_id
        WHERE income_entries.household_id = $1
          AND income_entries.paycheck_date >= $2
          AND income_entries.paycheck_date < $3
        GROUP BY income_entries.income_type, COALESCE(categories.color, '#94a3b8')
        ORDER BY total DESC
      `,
      [householdId, month.startIso, month.endIso]
    )
  ]);

  const checkingBalance = accounts
    .filter((account) => account.type === "checking" && account.includeInSafeToSpend)
    .reduce((total, account) => total + account.currentBalance, 0);
  const savingsBalance = accounts
    .filter((account) => account.type === "savings")
    .reduce((total, account) => total + account.currentBalance, 0);
  const netCash = accounts
    .filter((account) => account.type === "checking" || account.type === "savings")
    .reduce((total, account) => total + account.currentBalance, 0);

  const projection = calculateProjection({
    checkingBalance,
    savingsBalance,
    netCash,
    monthlyIncome: firstTotal(income.rows),
    guaranteedIncome: firstTotal(guaranteedIncome.rows),
    variableIncome: firstTotal(variableIncome.rows),
    oneTimeIncome: firstTotal(oneTimeIncome.rows),
    monthlyBills: firstTotal(bills.rows),
    monthlyExpenses: firstTotal(expenses.rows),
    unpaidBillsRemaining: firstTotal(unpaidBills.rows),
    monthlySavingsTarget: firstTotal(savings.rows)
  });

  return {
    month,
    accounts,
    checkingBalance,
    savingsBalance,
    netCash,
    monthlyIncome: firstTotal(income.rows),
    guaranteedIncome: firstTotal(guaranteedIncome.rows),
    variableIncome: firstTotal(variableIncome.rows),
    oneTimeIncome: firstTotal(oneTimeIncome.rows),
    monthlyBills: firstTotal(bills.rows),
    paidBills: firstTotal(paidBills.rows),
    monthlyExpenses: firstTotal(expenses.rows),
    unpaidBillsRemaining: firstTotal(unpaidBills.rows),
    monthlySavingsTarget: firstTotal(savings.rows),
    incomeByType: incomeByType.rows.map((row) => {
      const incomeType = normalizeIncomeType(row.income_type);
      return {
        incomeType,
        label: incomeTypeLabel(incomeType),
        total: asNumber(row.total),
        recurring: asNumber(row.recurring),
        oneTime: asNumber(row.one_time),
        guaranteed: asNumber(row.guaranteed),
        color: normalizeColor(row.color)
      };
    }),
    projection
  };
}

export async function getFinancialAccounts(householdId: string) {
  const result = await query<{
    id: string;
    name: string;
    type: Account["type"];
    current_balance: number;
    institution: string | null;
    include_in_safe_to_spend: boolean;
  }>(
    `
      SELECT id, name, type, current_balance, institution, include_in_safe_to_spend
      FROM accounts
      WHERE household_id = $1
      ORDER BY type, name
    `,
    [householdId]
  );

  return result.rows.map((row) => ({
    id: asString(row.id),
    name: asString(row.name, "Account"),
    type: normalizeAccountType(row.type),
    currentBalance: asNumber(row.current_balance),
    institution: asNullableString(row.institution),
    includeInSafeToSpend: asBoolean(row.include_in_safe_to_spend, true)
  })) satisfies Account[];
}
