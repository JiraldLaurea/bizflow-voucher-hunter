import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "@/lib/admin-session";
import { createAdminUser } from "@/server/admin-users";
import { all, getDb, one, resetDb, run } from "@/server/db";
import { POST as resetDashboard } from "@/app/api/dashboard/reset/route";

/**
 * The second Danger Zone action: the same destruction as Reset & Reseed, but the
 * database is left empty for a real install instead of reloading the demo data.
 */
describe("dashboard wipe (reset without reseed)", () => {
  beforeEach(async () => {
    process.env.ADMIN_SESSION_SECRET =
      "test-only-admin-session-secret-with-more-than-32-characters";
    await resetDb();
    await run(await getDb(), "DELETE FROM admin_users");
  });

  async function post(body?: unknown) {
    const token = await createAdminSession({
      email: "owner@example.com",
      name: "Owner",
      role: "super_admin",
      businessIds: ["*"],
    });
    return resetDashboard(
      new Request("http://localhost/api/dashboard/reset", {
        method: "POST",
        headers: {
          cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }

  async function countOf(table: string) {
    const row = await one(await getDb(), `SELECT COUNT(*) AS total FROM ${table}`);
    return Number(row?.total ?? -1);
  }

  it("empties the data tables without reloading the seed", async () => {
    expect(await countOf("businesses")).toBeGreaterThan(0);

    const response = await post({ mode: "wipe" });
    expect(response.status).toBe(200);

    for (const table of ["businesses", "campaigns", "pools", "slots", "users", "reward_products"]) {
      expect(await countOf(table)).toBe(0);
    }
  });

  it("keeps super admins and removes the logins scoped to wiped businesses", async () => {
    await createAdminUser({
      email: "owner@example.com",
      name: "Owner",
      role: "super_admin",
      password: "correct-horse-battery",
      businessIds: [],
    });
    await createAdminUser({
      email: "manager@example.com",
      name: "Manager",
      role: "admin",
      password: "correct-horse-battery",
      businessIds: [],
    });
    await createAdminUser({
      email: "counter@example.com",
      name: "Counter",
      role: "staff",
      password: "correct-horse-battery",
      businessIds: ["biz_demo_restaurant"],
    });

    await post({ mode: "wipe" });

    const remaining = await all(await getDb(), "SELECT email, role FROM admin_users");
    expect(remaining.map((row) => `${row.email} (${row.role})`)).toEqual([
      "owner@example.com (super_admin)",
    ]);
  });

  it("marks the emptiness as deliberate, and a later reseed clears the mark", async () => {
    await post({ mode: "wipe" });
    const flagged = await one(
      await getDb(),
      "SELECT value FROM meta WHERE key = 'seed_suppressed'",
    );
    expect(String(flagged?.value)).toBe("1");

    await resetDb();
    const cleared = await one(
      await getDb(),
      "SELECT value FROM meta WHERE key = 'seed_suppressed'",
    );
    expect(cleared).toBeUndefined();
    expect(await countOf("businesses")).toBeGreaterThan(0);
  });

  it("still reseeds when no mode is given, so older callers are unaffected", async () => {
    await post({ mode: "wipe" });
    expect(await countOf("businesses")).toBe(0);

    const response = await post();
    expect(response.status).toBe(200);
    expect(await countOf("businesses")).toBeGreaterThan(0);
  });

  it("rejects an unrecognised mode rather than guessing", async () => {
    const response = await post({ mode: "destroy" });
    expect(response.status).toBe(400);
    expect(await countOf("businesses")).toBeGreaterThan(0);
  });
});
