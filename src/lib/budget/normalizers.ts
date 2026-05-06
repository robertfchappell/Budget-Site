import { asNumber, asString } from "@/lib/coerce";
import type { Account, BillInstance, Category, Expense, RecurringBill } from "@/lib/types";

export function firstTotal(rows: Array<{ total: unknown }>) {
  return asNumber(rows[0]?.total);
}

export function normalizeColor(value: unknown) {
  const color = asString(value, "#94a3b8");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#94a3b8";
}

export function normalizeAccountType(value: unknown): Account["type"] {
  const type = asString(value, "checking");

  if (type === "savings" || type === "credit" || type === "cash") {
    return type;
  }

  return "checking";
}

export function normalizeCategoryKind(value: unknown): Category["kind"] {
  const kind = asString(value, "expense");

  if (kind === "income" || kind === "bill" || kind === "savings") {
    return kind;
  }

  return "expense";
}

export function normalizeBillFrequency(value: unknown): RecurringBill["frequency"] {
  const frequency = asString(value, "monthly");

  if (frequency === "weekly" || frequency === "yearly") {
    return frequency;
  }

  return "monthly";
}

export function normalizeDueDay(value: unknown) {
  const day = asNumber(value, Number.NaN);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

export function normalizeBillStatus(value: unknown): BillInstance["status"] {
  const status = asString(value, "unpaid");

  if (status === "paid" || status === "skipped") {
    return status;
  }

  return "unpaid";
}

export function normalizePaymentMethod(value: unknown): Expense["paymentMethod"] {
  const method = asString(value, "other");

  if (
    method === "cash" ||
    method === "debit" ||
    method === "credit" ||
    method === "ach" ||
    method === "check"
  ) {
    return method;
  }

  return "other";
}
