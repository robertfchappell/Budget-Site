import { query } from "@/lib/db";
import { isoDate, monthBounds, safeFormatDate, safeIsoDate, sixMonthWindow, upcomingBounds } from "@/lib/dates";
import { ensureBillInstancesForRange } from "@/lib/budget/recurrence";
import {
  incomeTypeLabel,
  normalizeIncomeFrequency,
  normalizeIncomeRecurrence,
  normalizeIncomeType
} from "@/lib/budget/income-types";
import { incomeStatus } from "@/lib/budget/income-status";
import { getFinancialAccounts, getFinancialState, getMonthlyFinancialRollups } from "@/lib/budget/financial-state";
import { postDueIncomeDeposits } from "@/lib/budget/income-posting";
import {
  normalizeAccountType,
  normalizeBillFrequency,
  normalizeBillStatus,
  normalizeCategoryKind,
  normalizeColor,
  normalizeDueDay,
  normalizePaymentMethod
} from "@/lib/budget/normalizers";
import { asBoolean, asNumber, asNullableString, asString } from "@/lib/coerce";
import {
  activityTypeDisplayLabel,
  categoryDisplayLabel,
  nullableDisplayLabel
} from "@/lib/display-labels";
import type {
  BillInstance,
  Category,
  ChartDatum,
  Expense,
  IncomeEntry,
  IncomeTypeSummary,
  IncomeType,
  RecurringBill,
  SavingsGoal,
  TrendDatum,
  AccountActivity,
  AccountTransfer,
  HouseholdInvite,
  HouseholdMember,
  UserRole
} from "@/lib/types";

function currentMonth() {
  return monthBounds(new Date());
}

export async function getCategories(householdId: string, kind?: string) {
  const result = await query<{
    id: string;
    name: string;
    kind: Category["kind"];
    color: string;
    icon: string;
  }>(
    `
      SELECT id, name, kind, color, icon
      FROM categories
      WHERE household_id = $1 AND ($2::text IS NULL OR kind = $2)
      ORDER BY kind, name
    `,
    [householdId, kind ?? null]
  );

  return result.rows.map((row) => ({
    id: asString(row.id),
    name: categoryDisplayLabel(row.name),
    kind: normalizeCategoryKind(row.kind),
    color: normalizeColor(row.color),
    icon: asString(row.icon, "circle")
  }));
}

export async function getAccounts(householdId: string) {
  return getFinancialAccounts(householdId);
}

