import { safeIsoDate, todayIso } from "@/lib/dates";
import type { IncomeStatus } from "@/lib/types";

export function incomeStatus(balancePostedAt: unknown, paycheckDate: unknown): IncomeStatus {
  if (balancePostedAt) {
    return "posted";
  }

  const dateIso = safeIsoDate(paycheckDate);

  return dateIso && dateIso > todayIso() ? "scheduled" : "pending";
}

export function incomeStatusLabel(status: IncomeStatus) {
  if (status === "posted") {
    return "Posted";
  }

  if (status === "scheduled") {
    return "Scheduled";
  }

  return "Pending";
}
