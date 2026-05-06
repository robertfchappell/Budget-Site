import { addDays, differenceInCalendarDays, format, isBefore, parseISO, startOfMonth } from "date-fns";
import { asBoolean, asNumber, asNullableString, asString } from "@/lib/coerce";
import { normalizeIncomeFrequency, normalizeIncomeType } from "@/lib/budget/income-types";
import { normalizeColor } from "@/lib/budget/normalizers";
import { todayIso } from "@/lib/dates";
import type { IncomeFrequency, IncomeType, IncomeTypeSummary } from "@/lib/types";

export type IncomeForecastRow = {
  id: string;
  employer: string | null;
  income_type: IncomeType | string;
  income_frequency: IncomeFrequency | string;
  guaranteed: boolean | null;
  paycheck_date: string;
  deposit_amount: number;
  balance_posted_at: string | Date | null;
  account_id: string | null;
  color: string | null;
};

type IncomeOccurrence = {
  month: string;
  dateIso: string;
  sourceKey: string;
  incomeType: IncomeType;
  incomeFrequency: IncomeFrequency;
  guaranteed: boolean;
  amount: number;
  posted: boolean;
  generated: boolean;
  color: string;
};

export type IncomeForecastTotals = {
  income: number;
  scheduledIncome: number;
  postedIncome: number;
  pendingIncome: number;
  recurringIncome: number;
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
};

export function buildMonthlyIncomeForecast(
  rows: IncomeForecastRow[],
  startIso: string,
  endIso: string,
  labelForIncomeType: (incomeType: IncomeType) => string,
  currentIso = todayIso()
) {
  const occurrences = expandIncomeOccurrences(rows, startIso, endIso, currentIso);
  const byMonth = new Map<string, IncomeForecastTotals>();
  const byType = new Map<IncomeType, IncomeTypeSummary>();

  for (const occurrence of occurrences) {
    const month = totalsForMonth(byMonth, occurrence.month);
    month.income += occurrence.amount;
    month.scheduledIncome += occurrence.amount;

    if (occurrence.posted) {
      month.postedIncome += occurrence.amount;
    } else {
      month.pendingIncome += occurrence.amount;
    }

    if (occurrence.incomeFrequency === "one_time") {
      month.oneTimeIncome += occurrence.amount;
    } else {
      month.recurringIncome += occurrence.amount;

      if (occurrence.guaranteed) {
        month.guaranteedIncome += occurrence.amount;
      } else {
        month.variableIncome += occurrence.amount;
      }
    }

    const typeSummary = byType.get(occurrence.incomeType) ?? {
      incomeType: occurrence.incomeType,
      label: labelForIncomeType(occurrence.incomeType),
      total: 0,
      recurring: 0,
      oneTime: 0,
      guaranteed: 0,
      posted: 0,
      pending: 0,
      color: occurrence.color
    };

    typeSummary.total += occurrence.amount;

    if (occurrence.incomeFrequency === "one_time") {
      typeSummary.oneTime += occurrence.amount;
    } else {
      typeSummary.recurring += occurrence.amount;

      if (occurrence.guaranteed) {
        typeSummary.guaranteed += occurrence.amount;
      }
    }

    if (occurrence.posted) {
      typeSummary.posted += occurrence.amount;
    } else {
      typeSummary.pending += occurrence.amount;
    }

    byType.set(occurrence.incomeType, typeSummary);
  }

  return {
    byMonth,
    byType: [...byType.values()].sort((left, right) => right.total - left.total)
  };
}