export async function getDashboardData(householdId: string) {
  await ensureBillInstancesForRange(householdId);
  const financial = await getFinancialState(householdId, { ensureBills: false });
  const month = financial.month;
  const upcoming = upcomingBounds(14);
  const trendWindow = sixMonthWindow();

  const [
    upcomingBills,
    upcomingExpenses,
    upcomingDeposits,
    spendingByCategory,
    trend,
    savingsGoals,
    recentActivity
  ] = await Promise.all([
    queryBillInstances(
      `
        WHERE bill_instances.household_id = $1
          AND bill_instances.due_date >= $2
          AND bill_instances.due_date <= $3
          AND bill_instances.status = 'unpaid'
        ORDER BY bill_instances.due_date ASC, bill_instances.bill_name ASC
        LIMIT 8
      `,
      [householdId, upcoming.startIso, upcoming.endIso]
    ),
    query<{
      id: string;
      merchant: string;
      amount: number;
      expense_date: string;
      category_name: string | null;
    }>(
      `
        SELECT expenses.id, expenses.merchant, expenses.amount, expenses.expense_date::text,
               COALESCE(categories.name, expenses.category_snapshot, 'Uncategorized') AS category_name
        FROM expenses
        LEFT JOIN categories ON categories.id = expenses.category_id
        WHERE expenses.household_id = $1
          AND expenses.balance_posted_at IS NULL
          AND expenses.expense_date >= $2
          AND expenses.expense_date <= $3
        ORDER BY expenses.expense_date ASC, expenses.amount DESC
        LIMIT 8
      `,
      [householdId, upcoming.startIso, upcoming.endIso]
    ),
    query<{
      id: string;
      employer: string;
      income_type: IncomeType;
      recurrence: string;
      paycheck_date: string;
      deposit_amount: number;
      account_name: string | null;
    }>(
      `
        SELECT income_entries.id, income_entries.employer, income_entries.income_type,
               income_entries.recurrence, income_entries.paycheck_date,
               income_entries.deposit_amount, accounts.name AS account_name
        FROM income_entries
        LEFT JOIN accounts ON accounts.id = income_entries.account_id
        WHERE income_entries.household_id = $1
          AND income_entries.paycheck_date >= $2
          AND income_entries.paycheck_date <= $3
          AND income_entries.balance_posted_at IS NULL
        ORDER BY income_entries.paycheck_date ASC, income_entries.deposit_amount DESC
        LIMIT 6
      `,
      [householdId, upcoming.startIso, upcoming.endIso]
    ),
    query<{
      name: string;
      color: string | null;
      total: number;
    }>(
      `
        SELECT COALESCE(categories.name, expenses.category_snapshot, 'Uncategorized') AS name,
               COALESCE(categories.color, '#94a3b8') AS color,
               SUM(expenses.amount) AS total
        FROM expenses
        LEFT JOIN categories ON categories.id = expenses.category_id
        WHERE expenses.household_id = $1 AND expenses.expense_date >= $2 AND expenses.expense_date < $3
        GROUP BY COALESCE(categories.name, expenses.category_snapshot, 'Uncategorized'), COALESCE(categories.color, '#94a3b8')
        ORDER BY total DESC
      `,
      [householdId, month.startIso, month.endIso]
    ),
    getMonthlyFinancialRollups(householdId, trendWindow.startIso, trendWindow.endIso),
    querySavingsGoals(householdId),
    query<{
      id: string;
      account_id: string;
      account_name: string;
      activity_type: string;
      amount: number;
      balance_after: number;
      description: string;
      activity_date: string;
      user_name: string | null;
    }>(
      `
        SELECT account_activity.id, account_activity.account_id, accounts.name AS account_name,
               account_activity.activity_type, account_activity.amount,
               account_activity.balance_after, account_activity.description,
               account_activity.activity_date, users.name AS user_name
        FROM account_activity
        JOIN accounts ON accounts.id = account_activity.account_id
        LEFT JOIN users ON users.id = account_activity.user_id
        WHERE account_activity.household_id = $1
        ORDER BY account_activity.activity_date DESC, account_activity.created_at DESC
        LIMIT 8
      `,
      [householdId]
    )
  ]);

  return {
    month,
    accounts: financial.accounts,
    checkingBalance: financial.checkingBalance,
    savingsBalance: financial.savingsBalance,
    netCash: financial.netCash,
    monthlyIncome: financial.monthlyIncome,
    scheduledMonthlyIncome: financial.scheduledMonthlyIncome,
    pendingMonthlyIncome: financial.pendingMonthlyIncome,
    recurringIncome: financial.recurringIncome,
    guaranteedIncome: financial.guaranteedIncome,
    variableIncome: financial.variableIncome,
    oneTimeIncome: financial.oneTimeIncome,
    monthlyBills: financial.monthlyBills,
    paidBills: financial.paidBills,
    monthlyExpenses: financial.monthlyExpenses,
    unpaidBillsRemaining: financial.unpaidBillsRemaining,
    monthlySavingsTarget: financial.monthlySavingsTarget,
    upcomingBills,
    upcomingExpenses: upcomingExpenses.rows.map((row) => ({
      id: asString(row.id),
      merchant: asString(row.merchant, "Expense"),
      amount: asNumber(row.amount),
      expenseDate: safeIsoDate(row.expense_date),
      categoryName: asNullableString(row.category_name)
    })),
    upcomingDeposits: upcomingDeposits.rows.map((row) => ({
      id: asString(row.id),
      employer: asString(row.employer, "Income"),
      incomeType: normalizeIncomeType(row.income_type),
      incomeTypeLabel: incomeTypeLabel(row.income_type),
      recurrence: normalizeIncomeRecurrence(row.recurrence),
      paycheckDate: safeIsoDate(row.paycheck_date),
      depositAmount: asNumber(row.deposit_amount),
      accountName: asNullableString(row.account_name)
    })),
    spendingByCategory: spendingByCategory.rows.map((row) => ({
      name: categoryDisplayLabel(row.name),
      value: asNumber(row.total),
      color: normalizeColor(row.color)
    })) satisfies ChartDatum[],
    savingsGoals,
    recentActivity: recentActivity.rows.map((row) => ({
      id: asString(row.id),
      accountId: asString(row.account_id),
      accountName: asString(row.account_name, "Account"),
      activityType: activityTypeDisplayLabel(row.activity_type),
      amount: asNumber(row.amount),
      balanceAfter: asNumber(row.balance_after),
      description: asString(row.description, "Account activity"),
      activityDate: safeIsoDate(row.activity_date),
      userName: asNullableString(row.user_name)
    })) satisfies AccountActivity[],
    incomeByType: financial.incomeByType,
    trend: trend.map((row) => ({
      month: safeFormatDate(row.month, "MMM", "N/A"),
      income: row.scheduledIncome,
      expenses: row.expenses,
      bills: row.bills
    })) satisfies TrendDatum[],
    projection: financial.projection
  };
}

