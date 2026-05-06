import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { query } from "@/lib/db";
import { clampMonthlyDueDate, isoDate, safeDate } from "@/lib/dates";
import { asNumber, asString } from "@/lib/coerce";
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

type GeneratedBillInstance = {
  recurringBillId: string;
  householdId: string;
  categoryId: string | null;
  accountId: string | null;
  billName: string;
  amount: number;
  dueDate: string;
  notes: string | null;
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
  rangeEnd = addDays(new Date(), 75),
  options: { recurringBillId?: string | null } = {}
) {
  const bills = await query<RecurringBillRow>(
    `
      SELECT id, household_id, category_id, account_id, name, amount, frequency, start_date, due_day, notes
      FROM recurring_bills
      WHERE household_id = $1
        AND active = true
        AND ($2::uuid IS NULL OR id = $2)
    `,
    [householdId, options.recurringBillId ?? null]
  );
  const generated: GeneratedBillInstance[] = [];

  for (const bill of bills.rows) {
    const dates = generateDates(
      bill.start_date,
      bill.frequency,
      bill.due_day,
      rangeStart,
      rangeEnd
    );

    for (const dueDate of dates) {
      generated.push({
        recurringBillId: bill.id,
        householdId: bill.household_id,
        categoryId: bill.category_id,
        accountId: bill.account_id,
        billName: asString(bill.name, "Bill"),
        amount: asNumber(bill.amount),
        dueDate: isoDate(dueDate),
        notes: asString(bill.notes) || null
      });
    }
  }

  await upsertBillInstances(generated);
}

async function upsertBillInstances(instances: GeneratedBillInstance[]) {
  if (!instances.length) {
    return;
  }

  const params: unknown[] = [];
  const valuesSql = instances.map((instance, index) => {
    const offset = index * 8;

    params.push(
      instance.recurringBillId,
      instance.householdId,
      instance.categoryId,
      instance.accountId,
      instance.billName,
      instance.amount,
      instance.dueDate,
      instance.notes
    );

    return `($${offset + 1}::uuid, $${offset + 2}::uuid, $${offset + 3}::uuid, $${offset + 4}::uuid, $${offset + 5}::text, $${offset + 6}::numeric, $${offset + 7}::date, $${offset + 8}::text)`;
  });

  await query(
    `
      WITH generated (
        recurring_bill_id, household_id, category_id, account_id,
        bill_name, amount, due_date, notes
      ) AS (
        VALUES ${valuesSql.join(",\n        ")}
      ),
      upserted AS (
        INSERT INTO bill_instances (
          recurring_bill_id, household_id, category_id, account_id, bill_name,
          amount, due_date, status, notes
        )
        SELECT recurring_bill_id, household_id, category_id, account_id, bill_name,
               amount, due_date, 'unpaid', notes
        FROM generated
        ON CONFLICT (recurring_bill_id, due_date)
        DO UPDATE SET
          bill_name = EXCLUDED.bill_name,
          amount = EXCLUDED.amount,
          category_id = EXCLUDED.category_id,
          account_id = EXCLUDED.account_id,
          notes = EXCLUDED.notes
        RETURNING id, household_id, bill_name, amount, due_date
      )
      INSERT INTO notifications (household_id, bill_instance_id, title, body, notify_on)
      SELECT household_id,
             id,
             bill_name || ' due',
             bill_name || ' is due for $' || to_char(amount, 'FM999,999,999,990.00') || '.',
             due_date
      FROM upserted
      ON CONFLICT (bill_instance_id, notify_on) DO NOTHING
    `,
    params
  );
}
