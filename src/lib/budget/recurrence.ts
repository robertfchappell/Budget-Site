import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { query } from "@/lib/db";
import { clampMonthlyDueDate, isoDate, safeDate } from "@/lib/dates";
import { asNumber, asString } from "@/lib/coerce";
import { dollars } from "@/lib/money";
import type { BillFrequency } from "@/lib/types";

type RecurringBillRow = {
  id: string;
  household_id: string;
  category_id: string | null;
  account_id: string | null;
  name: string;
  amount: number;
  frequency: BillFrequency;
  start_date: unknown;
  due_day: unknown;
  notes: unknown;
};

function generateDates(
  startDate: unknown,
  frequency: unknown,
  dueDay: unknown,
  rangeStart: Date,
  rangeEnd: Date
) {
  const dates: Date[] = [];
  const first = safeDate(startDate);

  if (!first) {
    return dates;
  }

  const normalizedFrequency = normalizeFrequency(frequency);
  const normalizedDueDay = normalizeDueDay(dueDay);

  if (normalizedFrequency === "monthly") {
    const day = normalizedDueDay ?? first.getDate();
    let cursor = clampMonthlyDueDate(rangeStart.getFullYear(), rangeStart.getMonth(), day);
    const firstMonthDate = clampMonthlyDueDate(first.getFullYear(), first.getMonth(), day);

    if (cursor < firstMonthDate) {
      cursor = firstMonthDate;
    }

    while (cursor <= rangeEnd) {
      if (cursor >= rangeStart) {
        dates.push(cursor);
      }

      cursor = addMonths(cursor, 1);
      cursor = clampMonthlyDueDate(cursor.getFullYear(), cursor.getMonth(), day);
    }

    return dates;
  }

  if (normalizedFrequency === "one_time") {
    if (first >= rangeStart && first <= rangeEnd) {
      dates.push(first);
    }

    return dates;
  }

  const increment = normalizedFrequency === "yearly" ? addYears : addWeeks;
  const incrementBy = normalizedFrequency === "biweekly" ? 2 : 1;
  let cursor = first;

  while (cursor < rangeStart) {
    cursor = increment(cursor, incrementBy);
  }

  while (cursor <= rangeEnd) {
    dates.push(cursor);
    cursor = increment(cursor, incrementBy);
  }

  return dates;
}

function normalizeFrequency(value: unknown): BillFrequency {
  const frequency = asString(value, "monthly");

  if (frequency === "weekly" || frequency === "biweekly" || frequency === "yearly" || frequency === "one_time") {
    return frequency;
  }

  return "monthly";
}

function normalizeDueDay(value: unknown) {
  const day = asNumber(value, Number.NaN);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

export async function ensureBillInstancesForRange(
  householdId: string,
  rangeStart = addDays(new Date(), -45),
  rangeEnd = addDays(new Date(), 75)
) {
  const bills = await query<RecurringBillRow>(
    `
      SELECT id, household_id, category_id, account_id, name, amount, frequency, start_date, due_day, notes
      FROM recurring_bills
      WHERE household_id = $1 AND active = true
    `,
    [householdId]
  );

  for (const bill of bills.rows) {
    const dates = generateDates(
      bill.start_date,
      bill.frequency,
      bill.due_day,
      rangeStart,
      rangeEnd
    );

    for (const dueDate of dates) {
      const inserted = await query<{ id: string }>(
        `
          INSERT INTO bill_instances (
            recurring_bill_id, household_id, category_id, account_id, bill_name,
            amount, due_date, status, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', $8)
          ON CONFLICT (recurring_bill_id, due_date)
          DO UPDATE SET bill_name = EXCLUDED.bill_name
          RETURNING id
        `,
        [
          bill.id,
          bill.household_id,
          bill.category_id,
          bill.account_id,
          bill.name,
          bill.amount,
          isoDate(dueDate),
          bill.notes
        ]
      );

      const billInstanceId = inserted.rows[0]?.id;

      if (billInstanceId) {
        await query(
          `
            INSERT INTO notifications (household_id, bill_instance_id, title, body, notify_on)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (bill_instance_id, notify_on) DO NOTHING
          `,
          [
            bill.household_id,
            billInstanceId,
            `${asString(bill.name, "Bill")} due`,
            `${asString(bill.name, "Bill")} is due for ${dollars(asNumber(bill.amount))}.`,
            isoDate(dueDate)
          ]
        );
      }
    }
  }
}