export async function getBillsPageData(householdId: string) {
  await postDueIncomeDeposits(householdId);
  await ensureBillInstancesForRange(householdId);
  const month = currentMonth();

  const [recurring, instances, categories, accounts] = await Promise.all([
    query<{
      id: string;
      name: string;
      amount: number;
      frequency: RecurringBill["frequency"];
      start_date: string;
      due_day: number | null;
      next_due_date: string | null;
      category_id: string | null;
      account_id: string | null;
      category_name: string | null;
      category_color: string | null;
      autopay: boolean;
      active: boolean;
      is_subscription: boolean;
      notes: string | null;
    }>(
      `
        SELECT recurring_bills.id, recurring_bills.name, recurring_bills.amount,
               recurring_bills.frequency, recurring_bills.start_date, recurring_bills.due_day,
               recurring_bills.next_due_date, recurring_bills.category_id, recurring_bills.account_id,
               categories.name AS category_name,
               categories.color AS category_color, recurring_bills.autopay,
               recurring_bills.active, recurring_bills.is_subscription, recurring_bills.notes
        FROM recurring_bills
        LEFT JOIN categories ON categories.id = recurring_bills.category_id
        WHERE recurring_bills.household_id = $1
        ORDER BY recurring_bills.active DESC, recurring_bills.due_day NULLS LAST, recurring_bills.name
      `,
      [householdId]
    ),
    queryBillInstances(
      `
        WHERE bill_instances.household_id = $1
          AND bill_instances.due_date >= $2
          AND bill_instances.due_date < $3
        ORDER BY bill_instances.due_date ASC, bill_instances.bill_name ASC
      `,
      [householdId, month.startIso, month.endIso]
    ),
    getCategories(householdId, "bill"),
    getAccounts(householdId)
  ]);

  return {
    month,
    recurringBills: recurring.rows.map((row) => ({
      id: asString(row.id),
      name: asString(row.name, "Bill"),
      amount: asNumber(row.amount),
      frequency: normalizeBillFrequency(row.frequency),
      startDate: safeIsoDate(row.start_date),
      dueDay: normalizeDueDay(row.due_day),
      nextDueDate: safeIsoDate(row.next_due_date) || null,
      categoryId: asNullableString(row.category_id),
      accountId: asNullableString(row.account_id),
      categoryName: nullableDisplayLabel(row.category_name),
      categoryColor: row.category_color ? normalizeColor(row.category_color) : null,
      autopay: asBoolean(row.autopay),
      active: asBoolean(row.active, true),
      isSubscription: asBoolean(row.is_subscription),
      notes: asNullableString(row.notes)
    })) satisfies RecurringBill[],
    billInstances: instances,
    categories,
    accounts
  };
}

