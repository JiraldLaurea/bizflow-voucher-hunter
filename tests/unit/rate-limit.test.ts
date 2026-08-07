import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";

function req(ip: string) {
  return new Request("http://test.local/api", { headers: { "x-forwarded-for": ip } });
}

describe("rate limiting", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("allows requests up to the limit then blocks with a 429 AppError", async () => {
    const r = req("9.9.9.9");
    for (let i = 0; i < 3; i += 1) {
      await enforceRateLimit(r, "unit/test", { limit: 3, windowMs: 60_000 });
    }
    try {
      await enforceRateLimit(r, "unit/test", { limit: 3, windowMs: 60_000 });
      throw new Error("expected rate limit to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(429);
      expect((error as AppError).code).toBe("E-RATE-LIMIT");
    }
  });

  it("tracks limits independently per IP", async () => {
    await enforceRateLimit(req("1.1.1.1"), "u", { limit: 1, windowMs: 60_000 });
    await expect(enforceRateLimit(req("1.1.1.1"), "u", { limit: 1, windowMs: 60_000 })).rejects.toThrow(AppError);
    // A different IP has its own budget.
    await expect(enforceRateLimit(req("2.2.2.2"), "u", { limit: 1, windowMs: 60_000 })).resolves.toBeUndefined();
  });

  it("tracks limits independently per route", async () => {
    await enforceRateLimit(req("3.3.3.3"), "route-a", { limit: 1, windowMs: 60_000 });
    await expect(enforceRateLimit(req("3.3.3.3"), "route-b", { limit: 1, windowMs: 60_000 })).resolves.toBeUndefined();
  });

  it("takes the last x-forwarded-for hop and falls back to unknown", () => {
    // This asserted the FIRST hop, which is the entry a caller supplies: anyone
    // could send `x-forwarded-for: 5.6.7.8` and pick their own bucket, rotating
    // it per request to erase every limit in the app. The rightmost entry is the
    // one our own proxy appended, so that is the one to key on.
    expect(clientIp(new Request("http://t", { headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1" } }))).toBe("10.0.0.1");
    expect(clientIp(new Request("http://t"))).toBe("unknown");
  });

  it("gives a subject its own budget, separate from the caller's address", async () => {
    // Money and credential endpoints limit on both. An attacker spread across
    // addresses still shares one budget against the account they are attacking.
    await enforceRateLimit(req("4.4.4.4"), "u2", { limit: 1, windowMs: 60_000, subject: "+639170000001" });
    await expect(
      enforceRateLimit(req("5.5.5.5"), "u2", { limit: 1, windowMs: 60_000, subject: "+639170000001" }),
    ).rejects.toThrow(AppError);
    await expect(
      enforceRateLimit(req("4.4.4.4"), "u2", { limit: 1, windowMs: 60_000, subject: "+639170000002" }),
    ).resolves.toBeUndefined();
  });
});
