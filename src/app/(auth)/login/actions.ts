"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { setSession } from "@/lib/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const result = await query<{
    id: string;
    password_hash: string;
  }>(
    "SELECT id, password_hash FROM users WHERE lower(email) = $1 AND deactivated_at IS NULL",
    [email]
  );

  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "That sign-in did not match a household user." };
  }

  await setSession(user.id);
  redirect("/dashboard");
}
