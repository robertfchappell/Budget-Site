import { createHash, randomBytes } from "node:crypto";

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${configured.replace(/\/$/, "")}/signup?invite=${encodeURIComponent(token)}`;
}
