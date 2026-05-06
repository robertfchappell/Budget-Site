import { asString } from "@/lib/coerce";
import { incomeTypeDisplayLabel } from "@/lib/display-labels";
import type { IncomeFrequency, IncomeRecurrence, IncomeType } from "@/lib/types";

export const incomeTypeOptions: Array<{
  value: IncomeType;
  label: string;
  defaultRecurrence: IncomeRecurrence;
  defaultGuaranteed: boolean;
  defaultFrequency: IncomeFrequency;
}> = [
  { value: "regular_paycheck", label: "Regular Paycheck", defaultRecurrence: "recurring", defaultGuaranteed: true, defaultFrequency: "biweekly" },
  { value: "overtime", label: "Overtime", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "va_disability", label: "VA Disability", defaultRecurrence: "recurring", defaultGuaranteed: true, defaultFrequency: "monthly" },
  { value: "pell_grant", label: "Pell Grant", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "student_loan", label: "Student Loan", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "va_education_stipend", label: "Dependent/Spouse VA Education Stipend", defaultRecurrence: "recurring", defaultGuaranteed: true, defaultFrequency: "monthly" },
  { value: "bonus", label: "Bonus", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "misc", label: "Miscellaneous Income", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" }
];

const incomeTypeMap = new Map(incomeTypeOptions.map((option) => [option.value, option]));
const incomeTypeAliases = new Map<string, IncomeType>([
  ["paycheck", "regular_paycheck"],
  ["va_disability_income", "va_disability"],
  ["pell_grants", "pell_grant"],
  ["student_loans", "student_loan"],
  ["dependent_spouse_va_education_stipend", "va_education_stipend"],
  ["dependent_spouse_va_stipend", "va_education_stipend"],
  ["miscellaneous", "misc"],
  ["miscellaneous_income", "misc"],
  ["bonuses", "bonus"]
]);

export function normalizeIncomeType(value: unknown): IncomeType {
  const normalized = incomeTypeKey(asString(value, "regular_paycheck"));
  const alias = incomeTypeAliases.get(normalized);

  if (alias) {
    return alias;
  }

  if (incomeTypeMap.has(normalized as IncomeType)) {
    return normalized as IncomeType;
  }

  return "regular_paycheck";
}

export function incomeTypeLabel(value: unknown) {
  return incomeTypeMap.get(normalizeIncomeType(value))?.label ?? incomeTypeDisplayLabel(asString(value));
}

export function normalizeIncomeRecurrence(value: unknown): IncomeRecurrence {
  return asString(value, "one_time") === "recurring" ? "recurring" : "one_time";
}

export function defaultRecurrenceForIncomeType(value: unknown) {
  return incomeTypeMap.get(normalizeIncomeType(value))?.defaultRecurrence ?? "one_time";
}

export function defaultGuaranteedForIncomeType(value: unknown) {
  return incomeTypeMap.get(normalizeIncomeType(value))?.defaultGuaranteed ?? false;
}

export function normalizeIncomeFrequency(value: unknown): IncomeFrequency {
  const normalized = asString(value, "one_time");

  if (normalized === "weekly" || normalized === "biweekly" || normalized === "monthly") {
    return normalized;
  }

  return "one_time";
}

export function defaultFrequencyForIncomeType(value: unknown) {
  return incomeTypeMap.get(normalizeIncomeType(value))?.defaultFrequency ?? "one_time";
}

function incomeTypeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/\\]+/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
