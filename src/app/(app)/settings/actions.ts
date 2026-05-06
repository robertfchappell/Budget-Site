"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { applyAccountDelta, setAccountBalance } from "@/lib/budget/accounting";
import { todayIso } from "@/lib/dates";
import { createInviteToken, hashInviteToken, inviteUrl } from "@/lib/households/invites";
import { accountBalanceSchema, inviteSchema, revokeInviteSchema, transferSchema } from "@/lib/validators";

export type InviteState = {
  error?: string;
  inviteUrl?: string;
};

export async function updateAccountBalance(formData: FormData) {
  const user = await requireUser();
  const values = accountBalanceSchema.parse(Object.fromEntries(formData));

  await withTransaction(async (client) => {
    await setAccountBalance(client, {
      householdId: user.householdId,
      accountId: values.accountId,
      userId: user.id,
      currentBalance: values.currentBalance,
      activityDate: todayIso(),
      description: "Manual balance update"
    });
  });

  revalidateFinancialPaths();
}

export async function transferFunds(formData: FormData) {
  const user = await requireUser();
  const parsed = transferSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success || parsed.data.fromAccountId === parsed.data.toAccountId) {
    return;
  }

  const values = parsed.data;

  await withTransaction(async (client) => {
    const accounts = await client.query<{
      id: string;
      name: string;
    }>(
      `
        SELECT id, name
        FROM accounts
        WHERE household_id = $1 AND id IN ($2, $3)
        FOR UPDATE
      `,
      [user.householdId, values.fromAccountId, values.toAccountId]
    );
    const fromAccount = accounts.rows.find((account) => account.id === values.fromAccountId);
    const toAccount = accounts.rows.find((account) => account.id === values.toAccountId);

    if (!fromAccount || !toAccount) {
      return;
    }

    const transfer = await client.query<{ id: string }>(
      `
        INSERT INTO account_transfers (
          household_id, from_account_id, to_account_id, user_id,
          amount, transfer_date, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        user.householdId,
        values.fromAccountId,
        values.toAccountId,
        user.id,
        values.amount,
        values.transferDate,
        values.notes || null
      ]
    );
    const transferId = transfer.rows[0]?.id;

    if (!transferId) {
      return;
    }

    await applyAccountDelta(client, {
      householdId: user.householdId,
      accountId: values.fromAccountId,
      userId: user.id,
      amount: -values.amount,
      activityType: "transfer_out",
      description: `Transfer to ${toAccount.name}`,
      activityDate: values.transferDate,
      transferId
    });
    await applyAccountDelta(client, {
      householdId: user.householdId,
      accountId: values.toAccountId,
      userId: user.id,
      amount: values.amount,
      activityType: "transfer_in",
      description: `Transfer from ${fromAccount.name}`,
      activityDate: values.transferDate,
      transferId
    });
  });

  revalidateFinancialPaths();
}

export async function createHouseholdInvite(
  _previousState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the invite form and try again." };
  }

  const values = parsed.data;
  const token = createInviteToken();

  const created = await withTransaction(async (client) => {
    const existingUser = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE household_id = $1 AND lower(email) = $2 LIMIT 1",
      [user.householdId, values.invitedEmail]
    );

    if (existingUser.rows[0]) {
      return { error: "That person already belongs to this household." } as const;
    }

    await client.query(
      `
        INSERT INTO household_invites (
          household_id, invited_email, invited_role, token_hash,
          invited_by_user_id, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, now() + ($6::int * INTERVAL '1 day'))
      `,
      [
        user.householdId,
        values.invitedEmail,
        values.invitedRole,
        hashInviteToken(token),
        user.id,
        values.expiresInDays
      ]
    );

    return { inviteUrl: inviteUrl(token) } as const;
  });

  revalidatePath("/settings");
  return created;
}

export async function revokeHouseholdInvite(formData: FormData) {
  const user = await requireUser();
  const parsed = revokeInviteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return;
  }

  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE household_invites
        SET revoked_at = now()
        WHERE id = $1
          AND household_id = $2
          AND accepted_at IS NULL
          AND revoked_at IS NULL
      `,
      [parsed.data.inviteId, user.householdId]
    );
  });

  revalidatePath("/settings");
}

function revalidateFinancialPaths() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/planning");
  revalidatePath("/bills");
  revalidatePath("/income");
  revalidatePath("/expenses");
}
