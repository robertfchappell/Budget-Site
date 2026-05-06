import { asString } from "@/lib/coerce";
import type { IncomeFrequency, IncomeRecurrence, IncomeType } from "@/lib/types";

export const incomeTypeOptions: Array<{
  value: IncomeType;
  label: string;
  defaultRecurrence: IncomeRecurrence;
  defaultGuaranteed: boolean;
  defaultFrequency: IncomeFrequency;
}> = [
  { value: "regular_paycheck", label: "Regular paycheck", defaultRecurrence: "recurring", defaultGuaranteed: true, defaultFrequency: "biweekly" },
  { value: "overtime", label: "Overtime", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "va_disability", label: "VA disability income", defaultRecurrence: "recurring", defaultGuaranteed: true, defaultFrequency: "monthly" },
  { value: "pell_grant", label: "Pell grants", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "student_loan", label: "Student loans", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "va_education_stipend", label: "Dependent/spouse VA education stipend", defaultRecurrence: "recurring", defaultGuaranteed: true, defaultFrequency: "monthly" },
  { value: "bonus", label: "Bonuses", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" },
  { value: "misc", label: "Miscellaneous income", defaultRecurrence: "one_time", defaultGuaranteed: false, defaultFrequency: "one_time" }
];

const incomeTypeMap = new Map(incomeTypeOptions.map((option) => [option.value, option]));

export function normalizeIncomeType(value: unknown): IncomeType {
  const normalized = asString(value, "regular_paycheck");

  if (incomeTypeMap.has(normalized as IncomeType)) {
    return normalized as IncomeType;
  }

  return "regular_paycheck";
}

export function incomeTypeLabel(value: unknown) {
  return incomeTypeMap.get(normalizeIncomeType(value))?.label ?? "Regular paycheck";
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