export async function getIncomePageData(householdId: string, incomeTypeFilter?: string) {
  const month = currentMonth();
  const normalizedFilter = incomeTypeFilter ? normalizeIncomeType(incomeTypeFilter) : null;

  const [entries, accounts, categories, totals, byType] = await Promise.all([
    query<{
      id: string;
      employer: string;
      income_type: IncomeType;
      recurrence: string;
      income_frequency: string;
      guaranteed: boolean;
      category_id: string | null;
      category_name: string | null;
      category_color: string | null;
      paycheck_date: string;
      base_pay: number;
      overtime_pay: number;
      bonus_pay: number;
      va_income: number;
      taxes_withheld: number;
      deposit_amount: number;
      notes: string | null;
      term: string | null;
      user_name: string;
      account_name: string | null;
      account_id: string | null;
      balance_posted_at: string | null;
    }>(
      `
        SELECT income_entries.id, income_entries.employer, income_entries.income_type,
               income_entries.recurrence, income_entries.income_frequency,
               income_entries.guaranteed, income_entries.category_id,
               categories.name AS category_name, categories.color AS category_color,
               income_entries.paycheck_date,
               income_entries.base_pay, income_entries.overtime_pay, income_entries.bonus_pay,
               income_entries.va_income, income_entries.taxes_withheld, income_entries.deposit_amount,
               income_entries.notes, income_entries.term, users.name AS user_name, accounts.name AS account_name,
               accounts.id AS account_id, income_entries.balance_posted_at
        FROM income_entries
        JOIN users ON users.id = income_entries.user_id
        LEFT JOIN accounts ON accounts.id = income_entries.account_id
        LEFT JOIN categories ON categories.id = income_entries.category_id
        WHERE income_entries.household_id = $1
          AND ($2::text IS NULL OR income_entries.income_type = $2)
        ORDER BY income_entries.paycheck_date DESC, income_entries.created_at DESC
        LIMIT 50
      `,
      [householdId, normalizedFilter]
    ),
    getAccounts(householdId),
    getCategories(householdId, "income"),
    query<{
      name: string;
      total: number;
    }>(
      `
        SELECT COALESCE(categories.name, income_entries.income_type) AS name,
               SUM(income_entries.deposit_amount) AS total
        FROM income_entries
        LEFT JOIN categories ON categories.id = income_entries.category_id
        WHERE income_entries.household_id = $1
          AND income_entries.paycheck_date >= $2
          AND income_entries.paycheck_date < $3
          AND ($4::text IS NULL OR income_entries.income_type = $4)
        GROUP BY COALESCE(categories.name, income_entries.income_type)
        ORDER BY total DESC
      `,
      [householdId, month.startIso, month.endIso, normalizedFilter]
    ),
    query<{
      income_type: IncomeType;
      color: string | null;
      total: number;
      recurring: number;
      one_time: number;
      guaranteed: number;
      posted: number;
      pending: number;
    }>(
      `
        SELECT income_entries.income_type,
               COALESCE(categories.color, '#94a3b8') AS color,
               SUM(income_entries.deposit_amount) AS total,
               SUM(CASE WHEN income_entries.income_frequency <> 'one_time' THEN income_entries.deposit_amount ELSE 0 END) AS recurring,
               SUM(CASE WHEN income_entries.income_frequency = 'one_time' THEN income_entries.deposit_amount ELSE 0 END) AS one_time,
               SUM(CASE WHEN income_entries.income_frequency <> 'one_time' AND income_entries.guaranteed = true THEN income_entries.deposit_amount ELSE 0 END) AS guaranteed,
               SUM(CASE WHEN income_entries.balance_posted_at IS NOT NULL THEN income_entries.deposit_amount ELSE 0 END) AS posted,
               SUM(CASE WHEN income_entries.balance_posted_at IS NULL THEN income_entries.deposit_amount ELSE 0 END) AS pending
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

  return {
    month,
    entries: entries.rows.map((row) => ({
      id: asString(row.id),
      employer: asString(row.employer, "Employer"),
      incomeType: normalizeIncomeType(row.income_type),
      incomeTypeLabel: incomeTypeLabel(row.income_type),
      recurrence: normalizeIncomeRecurrence(row.recurrence),
      incomeFrequency: normalizeIncomeFrequency(row.income_frequency),
      guaranteed: asBoolean(row.guaranteed),
      categoryId: asNullableString(row.category_id),
      categoryName: nullableDisplayLabel(row.category_name),
      categoryColor: row.category_color ? normalizeColor(row.category_color) : null,
      paycheckDate: safeIsoDate(row.paycheck_date),
      balancePostedAt: safeIsoDate(row.balance_posted_at) || null,
      status: incomeStatus(row.balance_posted_at, row.paycheck_date),
      basePay: asNumber(row.base_pay),
      overtimePay: asNumber(row.overtime_pay),
      bonusPay: asNumber(row.bonus_pay),
      vaIncome: asNumber(row.va_income),
      taxesWithheld: asNumber(row.taxes_withheld),
      depositAmount: asNumber(row.deposit_amount),
      notes: asNullableString(row.notes),
      term: asNullableString(row.term),
      userName: asString(row.user_name, "Household"),
      accountName: asNullableString(row.account_name),
      accountId: asNullableString(row.account_id)
    })) satisfies IncomeEntry[],
    accounts,
    categories,
    selectedIncomeType: normalizedFilter,
    totals: totals.rows.map((row) => ({
      name: categoryDisplayLabel(row.name ?? "Income"),
      value: asNumber(row.total)
    })) satisfies ChartDatum[],
    byType: byType.rows.map((row) => {
      const incomeType = normalizeIncomeType(row.income_type);
      return {
        incomeType,
        label: incomeTypeLabel(incomeType),
        total: asNumber(row.total),
        recurring: asNumber(row.recurring),
        oneTime: asNumber(row.one_time),
        guaranteed: asNumber(row.guaranteed),
        posted: asNumber(row.posted),
        pending: asNumber(row.pending),
        color: normalizeColor(row.color)
      };
    }) satisfies IncomeTypeSummary[]
  };
}

export async function getExpensesPageData(householdId: string) {
  const month = currentMonth();
  const trendWindow = sixMonthWindow();

  const [expenses, categories, accounts, byCategory, trend] = await Promise.all([
    queryExpenses(
      `
        WHERE expenses.household_id = $1
        ORDER BY expenses.expense_date DESC, expenses.created_at DESC
        LIMIT 75
      `,
      [householdId]
    ),
    getCategories(householdId, "expense"),
    getAccounts(householdId),
    query<{
      name: string;
      color: string | null;
      total: number;
    }>(
      `
        SELECT COALESCE(categories.name, expenses.category_snapshot, 'Uncategorized') AS name,
               COALESCE(categories.color, '#94a3b8') AS color,
               SUM(expenses.amount) AS total
        FROM expenses
        LEFT JOIN categories ON categories.id = expenses.category_id
        WHERE expenses.household_id = $1 AND expenses.expense_date >= $2 AND expenses.expense_date < $3
        GROUP BY COALESCE(categories.name, expenses.category_snapshot, 'Uncategorized'), COALESCE(categories.color, '#94a3b8')
        ORDER BY total DESC
      `,
      [householdId, month.startIso, month.endIso]
    ),
    getMonthlyFinancialRollups(householdId, trendWindow.startIso, trendWindow.endIso)
  ]);

  return {
    month,
    expenses,
    categories,
    accounts,
    byCategory: byCategory.rows.map((row) => ({
      name: categoryDisplayLabel(row.name),
      value: asNumber(row.total),
      color: normalizeColor(row.color)
    })) satisfies ChartDatum[],
    trend: trend.map((row) => ({
      month: safeFormatDate(row.month, "MMM", "N/A"),
      income: row.scheduledIncome,
      expenses: row.expenses,
      bills: row.bills
    })) satisfies TrendDatum[]
  };
}

export async function getPlanningPageData(householdId: string) {
  const [dashboard, snapshots] = await Promise.all([
    getDashboardData(householdId),
    query<{
      month: string;
      checking_balance: number;
      income_total: number;
      bill_total: number;
      expense_total: number;
      projected_end_balance: number;
      safe_to_spend: number;
      savings_total: number;
      rollover_amount: number;
    }>(
      `
        SELECT month::text, checking_balance, income_total, bill_total, expense_total,
               projected_end_balance, safe_to_spend, savings_total, rollover_amount
        FROM monthly_snapshots
        WHERE household_id = $1
        ORDER BY month DESC
        LIMIT 12
      `,
      [householdId]
    )
  ]);

  return {
    dashboard,
    accounts: dashboard.accounts,
    goals: dashboard.savingsGoals,
    snapshots: snapshots.rows.map((row) => ({
      month: safeIsoDate(row.month),
      checking_balance: asNumber(row.checking_balance),
      income_total: asNumber(row.income_total),
      bill_total: asNumber(row.bill_total),
      expense_total: asNumber(row.expense_total),
      projected_end_balance: asNumber(row.projected_end_balance),
      safe_to_spend: asNumber(row.safe_to_spend),
      savings_total: asNumber(row.savings_total),
      rollover_amount: asNumber(row.rollover_amount)
    }))
  };
}

export async function getSettingsPageData(householdId: string) {
  const upcoming = upcomingBounds(14);
  await ensureBillInstancesForRange(householdId);

  const [financial, notifications, transfers, activity, members, invites] = await Promise.all([
    getFinancialState(householdId, { ensureBills: false }),
    query<{
      id: string;
      title: string;
      body: string;
      notify_on: string;
      read_at: string | null;
    }>(
      `
        SELECT id, title, body, notify_on, read_at
        FROM notifications
        WHERE household_id = $1 AND notify_on >= $2 AND notify_on <= $3
        ORDER BY notify_on ASC
      `,
      [householdId, upcoming.startIso, upcoming.endIso]
    ),
    query<{
      id: string;
      from_account_id: string;
      from_account_name: string;
      to_account_id: string;
      to_account_name: string;
      amount: number;
      transfer_date: string;
      notes: string | null;
      user_name: string | null;
    }>(
      `
        SELECT account_transfers.id, account_transfers.from_account_id,
               from_accounts.name AS from_account_name, account_transfers.to_account_id,
               to_accounts.name AS to_account_name, account_transfers.amount,
               account_transfers.transfer_date, account_transfers.notes, users.name AS user_name
        FROM account_transfers
        JOIN accounts AS from_accounts ON from_accounts.id = account_transfers.from_account_id
        JOIN accounts AS to_accounts ON to_accounts.id = account_transfers.to_account_id
        LEFT JOIN users ON users.id = account_transfers.user_id
        WHERE account_transfers.household_id = $1
        ORDER BY account_transfers.transfer_date DESC, account_transfers.created_at DESC
        LIMIT 25
      `,
      [householdId]
    ),
    query<{
      id: string;
      account_id: string;
      account_name: string;
      activity_type: string;
      amount: number;
      balance_after: number;
      description: string;
      activity_date: string;
      user_name: string | null;
    }>(
      `
        SELECT account_activity.id, account_activity.account_id, accounts.name AS account_name,
               account_activity.activity_type, account_activity.amount,
               account_activity.balance_after, account_activity.description,
               account_activity.activity_date, users.name AS user_name
        FROM account_activity
        JOIN accounts ON accounts.id = account_activity.account_id
        LEFT JOIN users ON users.id = account_activity.user_id
        WHERE account_activity.household_id = $1
        ORDER BY account_activity.activity_date DESC, account_activity.created_at DESC
        LIMIT 50
      `,
      [householdId]
    ),
    query<{
      id: string;
      name: string;
      email: string;
      role: UserRole;
      created_at: string;
    }>(
      `
        SELECT id, name, email, role, created_at
        FROM users
        WHERE household_id = $1 AND deactivated_at IS NULL
        ORDER BY created_at ASC, name ASC
      `,
      [householdId]
    ),
    query<{
      id: string;
      invited_email: string;
      invited_role: UserRole;
      invited_by_name: string | null;
      expires_at: string;
      accepted_at: string | null;
      revoked_at: string | null;
      created_at: string;
    }>(
      `
        SELECT household_invites.id, household_invites.invited_email,
               household_invites.invited_role, invited_by.name AS invited_by_name,
               household_invites.expires_at, household_invites.accepted_at,
               household_invites.revoked_at, household_invites.created_at
        FROM household_invites
        LEFT JOIN users AS invited_by ON invited_by.id = household_invites.invited_by_user_id
        WHERE household_invites.household_id = $1
          AND household_invites.accepted_at IS NULL
          AND household_invites.revoked_at IS NULL
          AND household_invites.expires_at >= now()
        ORDER BY household_invites.created_at DESC
        LIMIT 25
      `,
      [householdId]
    )
  ]);

  return {
    financial,
    accounts: financial.accounts,
    notifications: notifications.rows,
    transfers: transfers.rows.map((row) => ({
      id: asString(row.id),
      fromAccountId: asString(row.from_account_id),
      fromAccountName: asString(row.from_account_name, "From account"),
      toAccountId: asString(row.to_account_id),
      toAccountName: asString(row.to_account_name, "To account"),
      amount: asNumber(row.amount),
      transferDate: safeIsoDate(row.transfer_date),
      notes: asNullableString(row.notes),
      userName: asNullableString(row.user_name)
    })) satisfies AccountTransfer[],
    activity: activity.rows.map((row) => ({
      id: asString(row.id),
      accountId: asString(row.account_id),
      accountName: asString(row.account_name, "Account"),
      activityType: activityTypeDisplayLabel(row.activity_type),
      amount: asNumber(row.amount),
      balanceAfter: asNumber(row.balance_after),
      description: asString(row.description, "Account activity"),
      activityDate: safeIsoDate(row.activity_date),
      userName: asNullableString(row.user_name)
    })) satisfies AccountActivity[],
    members: members.rows.map((row) => ({
      id: asString(row.id),
      name: asString(row.name, "Household user"),
      email: asString(row.email),
      role: normalizeUserRole(row.role),
      createdAt: safeIsoDate(row.created_at)
    })) satisfies HouseholdMember[],
    invites: invites.rows.map((row) => ({
      id: asString(row.id),
      invitedEmail: asString(row.invited_email),
      invitedRole: normalizeUserRole(row.invited_role),
      invitedByName: asNullableString(row.invited_by_name),
      expiresAt: safeIsoDate(row.expires_at),
      acceptedAt: safeIsoDate(row.accepted_at) || null,
      revokedAt: safeIsoDate(row.revoked_at) || null,
      createdAt: safeIsoDate(row.created_at)
    })) satisfies HouseholdInvite[]
  };
}

function normalizeUserRole(value: unknown): UserRole {
  return value === "wife" ? "wife" : "husband";
}

async function querySavingsGoals(householdId: string) {
  const result = await query<{
    id: string;
    account_id: string | null;
    name: string;
    target_amount: number;
    current_amount: number;
    monthly_target: number;
    target_date: string | null;
    account_balance: number | null;
  }>(
    `
      SELECT savings_goals.id, savings_goals.account_id, savings_goals.name,
             savings_goals.target_amount, savings_goals.current_amount,
             savings_goals.monthly_target, savings_goals.target_date,
             accounts.current_balance AS account_balance
      FROM savings_goals
      LEFT JOIN accounts
        ON accounts.id = savings_goals.account_id
       AND accounts.household_id = savings_goals.household_id
      WHERE savings_goals.household_id = $1
      ORDER BY savings_goals.target_date NULLS LAST, savings_goals.name
    `,
    [householdId]
  );

  return result.rows.map((row) => ({
    id: asString(row.id),
    accountId: asNullableString(row.account_id),
    name: asString(row.name, "Savings goal"),
    targetAmount: asNumber(row.target_amount),
    currentAmount: row.account_balance == null ? asNumber(row.current_amount) : asNumber(row.account_balance),
    monthlyTarget: asNumber(row.monthly_target),
    targetDate: safeIsoDate(row.target_date) || null
  })) satisfies SavingsGoal[];
}

async function queryBillInstances(whereSql: string, params: unknown[]) {
  const result = await query<{
    id: string;
    recurring_bill_id: string;
    bill_name: string;
    amount: number;
    due_date: string;
    status: BillInstance["status"];
    paid_at: string | null;
    notes: string | null;
    category_id: string | null;
    category_name: string | null;
    category_color: string | null;
    account_id: string | null;
    account_name: string | null;
  }>(
    `
      SELECT bill_instances.id, bill_instances.recurring_bill_id, bill_instances.bill_name,
             bill_instances.amount, bill_instances.due_date, bill_instances.status,
             bill_instances.paid_at, bill_instances.notes, bill_instances.category_id,
             categories.name AS category_name,
             categories.color AS category_color, accounts.id AS account_id, accounts.name AS account_name
      FROM bill_instances
      LEFT JOIN categories ON categories.id = bill_instances.category_id
      LEFT JOIN accounts ON accounts.id = bill_instances.account_id
      ${whereSql}
    `,
    params
  );

  return result.rows.map((row) => ({
    id: asString(row.id),
    recurringBillId: asString(row.recurring_bill_id),
    billName: asString(row.bill_name, "Bill"),
    amount: asNumber(row.amount),
    dueDate: safeIsoDate(row.due_date),
    status: normalizeBillStatus(row.status),
    paidAt: safeIsoDate(row.paid_at) || null,
    notes: asNullableString(row.notes),
    categoryId: asNullableString(row.category_id),
    categoryName: nullableDisplayLabel(row.category_name),
    categoryColor: row.category_color ? normalizeColor(row.category_color) : null,
    accountId: asNullableString(row.account_id),
    accountName: asNullableString(row.account_name)
  })) satisfies BillInstance[];
}

async function queryExpenses(whereSql: string, params: unknown[]) {
  const result = await query<{
    id: string;
    amount: number;
    merchant: string;
    notes: string | null;
    expense_date: string;
    payment_method: Expense["paymentMethod"];
    category_name: string | null;
    category_id: string | null;
    category_color: string | null;
    user_name: string;
    account_id: string | null;
    account_name: string | null;
  }>(
    `
      SELECT expenses.id, expenses.amount, expenses.merchant, expenses.notes,
             expenses.expense_date, expenses.payment_method,
             categories.id AS category_id,
             COALESCE(categories.name, expenses.category_snapshot) AS category_name,
             categories.color AS category_color, users.name AS user_name,
             accounts.id AS account_id, accounts.name AS account_name
      FROM expenses
      JOIN users ON users.id = expenses.user_id
      LEFT JOIN categories ON categories.id = expenses.category_id
      LEFT JOIN accounts ON accounts.id = expenses.account_id
      ${whereSql}
    `,
    params
  );

  return result.rows.map((row) => ({
    id: asString(row.id),
    amount: asNumber(row.amount),
    merchant: asString(row.merchant, "Merchant"),
    notes: asNullableString(row.notes),
    expenseDate: safeIsoDate(row.expense_date),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    categoryId: asNullableString(row.category_id),
    categoryName: nullableDisplayLabel(row.category_name),
    categoryColor: row.category_color ? normalizeColor(row.category_color) : null,
    userName: asString(row.user_name, "Household"),
    accountId: asNullableString(row.account_id),
    accountName: asNullableString(row.account_name)
  })) satisfies Expense[];
}

export function currentMonthIso() {
  return isoDate(monthBounds().start);
}
