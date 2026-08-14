import { AppError } from "@/server/errors";
import { normalizePhone } from "@/server/phone";

/**
 * The single gate for every tool that mints value, forces an outcome, or bypasses
 * a real rule: LP grants, forced roulette pools, hunt resets, statement
 * backdating, the bootstrap login fallback, and the OTP code echo.
 *
 * Fails closed. The previous gate was `process.env.NODE_ENV !== "production"`,
 * which is only safe when NODE_ENV is guaranteed to be exactly "production" in
 * every deployment target. It is not: a preview deploy, a standalone `next
 * start` with the variable unset, or a host that sets "staging" all read as
 * not-production and would have opened free LP, a predictable draw, and a
 * published-password super-admin login to the internet.
 *
 * So the rule is inverted — a recognised development environment, or an explicit
 * opt-in, and never in production regardless of either:
 *
 *   NODE_ENV=development | test        enabled (local work and the test suite)
 *   ENABLE_DEV_TOOLS=true              enabled, for a shared demo/staging box
 *   NODE_ENV=production                disabled, even with ENABLE_DEV_TOOLS=true
 *   anything else (unset, preview, …)  disabled
 */
export function devToolsEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ENABLE_DEV_TOOLS === "true") return true;
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

/** Guard for a route or server function that must never run against real money. */
export function assertDevToolsEnabled(what: string) {
  if (devToolsEnabled()) return;
  throw new AppError("E-DEV-ONLY", `${what} is a development-only tool`, 403);
}

/**
 * The production developer account.
 *
 * `devToolsEnabled()` above is all-or-nothing per deployment and never opens in
 * production, which leaves no way to exercise a hunt against the live database.
 * DEV_ACCOUNT_PHONE names one customer number that carries the hunt tools with
 * it into production:
 *
 *   POST /api/public/hunt/reset                clears its own hunt, returns stock
 *   POST /api/public/hunt/dev-refresh-vouchers re-dates its own bookings
 *   devPoolId on /api/public/hunt/attempt      forces its own next draw
 *
 * Every one of those is scoped to the caller's own phone and is reversible.
 * Deliberately NOT included are the tools that move money — LP grants, simulated
 * checkout scans, simulated collection — because those write rows a real partner is
 * billed for. They stay on `devToolsEnabled()` and refuse in production for
 * everyone, this account included.
 *
 * Inert unless the var is set to a valid PH mobile number, and it grants no
 * admin/dashboard rights: this is an ordinary customer account with the hunt
 * tools switched on. Unset the var to revoke — it is read per request, so no
 * redeploy is needed.
 */
function devAccountPhone(): string | null {
  const configured = process.env.DEV_ACCOUNT_PHONE?.trim();
  return configured ? normalizePhone(configured) : null;
}

/** True when `phone` is the configured developer account. Format-insensitive. */
function isDevAccountPhone(phone: string | null | undefined): boolean {
  const account = devAccountPhone();
  if (!account || !phone) return false;
  return normalizePhone(phone) === account;
}

/**
 * The hunt-tool gate: open where the whole deployment is a dev environment, or
 * for the one developer account anywhere — including production.
 */
export function devToolsEnabledFor(phone: string | null | undefined): boolean {
  return devToolsEnabled() || isDevAccountPhone(phone);
}

/**
 * Whether anyone at all could pass `devToolsEnabledFor` on this deployment.
 *
 * Resolving a session costs a database read, and on a production deploy with no
 * developer account configured the answer is always no — so callers on a hot
 * path (the roulette's pool list, drawn on every spin) check this first and skip
 * looking up who is asking.
 */
export function devToolsPossible(): boolean {
  return devToolsEnabled() || devAccountPhone() !== null;
}

/** Guard for a self-scoped hunt tool the developer account may run in production. */
export function assertDevToolsEnabledFor(phone: string | null | undefined, what: string) {
  if (devToolsEnabledFor(phone)) return;
  throw new AppError("E-DEV-ONLY", `${what} is a development-only tool`, 403);
}
