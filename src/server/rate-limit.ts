import crypto from "node:crypto";
import { one, run, withTx } from "@/server/db";
import { AppError } from "@/server/errors";

const rlId = () => `rl_${crypto.randomBytes(6).toString("hex")}`;

/** Hashes the client IP so the rate-limit table never stores raw addresses. */
function hashIp(ip: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.ADMIN_ACCESS_TOKEN ?? "bizflow-rate-limit";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * How many proxies sit between the internet and this app. Only the entries
 * appended by those hops can be trusted; everything to their left was supplied
 * by the caller. One hop is right for Vercel and for a single nginx/Cloudflare
 * in front of the app — raise it only if you actually run more.
 */
const TRUSTED_PROXY_HOPS = Math.max(
  1,
  Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1,
);

/**
 * The client address, taken from the hop we actually trust.
 *
 * `X-Forwarded-For` is append-only and fully caller-controlled on the left: a
 * client that sends `X-Forwarded-For: 1.2.3.4` makes that the first entry, and
 * the proxy appends the real address after it. Reading `split(",")[0]` — which
 * is what this did — therefore let anyone pick their own rate-limit bucket and
 * rotate it per request, which nullified every limiter in the app, including the
 * one standing between an attacker and a six-digit OTP.
 *
 * Counting from the right instead pins us to the address our own edge observed.
 * `x-vercel-forwarded-for` is preferred where present because the platform
 * overwrites rather than appends it.
 */
export function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const last = vercel.split(",").pop()?.trim();
    if (last) return last;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      // The rightmost entry was added by the hop closest to us; step left once
      // per additional trusted proxy. Never fall past the leftmost entry into
      // caller-controlled territory — clamp to index 0 instead.
      const index = Math.max(0, hops.length - TRUSTED_PROXY_HOPS);
      return hops[index]!;
    }
  }

  // Set by the platform, not appended to, so it cannot carry a caller's value
  // past our edge the way X-Forwarded-For can.
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  /**
   * Counts against the subject instead of the caller's address. Pass the thing
   * being attacked — a phone number, a wallet, a login email — so an attacker
   * spread across many addresses still shares one budget, and so a victim
   * cannot be locked out by someone else's traffic on their own address.
   */
  subject?: string;
};

/**
 * Fixed-window rate limiter backed by the `rate_events` table. Throws AppError
 * E-RATE-LIMIT (HTTP 429) once `limit` requests for the same route+subject have
 * occurred inside `windowMs`. Old events are pruned lazily.
 *
 * Anything guarding money or credentials should be limited twice: once by
 * address (this function's default) and once by subject, because neither alone
 * is sufficient. An address is cheap to rotate; a subject is shared by every
 * honest user behind one NAT.
 */
export async function enforceRateLimit(request: Request, route: string, options: RateLimitOptions = {}) {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const identity =
    options.subject === undefined
      ? hashIp(clientIp(request))
      : `s:${hashIp(options.subject)}`;
  const key = `${route}:${identity}`;
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  await withTx(async (tx) => {
    await run(tx, "DELETE FROM rate_events WHERE bucket_key = ? AND created_at < ?", [key, windowStart]);
    const row = await one(tx, "SELECT COUNT(*) AS c FROM rate_events WHERE bucket_key = ? AND created_at >= ?", [key, windowStart]);
    if (Number(row.c) >= limit) {
      throw new AppError("E-RATE-LIMIT", "Too many requests. Please slow down and try again shortly.", 429);
    }
    await run(tx, "INSERT INTO rate_events (id, bucket_key, created_at) VALUES (?, ?, ?)", [rlId(), key, new Date().toISOString()]);
  });
}
