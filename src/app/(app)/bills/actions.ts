"use server";

import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { applyAccountDelta, syncLinkedSavingsGoals } from "@/lib/budget/accounting";
import { financialPathGroups, revalidateFinancialPaths } from "@/lib/budget/revalidation";
import { ensureBillInstancesForRange } from "@/lib/budget/recurrence";
import { isoDate, safeIsoDate, todayIso } from "@/lib/dates";
import { billInstanceSchema, recurringBillSchema } from "@/lib/validators";

export async function createRecurringBill(formData: FormData) {
  const user = await requireUser();
  const values = recurringBillSchema.parse({
    ...Object.fromEntries(formData),
    autopay: formData.has("autopay"),
    isSubscription: formData.has("isSubscription")
  });

  const schedule = resolveBillSchedule(values);

  const result = await query<{ id: string }>(
    `
      INSERT INTO recurring_bills (
        household_id, category_id, account_id, name, amount, frequency,
        start_date, due_day, next_due_date, autopay, is_subscription, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9, $10, $11)
      ON CONFLICT (household_id, name)
      DO UPDATE SET
        category_id = EXCLUDED.category_id,
        account_id = EXCLUDED.account_id,
        amount = EXCLUDED.amount,
        frequency = EXCLUDED.frequency,
        start_date = EXCLUDED.start_date,
        due_day = EXCLUDED.due_day,
        next_due_date = EXCLUDED.next_due_date,
        autopay = EXCLUDED.autopay,
        is_subscription = EXCLUDED.is_subscription,
        notes = EXCLUDED.notes,
        active = true
      RETURNING id
    `,
    [
      user.householdId,
      values.categoryId || null,
      values.accountId || null,
      values.name,
      values.amount,
      values.frequency,
      schedule.startDate,
      schedule.dueDay,
      values.autopay,
      values.isSubscription,
      values.notes || null
    ]
  );

  const billId = result.rows[0]?.id;

  if (billId) {
    await query(
      `
        DELETE FROM bill_instances
        WHERE recurring_bill_id = $1
          AND household_id = $2
          AND status = 'unpaid'
      `,
      [billId, user.householdId]
    );
  }

  await ensureBillInstancesForRange(user.householdId, undefined, undefined, { recurringBillId: billId });
  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function updateRecurringBill(formData: FormData) {
  const user = await requireUser();
  const billId = String(formData.get("billId") ?? "");
  const values = recurringBillSchema.parse({
    ...Object.fromEntries(formData),
    autopay: formData.has("autopay"),
    isSubscription: formData.has("isSubscription")
  });
  const schedule = resolveBillSchedule(values);

  await query(
    `
      UPDATE recurring_bills
      SET category_id = $3,
          account_id = $4,
          name = $5,
          amount = $6,
          frequency = $7,
          start_date = $8,
          due_day = $9,
          next_due_date = $8,
          autopay = $10,
          is_subscription = $11,
          notes = $12
      WHERE id = $1 AND household_id = $2
    `,
    [
      billId,
      user.householdId,
      values.categoryId || null,
      values.accountId || null,
      values.name,
      values.amount,
      values.frequency,
      schedule.startDate,
      schedule.dueDay,
      values.autopay,
      values.isSubscription,
      values.notes || null
    ]
  );

  await query(
    `
      DELETE FROM bill_instances
      WHERE recurring_bill_id = $1
        AND household_id = $2
        AND status = 'unpaid'
    `,
    [billId, user.householdId]
  );

  await ensureBillInstancesForRange(user.householdId, undefined, undefined, { recurringBillId: billId });

  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function archiveRecurringBill(formData: FormData) {
  const user = await requireUser();
  const billId = String(formData.get("billId") ?? "");

  await query(
    `
      UPDATE recurring_bills
      SET active = false, archived_at = now()
      WHERE id = $1 AND household_id = $2
    `,
    [billId, user.householdId]
  );

  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function deleteRecurringBill(formData: FormData) {
  const user = await requireUser();
  const billId = String(formData.get("billId") ?? "");

  await query(
    "DELETE FROM recurring_bills WHERE id = $1 AND household_id = $2",
    [billId, user.householdId]
  );

  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function updateBillInstance(formData: FormData) {
  const user = await requireUser();
  const billInstanceId = String(formData.get("billInstanceId") ?? "");
  const values = billInstanceSchema.parse(Object.fromEntries(formData));

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      bill_name: string;
      amount: number;
      account_id: string | null;
      status: string;
    }>(
      `
        SELECT id, bill_name, amount, account_id, status
        FROM bill_instances
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [billInstanceId, user.householdId]
    );
    const current = existing.rows[0];

    if (!current) {
      return;
    }

    await client.query(
      `
        UPDATE bill_instances
        SET bill_name = $3,
            amount = $4,
            due_date = $5,
            category_id = $6,
            account_id = $7,
            notes = $8
        WHERE id = $1 AND household_id = $2
      `,
      [
        billInstanceId,
        user.householdId,
        values.billName,
        values.amount,
        values.dueDate,
        values.categoryId || null,
        values.accountId || null,
        values.notes || null
      ]
    );

    if (current.status === "paid") {
      if (current.account_id) {
        await applyAccountDelta(client, {
          householdId: user.householdId,
          accountId: current.account_id,
          userId: user.id,
          amount: current.amount,
          activityType: "bill_payment",
          description: `Bill edit reversal: ${current.bill_name}`,
          activityDate: values.dueDate,
          syncSavingsGoal: false
        });
      }

      if (values.accountId) {
        await applyAccountDelta(client, {
          householdId: user.householdId,
          accountId: values.accountId,
          userId: user.id,
          amount: -values.amount,
          activityType: "bill_payment",
          description: `Bill payment: ${values.billName}`,
          activityDate: values.dueDate,
          syncSavingsGoal: false
        });
      }

      const accountIds = [...new Set([current.account_id, values.accountId].filter(Boolean))] as string[];

      if (accountIds.length) {
        await syncLinkedSavingsGoals(client, user.householdId, accountIds);
      }
    }
  });

  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function deleteBillInstance(formData: FormData) {
  const user = await requireUser();
  const billInstanceId = String(formData.get("billInstanceId") ?? "");

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      bill_name: string;
      amount: number;
      account_id: string | null;
      status: string;
      due_date: string;
    }>(
      `
        SELECT id, bill_name, amount, account_id, status, due_date
        FROM bill_instances
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [billInstanceId, user.householdId]
    );
    const bill = existing.rows[0];

    if (!bill) {
      return;
    }

    if (bill.status === "paid" && bill.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: bill.account_id,
        userId: user.id,
        amount: bill.amount,
        activityType: "bill_payment",
        description: `Deleted paid bill: ${bill.bill_name}`,
        activityDate: safeIsoDate(bill.due_date, todayIso())
      });
    }

    await client.query(
      "DELETE FROM bill_instances WHERE id = $1 AND household_id = $2",
      [billInstanceId, user.householdId]
    );
  });

  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function markBillPaid(formData: FormData) {
  const user = await requireUser();
  const billInstanceId = String(formData.get("billInstanceId") ?? "");

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      amount: number;
      account_id: string | null;
      status: string;
      bill_name: string;
      due_date: string;
    }>(
      `
        SELECT id, amount, account_id, status, bill_name, due_date
        FROM bill_instances
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [billInstanceId, user.householdId]
    );

    const bill = existing.rows[0];

    if (!bill || bill.status === "paid") {
      return;
    }

    await client.query(
      "UPDATE bill_instances SET status = 'paid', paid_at = now() WHERE id = $1",
      [bill.id]
    );

    if (bill.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: bill.account_id,
        userId: user.id,
        amount: -bill.amount,
        activityType: "bill_payment",
        description: `Bill payment: ${bill.bill_name}`,
        activityDate: safeIsoDate(bill.due_date, todayIso())
      });
    }
  });

  revalidateFinancialPaths(financialPathGroups.bills);
}

export async function markBillUnpaid(formData: FormData) {
  const user = await requireUser();
  const billInstanceId = String(formData.get("billInstanceId") ?? "");

  await withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      amount: number;
      account_id: string | null;
      status: string;
      bill_name: string;
      due_date: string;
    }>(
      `
        SELECT id, amount, account_id, status, bill_name, due_date
        FROM bill_instances
        WHERE id = $1 AND household_id = $2
        FOR UPDATE
      `,
      [billInstanceId, user.householdId]
    );

    const bill = existing.rows[0];

    if (!bill || bill.status !== "paid") {
      return;
    }

    await client.query(
      "UPDATE bill_instances SET status = 'unpaid', paid_at = NULL WHERE id = $1",
      [bill.id]
    );

    if (bill.account_id) {
      await applyAccountDelta(client, {
        householdId: user.householdId,
        accountId: bill.account_id,
        userId: user.id,
        amount: bill.amount,
        activityType: "bill_payment",
        description: `Bill unpaid reversal: ${bill.bill_name}`,
        activityDate: safeIsoDate(bill.due_date, todayIso())
      });
    }
  });

  revalidateFinancialPaths(financialPathGroups.bills);
}

function resolveBillSchedule(values: {
  frequency: "monthly" | "weekly" | "biweekly" | "yearly" | "one_time";
  startDate?: string;
  dueDate?: string;
  dueDay?: number;
  weekday?: number;
  yearlyMonth?: number;
  yearlyDay?: number;
}) {
  const baseDate = parseDateInput(values.startDate || values.dueDate || todayIso());

  if (values.frequency === "monthly") {
    return {
      startDate: isoDate(baseDate),
      dueDay: values.dueDay ?? baseDate.getDate()
    };
  }

  if (values.frequency === "weekly") {
    return {
      startDate: isoDate(nextWeekday(values.weekday ?? baseDate.getDay())),
      dueDay: null
    };
  }

  if (values.frequency === "biweekly") {
    return {
      startDate: isoDate(parseDateInput(values.startDate || values.dueDate || todayIso())),
      dueDay: null
    };
  }

  if (values.frequency === "yearly") {
    const month = values.yearlyMonth ?? baseDate.getMonth() + 1;
    const day = values.yearlyDay ?? baseDate.getDate();
    const year = baseDate.getFullYear();
    const maxDay = new Date(year, month, 0).getDate();

    return {
      startDate: isoDate(new Date(year, month - 1, Math.min(day, maxDay))),
      dueDay: null
    };
  }

  return {
    startDate: isoDate(parseDateInput(values.dueDate || values.startDate || todayIso())),
    dueDay: null
  };
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date(`${todayIso()}T00:00:00`) : parsed;
}

function nextWeekday(weekday: number) {
  const date = parseDateInput(todayIso());
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return date;
}
