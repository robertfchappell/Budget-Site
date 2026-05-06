"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { applyAccountDelta, setAccountBalance, syncLinkedSavingsGoals } from "@/lib/budget/accounting";
import { financialPathGroups, revalidateFinancialPaths } from "@/lib/budget/revalidation";
import { todayIso } from "@/lib/dates";
import { createInviteToken, hashInviteToken, inviteUrl } from "@/lib/households/invites";
import {
  accountBalanceSchema,
  accountSchema,
  deleteAccountSchema,
  inviteSchema,
  removeMemberSchema,
  resendInviteSchema,
  revokeInviteSchema,
  transferSchema
} from "@/lib/validators";
import type { InviteActionStatus } from "@/lib/types";

export type InviteState = {
  error?: string;
  inviteUrl?: string;
  status?: InviteActionStatus;
  message?: string;
};

export type InviteMutationResult = {
  ok: boolean;
  error?: string;
  inviteUrl?: string;
  status?: InviteActionStatus;
  message?: string;
};

export async function createAccount(formData: FormData) {
  const user = await requireUser();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    console.warn("[settings:create-account] Invalid account form", parsed.error.flatten().fieldErrors);
    return;
  }

  const values = parsed.data;

  await withTransaction(async (client) => {
    const created = await client.query<{ id: string }>(
      `
        INSERT INTO accounts (
          household_id, name, type, current_balance, institution, include_in_safe_to_spend
        )
        VALUES ($1, $2, $3, 0, $4, $5)
        ON CONFLICT (household_id, name)
        DO UPDATE SET type = EXCLUDED.type,
                      institution = EXCLUDED.institution,
                      include_in_safe_to_spend = EXCLUDED.include_in_safe_to_spend
        RETURNING id
      `,
      [
        user.householdId,
        values.accountName,
        values.accountType,
        values.institution || null,
        values.includeInSafeToSpend
      ]
    );
    const accountId = created.rows[0]?.id;

    if (!accountId) {
      return;
    }

    await setAccountBalance(client, {
      householdId: user.householdId,
      accountId,
      userId: user.id,
      currentBalance: values.currentBalance,
      activityDate: todayIso(),
      description: `Account balance set: ${values.accountName}`
    });
  });

  revalidateFinancialPaths(financialPathGroups.settings);
}

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

  revalidateFinancialPaths(financialPathGroups.settings);
}

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    console.warn("[settings:delete-account] Invalid delete account form", parsed.error.flatten().fieldErrors);
    return;
  }

  await withTransaction(async (client) => {
    await client.query(
      `
        DELETE FROM accounts
        WHERE id = $1 AND household_id = $2
      `,
      [parsed.data.accountId, user.householdId]
    );
  });

  revalidateFinancialPaths(financialPathGroups.settings);
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
      transferId,
      syncSavingsGoal: false
    });
    await applyAccountDelta(client, {
      householdId: user.householdId,
      accountId: values.toAccountId,
      userId: user.id,
      amount: values.amount,
      activityType: "transfer_in",
      description: `Transfer from ${fromAccount.name}`,
      activityDate: values.transferDate,
      transferId,
      syncSavingsGoal: false
    });
    await syncLinkedSavingsGoals(client, user.householdId, [values.fromAccountId, values.toAccountId]);
  });

  revalidateFinancialPaths(financialPathGroups.settings);
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
    const existingUser = await client.query<{
      id: string;
      household_id: string;
      deactivated_at: Date | null;
    }>(
      `
        SELECT id, household_id, deactivated_at
        FROM users
        WHERE lower(email) = $1
        LIMIT 1
      `,
      [values.invitedEmail]
    );
    const activeUser = existingUser.rows.find((row) => !row.deactivated_at);

    if (activeUser?.household_id === user.householdId) {
      return { error: "That person already belongs to this household." } as const;
    }

    if (activeUser) {
      return { error: "That email already has an active account." } as const;
    }

    const pendingInvite = await client.query<{ id: string }>(
      `
        SELECT id
        FROM household_invites
        WHERE household_id = $1
          AND lower(invited_email) = $2
          AND accepted_at IS NULL
          AND revoked_at IS NULL
          AND expires_at >= now()
        LIMIT 1
      `,
      [user.householdId, values.invitedEmail]
    );

    if (pendingInvite.rows[0]) {
      return { error: "That email already has a pending invite. Resend it instead." } as const;
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

    return {
      inviteUrl: inviteUrl(token),
      status: "created",
      message: "Invite created."
    } as const;
  });

  revalidatePath("/settings");
  return created;
}

export async function revokeHouseholdInvite(formData: FormData): Promise<InviteMutationResult> {
  const user = await requireUser();
  const parsed = revokeInviteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: "Invite could not be revoked." };
  }

  const revoked = await withTransaction(async (client) => {
    const result = await client.query(
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

    return Number(result.rowCount ?? 0) > 0;
  });

  revalidatePath("/settings");
  return revoked
    ? { ok: true, status: "revoked", message: "Invite revoked." }
    : { ok: false, error: "That invite is no longer pending." };
}

export async function resendHouseholdInvite(formData: FormData): Promise<InviteMutationResult> {
  const user = await requireUser();
  const parsed = resendInviteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: "Invite could not be resent." };
  }

  const token = createInviteToken();
  const result = await withTransaction(async (client) => {
    const invite = await client.query<{ id: string; invited_email: string }>(
      `
        SELECT id, invited_email
        FROM household_invites
        WHERE id = $1
          AND household_id = $2
          AND accepted_at IS NULL
          AND revoked_at IS NULL
          AND expires_at >= now()
        FOR UPDATE
      `,
      [parsed.data.inviteId, user.householdId]
    );

    if (!invite.rows[0]) {
      return { ok: false, error: "That invite is no longer pending." } as const;
    }

    await client.query(
      `
        UPDATE household_invites
        SET token_hash = $3,
            invited_by_user_id = $4,
            expires_at = now() + ($5::int * INTERVAL '1 day'),
            created_at = now()
        WHERE id = $1 AND household_id = $2
      `,
      [
        parsed.data.inviteId,
        user.householdId,
        hashInviteToken(token),
        user.id,
        parsed.data.expiresInDays
      ]
    );

    return {
      ok: true,
      status: "resent",
      message: "Invite resent.",
      inviteUrl: inviteUrl(token)
    } as const;
  });

  revalidatePath("/settings");
  return result;
}

export async function removeHouseholdMember(formData: FormData): Promise<InviteMutationResult> {
  const user = await requireUser();
  const parsed = removeMemberSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: "Member could not be removed." };
  }

  if (parsed.data.memberId === user.id) {
    return { ok: false, error: "You cannot remove your own account." };
  }

  const removed = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE users
        SET deactivated_at = now()
        WHERE id = $1
          AND household_id = $2
          AND deactivated_at IS NULL
      `,
      [parsed.data.memberId, user.householdId]
    );

    return Number(result.rowCount ?? 0) > 0;
  });

  revalidatePath("/settings");
  return removed
    ? { ok: true, status: "member_removed", message: "Member removed." }
    : { ok: false, error: "That member is no longer active." };
}