function expandIncomeOccurrences(
  rows: IncomeForecastRow[],
  startIso: string,
  endIso: string,
  currentIso: string
) {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const normalizedRows = rows.map(normalizeIncomeRow).filter((row) => row.dateIso && row.amount > 0);
  const occurrences: IncomeOccurrence[] = [];
  const actualBySource = new Map<string, IncomeOccurrence[]>();
  const recurringSources = new Map<string, ReturnType<typeof normalizeIncomeRow>>();

  for (const row of normalizedRows) {
    if (row.dateIso >= startIso && row.dateIso < endIso) {
      const occurrence = occurrenceFromRow(row, row.dateIso, false);
      occurrences.push(occurrence);
      actualBySource.set(row.sourceKey, [...(actualBySource.get(row.sourceKey) ?? []), occurrence]);
    }

    if (row.incomeFrequency !== "one_time" && row.dateIso < endIso) {
      const existing = recurringSources.get(row.sourceKey);

      if (!existing || row.dateIso < existing.dateIso) {
        recurringSources.set(row.sourceKey, row);
      }
    }
  }

  for (const source of recurringSources.values()) {
    let date = parseDate(source.dateIso);

    while (isBefore(date, start)) {
      date = nextIncomeDate(date, source.incomeFrequency, source.anchorDay);
    }

    while (isBefore(date, end)) {
      const dateIso = format(date, "yyyy-MM-dd");

      if (dateIso >= currentIso && !hasActualNearDate(actualBySource.get(source.sourceKey) ?? [], date)) {
        occurrences.push(occurrenceFromRow(source, dateIso, true));
      }

      date = nextIncomeDate(date, source.incomeFrequency, source.anchorDay);
    }
  }

  return occurrences;
}

function normalizeIncomeRow(row: IncomeForecastRow) {
  const incomeType = normalizeIncomeType(row.income_type);
  const incomeFrequency = normalizeIncomeFrequency(row.income_frequency);
  const employer = asString(row.employer, incomeType);
  const accountId = asNullableString(row.account_id) ?? "manual";
  const amount = asNumber(row.deposit_amount);
  const dateIso = asString(row.paycheck_date).slice(0, 10);

  return {
    id: asString(row.id),
    sourceKey: [
      incomeType,
      employer.trim().toLowerCase(),
      incomeFrequency,
      accountId,
      amount.toFixed(2)
    ].join("|"),
    incomeType,
    incomeFrequency,
    guaranteed: asBoolean(row.guaranteed),
    amount,
    dateIso,
    anchorDay: parseDate(dateIso).getDate(),
    posted: Boolean(row.balance_posted_at),
    color: normalizeColor(row.color)
  };
}

function occurrenceFromRow(
  row: ReturnType<typeof normalizeIncomeRow>,
  dateIso: string,
  generated: boolean
): IncomeOccurrence {
  return {
    month: format(startOfMonth(parseDate(dateIso)), "yyyy-MM-dd"),
    dateIso,
    sourceKey: row.sourceKey,
    incomeType: row.incomeType,
    incomeFrequency: row.incomeFrequency,
    guaranteed: row.guaranteed,
    amount: row.amount,
    posted: generated ? false : row.posted,
    generated,
    color: row.color
  };
}

function totalsForMonth(byMonth: Map<string, IncomeForecastTotals>, month: string) {
  const existing = byMonth.get(month);

  if (existing) {
    return existing;
  }

  const created = {
    income: 0,
    scheduledIncome: 0,
    postedIncome: 0,
    pendingIncome: 0,
    recurringIncome: 0,
    guaranteedIncome: 0,
    variableIncome: 0,
    oneTimeIncome: 0
  };

  byMonth.set(month, created);
  return created;
}

function hasActualNearDate(actualOccurrences: IncomeOccurrence[], date: Date) {
  return actualOccurrences.some((actual) => {
    const actualDate = parseDate(actual.dateIso);
    return Math.abs(differenceInCalendarDays(actualDate, date)) <= 3;
  });
}

function nextIncomeDate(date: Date, frequency: IncomeFrequency, anchorDay: number) {
  if (frequency === "weekly") {
    return addDays(date, 7);
  }

  if (frequency === "biweekly") {
    return addDays(date, 14);
  }

  if (frequency === "monthly") {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(anchorDay, lastDay));
  }

  return addDays(date, 1);
}

function parseDate(value: string) {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? parseISO(todayIso()) : parsed;
}
