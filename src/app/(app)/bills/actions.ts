"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { applyAccountDelta } from "@/lib/budget/accounting";
import { ensureBillInstancesForRange } from "@/lib/budget/recurrence";
import { billInstanceSchema, recurringBillSchema } from "@/lib/validators";

export async function createRecurringBill(formData: FormData) {
  const user = await requireUser();
  const values = recurringBillSchema.parse({
    ...Object.fromEntries(formData),
    autopay: formData.has("autopay"),
    isSubscription: formData.has("isSubscription")
  });

  const startDate = new Date(`${values.startDate}T00:00:00`);
  const dueDay =
    values.frequency === "monthly"
      ? values.dueDay ?? startDate.getDate()
      : values.dueDay ?? null;

  await query(
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
    `,
    [
      user.householdId,
      values.categoryId || null,
      values.accountId || null,
      values.name,
      values.amount,
      values.frequency,
      values.startDate,
      dueDay,
      values.autopay,
      values.isSubscription,
      values.notes || null
    ]
  );

  await ensureBillInstancesForRange(user.householdId);
  revalidatePath("/bills");
  revalidatePath("/dashboard");
}

export async function updateRecurringBill(formData: FormData) {
  const user = await requireUser();
  const billId = String(formData.get("billId") ?? "");
  const values = recurringBillSchema.parse({
    ...Object.fromEntries(formData),
    autopay: formData.has("autopay"),
    isSubscription: formData.has("isSubscription")
  });
  const startDate = new Date(`${values.startDate}T00:00:00`);
  const dueDay =
    values.frequency === "monthly"
      ? values.dueDay ?? startDate.getDate()
      : values.dueDay ?? null;

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
      values.startDate,
      dueDay,
      values.autopay,
      values.isSubscription,
      values.notes || null
    ]
  );

  await query(
    `
      UPDATE bill_instances
      SET category_id = $3,
          account_id = $4,
          bill_name = $5,
          amount = $6,
          notes = $7
      WHERE recurring_bill_id = $1
        AND household_id = $2
        AND status = 'unpaid'
    `,
    [
      billId,
      user.householdId,
      values.categoryId || null,
      values.accountId || null,
      values.name,
      values.amount,
      values.notes || null
    ]
  );

  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/planning");
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

  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/planning");
}

export async function deleteRecurringBill(formData: FormData) {
  const user = await requireUser();
  const billId = String(formData.get("billId") ?? "");

  await query(
    "DELETE FROM recurring_bills WHERE id = $1 AND household_id = $2",
    [billId, user.householdId]
  );

  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/planning");
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
          activityDate: values.dueDate
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
          activityDate: values.dueDate
        });
      }
    }
  });

  revalidateFinancialPaths();
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
        activityDate: String(bill.due_date)
      });
    }

    await client.query(
      "DELETE FROM bill_instances WHERE id = $1 AND household_id = $2",
      [billInstanceId, user.householdId]
    );
  });

  revalidateFinancialPaths();
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
        activityDate: String(bill.due_date)
      });
    }
  });

  revalidateFinancialPaths();
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
        activityDate: String(bill.due_date)
      });
    }
  });

  revalidateFinancialPaths();
}

function revalidateFinancialPaths() {
  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/planning");
  revalidatePath("/settings");
}
