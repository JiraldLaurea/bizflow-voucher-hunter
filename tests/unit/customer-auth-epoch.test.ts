import { beforeEach, describe, expect, it } from "vitest";
import { getCustomerAuthEpoch, resetDb } from "@/server/db";

// The customer auth epoch is how a data reset revokes sign-ins on every device:
// sign-in stamps the current epoch into the cookie, the server gates reject a
// stale one. So the only invariant that matters is that a reset advances it.
describe("customer auth epoch", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("advances on every reset, so previously issued sign-ins go stale", async () => {
    const first = await getCustomerAuthEpoch();
    expect(Number(first)).toBeGreaterThanOrEqual(1);

    await resetDb();
    const second = await getCustomerAuthEpoch();
    expect(Number(second)).toBe(Number(first) + 1);

    await resetDb();
    const third = await getCustomerAuthEpoch();
    expect(Number(third)).toBe(Number(second) + 1);
  });
});
