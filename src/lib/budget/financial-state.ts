import { query } from "@/lib/db";
import { monthBounds } from "@/lib/dates";
import { calculateProjection } from "@/lib/budget/projections";
import { incomeTypeLabel, normalizeIncomeType } from "@/lib/budget/income-types";
import { postDueIncomeDeposits } from "@/lib/budget/income-posting";
import { ensureBillInstancesForRange } from "@/lib/budget/recurrence";
import { asBoolean, asNumber, asNullableString, asString } from "@/lib/coerce";
import {
  firstTotal,
  normalizeAccountType,
  normalizeColor
} from "@/lib/budget/normalizers";
import type { Account, IncomeType, IncomeTypeSummary } from "@/lib/types";

type SumRow = { total: number };
export type MonthlyFinancialRollup = {
  month: string;
  income: number;
  recurringIncome: number;
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
  bills: number;
  paidBills: number;
  unpaidBills: number;
  expenses: number;
};

export type FinancialState = {
  month: ReturnType<typeof monthBounds>;
  accounts: Account[];
  checkingBalance: number;
  savingsBalance: number;
  netCash: number;
  monthlyIncome: number;
  recurringIncome: number;
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
    monthlyRollups,
    unpaidBills,
    savings,
    incomeByType
  ] = await Promise.all([
    getFinancialAccounts(householdId),
    getMonthlyFinancialRollups(householdId, month.startIso, month.endIso),
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
               SUM(CASE WHEN income_entries.income_frequency <> 'one_time' THEN income_entries.deposit_amount ELSE 0 END) AS recurring,
               SUM(CASE WHEN income_entries.income_frequency = 'one_time' THEN income_entries.deposit_amount ELSE 0 END) AS one_time,
               SUM(CASE WHEN income_entries.income_frequency <> 'one_time' AND income_entries.guaranteed = true THEN income_entries.deposit_amount ELSE 0 END) AS guaranteed
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
  const currentRollup = monthlyRollups[0] ?? emptyMonthlyRollup(month.startIso);

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
    monthlyIncome: currentRollup.income,
    guaranteedIncome: currentRollup.guaranteedIncome,
    variableIncome: currentRollup.variableIncome,
    oneTimeIncome: currentRollup.oneTimeIncome,
    monthlyBills: currentRollup.bills,
    monthlyExpenses: currentRollup.expenses,
    unpaidBillsRemaining: firstTotal(unpaidBills.rows),
    monthlySavingsTarget: firstTotal(savings.rows)
  });

  return {
    month,
    accounts,
    checkingBalance,
    savingsBalance,
    netCash,
    monthlyIncome: currentRollup.income,
    recurringIncome: currentRollup.recurringIncome,
    guaranteedIncome: currentRollup.guaranteedIncome,
    variableIncome: currentRollup.variableIncome,
    oneTimeIncome: currentRollup.oneTimeIncome,
    monthlyBills: currentRollup.bills,
    paidBills: currentRollup.paidBills,
    monthlyExpenses: currentRollup.expenses,
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

export async function getMonthlyFinancialRollups(
  householdId: string,
  startIso: string,
  endIso: string
): Promise<MonthlyFinancialRollup[]> {
  const result = await query<{
    month: string;
    income: number;
    recurring_income: number;
    guaranteed_income: number;
    variable_income: number;
    one_time_income: number;
    bills: number;
    paid_bills: number;
    unpaid_bills: number;
    expenses: number;
  }>(
    `
      WITH months AS (
        SELECT generate_series($2::date, ($3::date - INTERVAL '1 day')::date, INTERVAL '1 month')::date AS month
      ),
      income AS (
        SELECT date_trunc('month', paycheck_date)::date AS month,
               SUM(deposit_amount) AS total,
               SUM(CASE WHEN income_frequency <> 'one_time' THEN deposit_amount ELSE 0 END) AS recurring,
               SUM(CASE WHEN income_frequency <> 'one_time' AND guaranteed = true THEN deposit_amount ELSE 0 END) AS guaranteed,
               SUM(CASE WHEN income_frequency <> 'one_time' AND guaranteed = false THEN deposit_amount ELSE 0 END) AS variable,
               SUM(CASE WHEN income_frequency = 'one_time' THEN deposit_amount ELSE 0 END) AS one_time
        FROM income_entries
        WHERE household_id = $1 AND paycheck_date >= $2 AND paycheck_date < $3
        GROUP BY 1
      ),
      bills AS (
        SELECT date_trunc('month', due_date)::date AS month,
               SUM(amount) FILTER (WHERE status <> 'skipped') AS total,
               SUM(amount) FILTER (WHERE status = 'paid') AS paid,
               SUM(amount) FILTER (WHERE status = 'unpaid') AS unpaid
        FROM bill_instances
        WHERE household_id = $1 AND due_date >= $2 AND due_date < $3
        GROUP BY 1
      ),
      expenses AS (
        SELECT date_trunc('month', expense_date)::date AS month, SUM(amount) AS total
        FROM expenses
        WHERE household_id = $1 AND expense_date >= $2 AND expense_date < $3
        GROUP BY 1
      )
      SELECT months.month::text,
             COALESCE(income.total, 0) AS income,
             COALESCE(income.recurring, 0) AS recurring_income,
             COALESCE(income.guaranteed, 0) AS guaranteed_income,
             COALESCE(income.variable, 0) AS variable_income,
             COALESCE(income.one_time, 0) AS one_time_income,
             COALESCE(bills.total, 0) AS bills,
             COALESCE(bills.paid, 0) AS paid_bills,
             COALESCE(bills.unpaid, 0) AS unpaid_bills,
             COALESCE(expenses.total, 0) AS expenses
      FROM months
      LEFT JOIN income ON income.month = months.month
      LEFT JOIN bills ON bills.month = months.month
      LEFT JOIN expenses ON expenses.month = months.month
      ORDER BY months.month
    `,
    [householdId, startIso, endIso]
  );

  return result.rows.map((row) => ({
    month: row.month,
    income: asNumber(row.income),
    recurringIncome: asNumber(row.recurring_income),
    guaranteedIncome: asNumber(row.guaranteed_income),
    variableIncome: asNumber(row.variable_income),
    oneTimeIncome: asNumber(row.one_time_income),
    bills: asNumber(row.bills),
    paidBills: asNumber(row.paid_bills),
    unpaidBills: asNumber(row.unpaid_bills),
    expenses: asNumber(row.expenses)
  }));
}

function emptyMonthlyRollup(month: string): MonthlyFinancialRollup {
  return {
    month,
    income: 0,
    recurringIncome: 0,
    guaranteedIncome: 0,
    variableIncome: 0,
    oneTimeIncome: 0,
    bills: 0,
    paidBills: 0,
    unpaidBills: 0,
    expenses: 0
  };
}

export async function getFinancialAccounts(householdId: string) {
  await postDueIncomeDeposits(householdId);

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
