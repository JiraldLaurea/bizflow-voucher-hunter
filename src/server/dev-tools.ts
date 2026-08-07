import { AppError } from "@/server/errors";

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
