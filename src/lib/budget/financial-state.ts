import { query } from "@/lib/db";
import { monthBounds } from "@/lib/dates";
import { calculateProjection } from "@/lib/budget/projections";
import { buildMonthlyIncomeForecast, type IncomeForecastRow } from "@/lib/budget/income-forecast";
import { incomeTypeLabel } from "@/lib/budget/income-types";
import { postDueIncomeDeposits } from "@/lib/budget/income-posting";
import { ensureBillInstancesForRange } from "@/lib/budget/recurrence";
import { asBoolean, asNumber, asNullableString, asString } from "@/lib/coerce";
import {
  firstTotal,
  normalizeAccountType
} from "@/lib/budget/normalizers";
import type { Account, IncomeTypeSummary } from "@/lib/types";

type SumRow = { total: number };
export type MonthlyFinancialRollup = {
  month: string;
  /**
   * Scheduled income is the full month view: posted deposits plus future/pending
   * income entries dated inside the month. It is used for forecast charts.
   */
  income: number;
  scheduledIncome: number;
  postedIncome: number;
  pendingIncome: number;
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
  /**
   * Posted ledger income only. Dashboard cards use this so future deposits do
   * not look like received cash.
   */
  monthlyIncome: number;
  scheduledMonthlyIncome: number;
  pendingMonthlyIncome: number;
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

export async function getFinancialState(
  householdId: string,
  options: { ensureBills?: boolean } = {}
): Promise<FinancialState> {
  if (options.ensureBills ?? true) {
    await ensureBillInstancesForRange(householdId);
  }

  const month = monthBounds(new Date());
  await postDueIncomeDeposits(householdId);

  const [
    accounts,
    monthlyRollups,
    unpaidBills,
    scheduledExpenses,
    savings,
    incomeForecast
  ] = await Promise.all([
    getFinancialAccounts(householdId, { postDueIncome: false }),
    getMonthlyFinancialRollups(householdId, month.startIso, month.endIso),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM bill_instances
        WHERE household_id = $1
          AND due_date >= $2
          AND due_date < $3
          AND status = 'unpaid'
      `,
      [householdId, month.startIso, month.endIso]
    ),
    query<SumRow>(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE household_id = $1
          AND account_id IS NULL
          AND expense_date >= CURRENT_DATE
          AND expense_date < $2
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
    queryIncomeForecast(householdId, month.startIso, month.endIso)
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
    monthlyIncome: currentRollup.scheduledIncome,
    postedMonthlyIncome: currentRollup.postedIncome,
    pendingIncome: currentRollup.pendingIncome,
    guaranteedIncome: currentRollup.guaranteedIncome,
    variableIncome: currentRollup.variableIncome,
    oneTimeIncome: currentRollup.oneTimeIncome,
    monthlyBills: currentRollup.bills,
    monthlyExpenses: currentRollup.expenses,
    unpaidBillsRemaining: firstTotal(unpaidBills.rows),
    scheduledExpensesRemaining: firstTotal(scheduledExpenses.rows),
    monthlySavingsTarget: firstTotal(savings.rows)
  });

  return {
    month,
    accounts,
    checkingBalance,
    savingsBalance,
    netCash,
    monthlyIncome: currentRollup.postedIncome,
    scheduledMonthlyIncome: currentRollup.scheduledIncome,
    pendingMonthlyIncome: currentRollup.pendingIncome,
    recurringIncome: currentRollup.recurringIncome,
    guaranteedIncome: currentRollup.guaranteedIncome,
    variableIncome: currentRollup.variableIncome,
    oneTimeIncome: currentRollup.oneTimeIncome,
    monthlyBills: currentRollup.bills,
    paidBills: currentRollup.paidBills,
    monthlyExpenses: currentRollup.expenses,
    unpaidBillsRemaining: firstTotal(unpaidBills.rows),
    monthlySavingsTarget: firstTotal(savings.rows),
    incomeByType: incomeForecast.byType,
    projection
  };
}

export async function getMonthlyFinancialRollups(
  householdId: string,
  startIso: string,
  endIso: string
): Promise<MonthlyFinancialRollup[]> {
  const [incomeForecast, result] = await Promise.all([
    queryIncomeForecast(householdId, startIso, endIso),
    query<{
    month: string;
    bills: number;
    paid_bills: number;
    unpaid_bills: number;
    expenses: number;
  }>(
    `
      WITH months AS (
        SELECT generate_series($2::date, ($3::date - INTERVAL '1 day')::date, INTERVAL '1 month')::date AS month
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
             COALESCE(bills.total, 0) AS bills,
             COALESCE(bills.paid, 0) AS paid_bills,
             COALESCE(bills.unpaid, 0) AS unpaid_bills,
             COALESCE(expenses.total, 0) AS expenses
      FROM months
      LEFT JOIN bills ON bills.month = months.month
      LEFT JOIN expenses ON expenses.month = months.month
      ORDER BY months.month
    `,
    [householdId, startIso, endIso]
  )
  ]);

  return result.rows.map((row) => {
    const income = incomeForecast.byMonth.get(row.month) ?? emptyIncomeTotals();

    return {
      month: row.month,
      income: income.income,
      scheduledIncome: income.scheduledIncome,
      postedIncome: income.postedIncome,
      pendingIncome: income.pendingIncome,
      recurringIncome: income.recurringIncome,
      guaranteedIncome: income.guaranteedIncome,
      variableIncome: income.variableIncome,
      oneTimeIncome: income.oneTimeIncome,
      bills: asNumber(row.bills),
      paidBills: asNumber(row.paid_bills),
      unpaidBills: asNumber(row.unpaid_bills),
      expenses: asNumber(row.expenses)
    };
  });
}

function emptyMonthlyRollup(month: string): MonthlyFinancialRollup {
  return {
    month,
    ...emptyIncomeTotals(),
    bills: 0,
    paidBills: 0,
    unpaidBills: 0,
    expenses: 0
  };
}

function emptyIncomeTotals() {
  return {
    income: 0,
    scheduledIncome: 0,
    postedIncome: 0,
    pendingIncome: 0,
    recurringIncome: 0,
    guaranteedIncome: 0,
    variableIncome: 0,
    oneTimeIncome: 0
  };
}

async function queryIncomeForecast(householdId: string, startIso: string, endIso: string) {
  const result = await query<IncomeForecastRow>(
    `
      SELECT income_entries.id,
             income_entries.employer,
             income_entries.income_type,
             income_entries.income_frequency,
             income_entries.guaranteed,
             income_entries.paycheck_date::text,
             income_entries.deposit_amount,
             income_entries.balance_posted_at::text,
             income_entries.account_id::text,
             COALESCE(categories.color, '#94a3b8') AS color
      FROM income_entries
      LEFT JOIN categories ON categories.id = income_entries.category_id
      WHERE income_entries.household_id = $1
        AND income_entries.paycheck_date < $3
        AND (
          income_entries.income_frequency <> 'one_time'
          OR income_entries.paycheck_date >= $2
        )
      ORDER BY income_entries.paycheck_date ASC, income_entries.created_at ASC
    `,
    [householdId, startIso, endIso]
  );

  return buildMonthlyIncomeForecast(result.rows, startIso, endIso, incomeTypeLabel);
}

export async function getFinancialAccounts(
  householdId: string,
  options: { postDueIncome?: boolean } = {}
) {
  if (options.postDueIncome ?? true) {
    await postDueIncomeDeposits(householdId);
  }

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
