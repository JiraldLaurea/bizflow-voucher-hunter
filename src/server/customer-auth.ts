import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { customerAuthCookie, customerPhoneCookie } from "@/lib/customer-identity";
import { getCustomerAuthEpoch, getDb, one, run } from "@/server/db";
import { AppError } from "@/server/errors";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function hashCustomerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function bearerTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
}

/** Issue an opaque mobile token. Only the SHA-256 hash is persisted. */
export async function issueCustomerToken(phone: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ONE_YEAR_SECONDS * 1000);
  const db = await getDb();
  await run(
    db,
    `INSERT INTO customer_tokens (id, token_hash, phone, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      hashCustomerToken(token),
      phone,
      now.toISOString(),
      expiresAt.toISOString(),
    ],
  );
  return token;
}

async function getBearerCustomerPhone(request: Request): Promise<string | null | undefined> {
  const token = bearerTokenFromRequest(request);
  if (token === undefined) return undefined;
  if (!token) return null;
  const db = await getDb();
  const row = await one(
    db,
    `SELECT phone
     FROM customer_tokens
     WHERE token_hash = ? AND expires_at > ?
     LIMIT 1`,
    [hashCustomerToken(token), new Date().toISOString()],
  );
  return row ? String(row.phone) : null;
}

/** Revoke the bearer token presented by this request, if any. */
export async function revokeCustomerToken(request: Request): Promise<boolean> {
  const token = bearerTokenFromRequest(request);
  if (!token) return false;
  const db = await getDb();
  return (await run(db, "DELETE FROM customer_tokens WHERE token_hash = ?", [
    hashCustomerToken(token),
  ])) > 0;
}

/**
 * The phone the current request is signed in as, or null when signed out.
 *
 * Both cookies are httpOnly and set server-side ONLY after OTP verification, so
 * a signed-in phone cannot be forged by writing a cookie. A visitor is signed in
 * when the phone cookie is present AND the auth cookie holds the current server
 * epoch. A data reset bumps the epoch, so every previously issued cookie goes
 * stale and the visitor is signed out on their next page load — on any device.
 *
 * Strict on the auth marker (must be present and match): a phone cookie without
 * it is treated as signed out, which invalidates any pre-OTP sign-in.
 */
export async function getSignedInCustomerPhone(request?: Request): Promise<string | null> {
  if (request) {
    const bearerPhone = await getBearerCustomerPhone(request);
    // An Authorization header is authoritative. Never fall back to a cookie
    // when a caller presents an invalid or malformed bearer credential.
    if (bearerPhone !== undefined) return bearerPhone;
  }
  const store = cookies();
  const phone = store.get(customerPhoneCookie)?.value;
  const cookieEpoch = store.get(customerAuthCookie)?.value;
  if (!phone || !cookieEpoch) return null;
  const currentEpoch = await getCustomerAuthEpoch();
  if (cookieEpoch !== currentEpoch) return null;
  return decodeURIComponent(phone);
}

/**
 * The signed-in phone, or a 401. Public endpoints use this instead of trusting a
 * phone in the request body, so a caller can only ever act as the number they
 * verified by OTP.
 */
export async function requireSignedInCustomerPhone(request?: Request): Promise<string> {
  const phone = await getSignedInCustomerPhone(request);
  if (!phone) {
    throw new AppError("E-CUSTOMER-AUTH", "Sign in to continue", 401);
  }
  return phone;
}

/**
 * Issue the httpOnly auth cookies for a phone that has just passed OTP. Must be
 * called from a Route Handler (cookies() is writable there, not in pages).
 */
export async function setCustomerAuthCookies(phone: string) {
  const store = cookies();
  const epoch = await getCustomerAuthEpoch();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
  store.set(customerPhoneCookie, phone, options);
  store.set(customerAuthCookie, epoch, options);
}

/** Clear the auth cookies (sign out). Route Handler only. */
export function clearCustomerAuthCookies() {
  const store = cookies();
  store.set(customerPhoneCookie, "", { path: "/", maxAge: 0 });
  store.set(customerAuthCookie, "", { path: "/", maxAge: 0 });
}
