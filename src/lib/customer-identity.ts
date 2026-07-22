// Shared customer (voucher-hunter) sign-in identity. Used by the single global
// /signin page and the per-campaign flow so they read/write the same storage.
//
// The phone is kept in localStorage (rich identity) AND mirrored to a cookie so
// the server can gate/redirect and render the signed-in state on first paint.

export const identityKey = "bizflow-identity";
// Set by the server ONLY after OTP verification (httpOnly), so a signed-in phone
// can't be forged by writing a cookie. See src/server/customer-auth.ts.
export const customerPhoneCookie = "bizflow_customer_phone";
// Companion auth marker holding the server auth epoch (also httpOnly, server-set
// at OTP verify). The gate requires it to be present and current; a data reset
// bumps the epoch, revoking every sign-in. New name so pre-OTP cookies from
// before this mechanism no longer satisfy the gate.
export const customerAuthCookie = "bizflow_cust_auth";
// Last verified customer session (campaign-scoped token), mirrored globally so
// the global /more wallet can load without re-entering a campaign flow.
export const customerSessionKey = "bizflow-customer-session";

export type StoredIdentity = { phone?: string; name?: string; email?: string };
export type StoredCustomerSession = { campaignSlug: string; token: string };

export function rememberCustomerSession(session: StoredCustomerSession) {
  try {
    window.localStorage.setItem(customerSessionKey, JSON.stringify(session));
  } catch {
    /* ignore storage errors */
  }
}

export function readCustomerSession(): StoredCustomerSession | null {
  try {
    const raw = window.localStorage.getItem(customerSessionKey);
    const parsed = raw ? (JSON.parse(raw) as StoredCustomerSession) : null;
    return parsed?.campaignSlug && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function forgetCustomerSession() {
  try {
    window.localStorage.removeItem(customerSessionKey);
  } catch {
    /* ignore storage errors */
  }
}

// Mirror of the server's normalizePhone (src/server/phone.ts): accept only real
// PH formats so the client never submits a number the server will reject.
export function isValidPhoneNumber(phone: string) {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  return /^\+639\d{9}$/.test(cleaned) || /^09\d{9}$/.test(cleaned) || /^639\d{9}$/.test(cleaned);
}

export function readStoredIdentity(): StoredIdentity | null {
  try {
    const raw = window.localStorage.getItem(identityKey);
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

// Local identity holds name/email/phone for the flow's convenience (it passes
// the phone in request bodies). It is NOT the auth cookie — the httpOnly auth
// cookies are set server-side only after OTP verification.
export function rememberIdentity(identity: { phone: string; name?: string; email?: string }) {
  try {
    window.localStorage.setItem(identityKey, JSON.stringify(identity));
  } catch {
    /* ignore storage errors */
  }
}

export function forgetIdentity() {
  try {
    window.localStorage.removeItem(identityKey);
  } catch {
    /* ignore storage errors */
  }
}
