import {
  addDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isEqual,
  isValid,
  parseISO,
  startOfMonth,
  subMonths
} from "date-fns";

export function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

export function isoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function safeDate(value: unknown) {
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = parseISO(trimmed);
    return isValid(parsed) ? parsed : null;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return isValid(parsed) ? parsed : null;
  }

  return null;
}

export function safeFormatDate(value: unknown, dateFormat: string, fallback = "Unknown") {
  const date = safeDate(value);
  return date ? format(date, dateFormat) : fallback;
}

export function safeIsoDate(value: unknown, fallback = "") {
  const date = safeDate(value);
  return date ? isoDate(date) : fallback;
}

export function displayDate(date: unknown) {
  return safeFormatDate(date, "MMM d, yyyy", "Unknown date");
}

export function displayShortDate(date: unknown) {
  return safeFormatDate(date, "MMM d", "Unknown");
}

export function monthLabel(date: unknown) {
  return safeFormatDate(date, "MMM yyyy", "Unknown month");
}

export function monthBounds(date = new Date()) {
  const start = startOfMonth(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return {
    start,
    end,
    startIso: isoDate(start),
    endIso: isoDate(end),
    label: monthLabel(start)
  };
}

export function upcomingBounds(days = 14) {
  const start = new Date();
  const end = addDays(start, days);

  return {
    start,
    end,
    startIso: isoDate(start),
    endIso: isoDate(end)
  };
}

export function sixMonthWindow(date = new Date()) {
  const start = startOfMonth(subMonths(date, 5));
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return {
    start,
    end,
    startIso: isoDate(start),
    endIso: isoDate(end)
  };
}

export function clampMonthlyDueDate(year: number, month: number, day: number) {
  const lastDay = endOfMonth(new Date(year, month, 1)).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function isWithinInclusive(date: Date, start: Date, end: Date) {
  return (
    (isAfter(date, start) || isEqual(date, start)) &&
    (isBefore(date, end) || isEqual(date, end))
  );
}
