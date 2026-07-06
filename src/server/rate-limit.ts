import crypto from "node:crypto";
import { getDb } from "@/server/db";
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
export function enforceRateLimit(request: Request, route: string, options: RateLimitOptions = {}) {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const db = getDb();
  const key = `${route}:${hashIp(clientIp(request))}`;
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  db.transaction(() => {
    db.prepare("DELETE FROM rate_events WHERE bucket_key = ? AND created_at < ?").run(key, windowStart);
    const count = (
      db.prepare("SELECT COUNT(*) AS c FROM rate_events WHERE bucket_key = ? AND created_at >= ?").get(key, windowStart) as {
        c: number;
      }
    ).c;
    if (count >= limit) {
      throw new AppError("E-RATE-LIMIT", "Too many requests. Please slow down and try again shortly.", 429);
    }
    db.prepare("INSERT INTO rate_events (id, bucket_key, created_at) VALUES (?, ?, ?)").run(rlId(), key, new Date().toISOString());
  })();
}
