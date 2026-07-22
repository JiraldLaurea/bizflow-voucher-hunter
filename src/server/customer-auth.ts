import { cookies } from "next/headers";
import { customerAuthCookie, customerPhoneCookie } from "@/lib/customer-identity";
import { getCustomerAuthEpoch } from "@/server/db";
import { AppError } from "@/server/errors";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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
export async function getSignedInCustomerPhone(): Promise<string | null> {
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
export async function requireSignedInCustomerPhone(): Promise<string> {
  const phone = await getSignedInCustomerPhone();
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
