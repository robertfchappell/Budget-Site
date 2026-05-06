import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import type { UserContext, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "family_budget_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_SECRET = "development-only-family-budget-session-secret";
const PLACEHOLDER_SECRET = "replace-this-local-secret-before-production";
let warnedWeakSessionSecret = false;

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

  if (!secret || secret === PLACEHOLDER_SECRET) {
    if (process.env.REQUIRE_STRONG_SESSION_SECRET === "true") {
      throw new Error(
        "SESSION_SECRET must be set to a stable, private value."
      );
    }

    if (!warnedWeakSessionSecret) {
      warnedWeakSessionSecret = true;
      logAuth("weak_session_secret", {
        nodeEnv: process.env.NODE_ENV ?? "unknown",
        usingPlaceholder: secret === PLACEHOLDER_SECRET
      });
    }
  }

  return secret || DEFAULT_SECRET;
}

function sessionCookieSecureFromEnv() {
  const override = process.env.AUTH_COOKIE_SECURE ?? process.env.SESSION_COOKIE_SECURE;

  if (override === "true") {
    return true;
  }

  if (override === "false") {
    return false;
  }

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  if (appUrl.startsWith("https://")) {
    return true;
  }

  if (appUrl.startsWith("http://")) {
    return false;
  }

  return false;
}

async function requestIsHttps() {
  try {
    const headerStore = await headers();
    const proto = headerStore.get("x-forwarded-proto") ?? "";
    const forwarded = headerStore.get("forwarded") ?? "";

    return proto.split(",")[0]?.trim() === "https" || forwarded.toLowerCase().includes("proto=https");
  } catch {
    return false;
  }
}

export async function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionCookieSecureFromEnv() || await requestIsHttps(),
    maxAge: SESSION_TTL_SECONDS,
    path: "/"
  };
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

function verifyToken(token: unknown): { payload: SessionPayload | null; reason?: string } {
  if (typeof token !== "string") {
    return { payload: null, reason: "missing_token" };
  }

  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return { payload: null, reason: "malformed_token" };
  }

  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { payload: null, reason: "bad_signature" };
  }

  let payload: Partial<SessionPayload>;

  try {
    payload = JSON.parse(decode(body)) as Partial<SessionPayload>;
  } catch {
    return { payload: null, reason: "bad_payload_json" };
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    return { payload: null, reason: "bad_payload_shape" };
  }

  if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
    return { payload: null, reason: "expired_token" };
  }

  return {
    payload: {
      userId: payload.userId,
      expiresAt: payload.expiresAt
    }
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

export async function getCurrentUser(options: { logFailures?: boolean; source?: string } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    if (options.logFailures) {
      await logAuthFailure("missing_cookie", options.source);
    }
    return null;
  }

  const verification = verifyToken(token);
  const payload = verification.payload;

  if (!payload) {
    if (options.logFailures) {
      await logAuthFailure(verification.reason ?? "invalid_token", options.source);
    }
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
      WHERE users.id = $1 AND users.deactivated_at IS NULL
    `,
    [payload.userId]
  );

  if (!result.rows[0]) {
    if (options.logFailures) {
      await logAuthFailure("user_not_found", options.source, { userId: payload.userId });
    }
    return null;
  }

  return mapUser(result.rows[0]);
}

export async function requireUser(source = "authenticated_route") {
  const user = await getCurrentUser({ logFailures: true, source });

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  cookieStore.set(SESSION_COOKIE, createToken({ userId, expiresAt }), {
    ...(await sessionCookieOptions()),
    expires: new Date(expiresAt * 1000)
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...(await sessionCookieOptions()),
    maxAge: 0,
    expires: new Date(0)
  });
}

async function logAuthFailure(
  reason: string,
  source = "unknown",
  details: Record<string, unknown> = {}
) {
  const context = await requestContext();
  logAuth("session_check_failed", {
    reason,
    source,
    ...context,
    ...details
  });
}

async function requestContext() {
  try {
    const headerStore = await headers();
    return {
      host: headerStore.get("host") ?? "unknown",
      forwardedHost: headerStore.get("x-forwarded-host") ?? undefined,
      forwardedProto: headerStore.get("x-forwarded-proto") ?? undefined,
      path:
        headerStore.get("next-url") ??
        headerStore.get("x-invoke-path") ??
        headerStore.get("referer") ??
        "unknown"
    };
  } catch {
    return {
      host: "unknown",
      path: "unknown"
    };
  }
}

function logAuth(event: string, details: Record<string, unknown>) {
  if (process.env.AUTH_LOG_LEVEL === "silent") {
    return;
  }

  console.warn(
    JSON.stringify({
      event: `auth.${event}`,
      ...details
    })
  );
}
