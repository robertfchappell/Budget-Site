import { asString } from "@/lib/coerce";
import type {
  AccountType,
  BillFrequency,
  BillStatus,
  CategoryKind,
  IncomeFrequency,
  IncomeRecurrence,
  IncomeType,
  PaymentMethod,
  UserRole
} from "@/lib/types";

const labelOverrides = new Map<string, string>([
  ["ach", "ACH"],
  ["api", "API"],
  ["csv", "CSV"],
  ["va", "VA"],
  ["regular_paycheck", "Regular Paycheck"],
  ["paycheck", "Regular Paycheck"],
  ["overtime", "Overtime"],
  ["va_disability", "VA Disability"],
  ["va_disability_income", "VA Disability"],
  ["pell_grant", "Pell Grant"],
  ["pell_grants", "Pell Grant"],
  ["student_loan", "Student Loan"],
  ["student_loans", "Student Loan"],
  ["va_education_stipend", "Dependent/Spouse VA Education Stipend"],
  ["dependent_spouse_va_education_stipend", "Dependent/Spouse VA Education Stipend"],
  ["dependent_spouse_va_stipend", "Dependent/Spouse VA Education Stipend"],
  ["bonus", "Bonus"],
  ["bonuses", "Bonus"],
  ["misc", "Miscellaneous Income"],
  ["miscellaneous", "Miscellaneous Income"],
  ["miscellaneous_income", "Miscellaneous Income"],
  ["one_time", "One-Time"],
  ["biweekly", "Biweekly"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["yearly", "Yearly"],
  ["recurring", "Recurring"],
  ["checking", "Checking"],
  ["savings", "Savings"],
  ["credit", "Credit"],
  ["cash", "Cash"],
  ["income", "Income"],
  ["bill", "Bill"],
  ["expense", "Expense"],
  ["debit", "Debit"],
  ["check", "Check"],
  ["other", "Other"],
  ["paid", "Paid"],
  ["unpaid", "Unpaid"],
  ["skipped", "Skipped"],
  ["husband", "Husband"],
  ["wife", "Wife"],
  ["income_deposit", "Income Deposit"],
  ["balance_adjustment", "Balance Adjustment"],
  ["transfer_in", "Transfer In"],
  ["transfer_out", "Transfer Out"],
  ["bill_payment", "Bill Payment"]
]);

const acronymLabels = new Map<string, string>([
  ["ach", "ACH"],
  ["api", "API"],
  ["csv", "CSV"],
  ["va", "VA"]
]);

export function displayLabel(value: unknown, fallback = "Uncategorized") {
  const raw = asString(value);

  if (!raw) {
    return fallback;
  }

  const key = labelKey(raw);
  const override = labelOverrides.get(key);

  if (override) {
    return override;
  }

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(formatWord)
    .join(" ");
}

export function nullableDisplayLabel(value: unknown, fallback = "Uncategorized") {
  const raw = asString(value);
  return raw ? displayLabel(raw, fallback) : null;
}

export function incomeTypeDisplayLabel(value: IncomeType | string | null | undefined) {
  return displayLabel(value, "Regular Paycheck");
}

export function incomeFrequencyDisplayLabel(value: IncomeFrequency | IncomeRecurrence | string | null | undefined) {
  return displayLabel(value, "One-Time");
}

export function billFrequencyDisplayLabel(value: BillFrequency | string | null | undefined) {
  return displayLabel(value, "Monthly");
}

export function billStatusDisplayLabel(value: BillStatus | string | null | undefined) {
  return displayLabel(value, "Unpaid");
}

export function paymentMethodDisplayLabel(value: PaymentMethod | string | null | undefined) {
  return displayLabel(value, "Other");
}

export function accountTypeDisplayLabel(value: AccountType | string | null | undefined) {
  return displayLabel(value, "Account");
}

export function categoryDisplayLabel(value: CategoryKind | string | null | undefined) {
  return displayLabel(value, "Uncategorized");
}

export function userRoleDisplayLabel(value: UserRole | string | null | undefined) {
  return displayLabel(value, "Household Member");
}

export function activityTypeDisplayLabel(value: string | null | undefined) {
  return displayLabel(value, "Activity");
}

function labelKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/\\]+/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatWord(value: string) {
  const lower = value.toLowerCase();
  const acronym = acronymLabels.get(lower);

  if (acronym) {
    return acronym;
  }

  if (/^\d/.test(value)) {
    return value;
  }

  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}
