import crypto from "node:crypto";
import { one, run, withTx } from "@/server/db";
import { AppError } from "@/server/errors";

const rlId = () => `rl_${crypto.randomBytes(6).toString("hex")}`;

/** Hashes the client IP so the rate-limit table never stores raw addresses. */
function hashIp(ip: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.ADMIN_ACCESS_TOKEN ?? "bizflow-rate-limit";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Best-effort client IP from common proxy headers (Vercel/NGINX set these). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitOptions = { limit?: number; windowMs?: number };

/**
 * Fixed-window IP rate limiter backed by the `rate_events` table. Throws
 * AppError E-RATE-LIMIT (HTTP 429) once `limit` requests for the same
 * route+IP have occurred inside `windowMs`. Old events are pruned lazily.
 */
export async function enforceRateLimit(request: Request, route: string, options: RateLimitOptions = {}) {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const key = `${route}:${hashIp(clientIp(request))}`;
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
