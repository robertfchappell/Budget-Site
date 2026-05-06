export type UserRole = "husband" | "wife";
export type AccountType = "checking" | "savings" | "credit" | "cash";
export type CategoryKind = "income" | "bill" | "expense" | "savings";
export type BillFrequency = "monthly" | "weekly" | "biweekly" | "yearly" | "one_time";
export type BillStatus = "unpaid" | "paid" | "skipped";
export type PaymentMethod = "cash" | "debit" | "credit" | "ach" | "check" | "other";
export type IncomeType =
  | "regular_paycheck"
  | "overtime"
  | "va_disability"
  | "pell_grant"
  | "student_loan"
  | "va_education_stipend"
  | "bonus"
  | "misc";
export type IncomeRecurrence = "recurring" | "one_time";

export type UserContext = {
  id: string;
  householdId: string;
  householdName: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number;
  institution: string | null;
  includeInSafeToSpend: boolean;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
};

export type RecurringBill = {
  id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  startDate: string;
  dueDay: number | null;
  nextDueDate: string | null;
  categoryId: string | null;
  accountId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  autopay: boolean;
  active: boolean;
  isSubscription: boolean;
  notes: string | null;
};

export type BillInstance = {
  id: string;
  recurringBillId: string;
  billName: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  paidAt: string | null;
  notes: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: string | null;
  accountName: string | null;
};

export type IncomeEntry = {
  id: string;
  employer: string;
  incomeType: IncomeType;
  incomeTypeLabel: string;
  recurrence: IncomeRecurrence;
  guaranteed: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  paycheckDate: string;
  basePay: number;
  overtimePay: number;
  bonusPay: number;
  vaIncome: number;
  taxesWithheld: number;
  depositAmount: number;
  notes: string | null;
  term: string | null;
  userName: string;
  accountId: string | null;
  accountName: string | null;
};

export type Expense = {
  id: string;
  amount: number;
  merchant: string;
  notes: string | null;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  userName: string;
  accountId: string | null;
  accountName: string | null;
};

export type SavingsGoal = {
  id: string;
  accountId: string | null;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyTarget: number;
  targetDate: string | null;
};

export type AccountTransfer = {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  transferDate: string;
  notes: string | null;
  userName: string | null;
};

export type AccountActivity = {
  id: string;
  accountId: string;
  accountName: string;
  activityType: string;
  amount: number;
  balanceAfter: number;
  description: string;
  activityDate: string;
  userName: string | null;
};

export type HouseholdMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type HouseholdInvite = {
  id: string;
  invitedEmail: string;
  invitedRole: UserRole;
  invitedByName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type InviteActionStatus = "created" | "revoked" | "resent" | "member_removed";

export type ChartDatum = {
  name: string;
  value: number;
  color?: string;
};

export type IncomeTypeSummary = {
  incomeType: IncomeType;
  label: string;
  total: number;
  recurring: number;
  oneTime: number;
  guaranteed: number;
  color: string;
};

export type TrendDatum = {
  month: string;
  income: number;
  expenses: number;
  bills: number;
};
