"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { bootstrapHousehold } from "@/lib/households/bootstrap";
import { hashInviteToken } from "@/lib/households/invites";
import { signupSchema } from "@/lib/validators";
import type { UserRole } from "@/lib/types";

export type SignupState = {
  error?: string;
};

export async function signupAction(
  _previousState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the signup form and try again." };
  }

  const values = parsed.data;
  const inviteToken = values.inviteToken || "";

  if (!inviteToken && !values.householdName?.trim()) {
    return { error: "Household name is required when you create a new household." };
  }

  const createdUserId = await withTransaction(async (client) => {
    const existingUser = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
      [values.email]
    );

    if (existingUser.rows[0]) {
      return { error: "An account already exists for that email address." } as const;
    }

    const passwordHash = await bcrypt.hash(values.password, 12);

    if (inviteToken) {
      const invite = await client.query<{
        id: string;
        household_id: string;
        household_name: string;
        invited_email: string;
        invited_role: UserRole;
        expires_at: Date;
        accepted_at: Date | null;
        revoked_at: Date | null;
      }>(
        `
          SELECT household_invites.id, household_invites.household_id,
                 households.name AS household_name, household_invites.invited_email,
                 household_invites.invited_role, household_invites.expires_at,
                 household_invites.accepted_at, household_invites.revoked_at
          FROM household_invites
          JOIN households ON households.id = household_invites.household_id
          WHERE household_invites.token_hash = $1
          FOR UPDATE
        `,
        [hashInviteToken(inviteToken)]
      );
      const currentInvite = invite.rows[0];

      if (!currentInvite) {
        return { error: "That invite link is not valid." } as const;
      }

      if (currentInvite.accepted_at || currentInvite.revoked_at) {
        return { error: "That invite link has already been used or revoked." } as const;
      }

      if (new Date(currentInvite.expires_at).getTime() < Date.now()) {
        return { error: "That invite link has expired." } as const;
      }

      if (currentInvite.invited_email.toLowerCase() !== values.email) {
        return { error: `This invite is for ${currentInvite.invited_email}.` } as const;
      }

      const user = await client.query<{ id: string }>(
        `
          INSERT INTO users (household_id, name, email, password_hash, role)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          currentInvite.household_id,
          values.name,
          values.email,
          passwordHash,
          currentInvite.invited_role
        ]
      );
      const userId = user.rows[0]?.id;

      if (!userId) {
        return { error: "Could not create your account." } as const;
      }

      await client.query(
        "UPDATE household_invites SET accepted_at = now(), accepted_by_user_id = $2 WHERE id = $1",
        [currentInvite.id, userId]
      );

      return { userId } as const;
    }

    const existingHousehold = await client.query<{ id: string }>(
      "SELECT id FROM households WHERE lower(name) = lower($1) LIMIT 1",
      [values.householdName]
    );

    if (existingHousehold.rows[0]) {
      return { error: "That household name is already in use. Choose another name or accept an invite." } as const;
    }

    const household = await client.query<{ id: string }>(
      "INSERT INTO households (name) VALUES ($1) RETURNING id",
      [values.householdName]
    );
    const householdId = household.rows[0]?.id;

    if (!householdId) {
      return { error: "Could not create the household." } as const;
    }

    await bootstrapHousehold(client, householdId);

    const user = await client.query<{ id: string }>(
      `
        INSERT INTO users (household_id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [householdId, values.name, values.email, passwordHash, values.role]
    );

    return { userId: user.rows[0]?.id ?? "" } as const;
  });

  if ("error" in createdUserId) {
    return { error: createdUserId.error };
  }

  if (!createdUserId.userId) {
    return { error: "Could not create your account." };
  }

  await setSession(createdUserId.userId);
  redirect("/dashboard");
}

export async function getInvitePreview(token: string) {
  if (!token) {
    return null;
  }

  const { query } = await import("@/lib/db");
  const result = await query<{
    invited_email: string;
    invited_role: UserRole;
    household_name: string;
    expires_at: string;
    expired: boolean;
    accepted_at: string | null;
    revoked_at: string | null;
  }>(
    `
      SELECT household_invites.invited_email, household_invites.invited_role,
             households.name AS household_name, household_invites.expires_at,
             household_invites.expires_at < now() AS expired,
             household_invites.accepted_at, household_invites.revoked_at
      FROM household_invites
      JOIN households ON households.id = household_invites.household_id
      WHERE household_invites.token_hash = $1
      LIMIT 1
    `,
    [hashInviteToken(token)]
  );

  return result.rows[0] ?? null;
}
