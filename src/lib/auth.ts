import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import type { UserContext, UserRole } from "@/lib/types";

const SESSION_COOKIE = "family_budget_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

type UserRow = {
  id: string;
  household_id: string;
  household_name: string;
  name: string;
  email: string;
  role: UserRole;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return secret || "development-only-family-budget-session-secret";
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function createToken(payload: SessionPayload) {
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifyToken(token: unknown): SessionPayload | null {
  if (typeof token !== "string") {
    return null;
  }

  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: Partial<SessionPayload>;

  try {
    payload = JSON.parse(decode(body)) as Partial<SessionPayload>;
  } catch {
    return null;
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return {
    userId: payload.userId,
    expiresAt: payload.expiresAt
  };
}

function mapUser(row: UserRow): UserContext {
  return {
    id: row.id,
    householdId: row.household_id,
    householdName: row.household_name,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  const result = await query<UserRow>(
    `
      SELECT
        users.id,
        users.household_id,
        households.name AS household_name,
        users.name,
        users.email,
        users.role
      FROM users
      JOIN households ON households.id = users.household_id
      WHERE users.id = $1
    `,
    [payload.userId]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  cookieStore.set(SESSION_COOKIE, createToken({ userId, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
