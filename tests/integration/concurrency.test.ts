import { beforeEach, describe, expect, it } from "vitest";
import { getDb, one, resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { generateCandidate, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

/**
 * These tests exercise the stock-control guarantees: conditional decrements +
 * UNIQUE constraints must never over-issue, even as data flows through the
 * async libSQL layer.
 */
describe("concurrency / stock control", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("never draws a single-quantity pool more than its stock", async () => {
    // slot_dinner_0705_2000 holds a 50% OFF pool (qty 1) and a Free Dessert pool (qty 7): 8 total.
    const slotId = "slot_dinner_0705_2000";
    const draws: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const input = { campaignSlug: "july-dinner", slotId, phone: `+63917000${1000 + i}`, sessionId: `s${i}` };
      await startHunt(input);
      try {
        draws.push((await generateCandidate(input)).displayLabel);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError); // pool exhausted -> E-POOL-EMPTY
      }
    }
    expect(draws.length).toBe(8);
    expect(draws.filter((label) => label === "50% OFF").length).toBeLessThanOrEqual(1);

    const db = await getDb();
    const total = await one(db, "SELECT SUM(remaining_quantity) AS q FROM pools WHERE slot_id = ?", [slotId]);
    expect(Number(total.q)).toBe(0);
  });

  it("issues at most one final voucher per phone even across many select attempts", async () => {
    const input = {
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: "+639170000001",
      sessionId: "race",
      name: "Race User"
    };
    await startHunt(input);
    const a = await generateCandidate(input);
    const b = await generateCandidate(input);
    const c = await generateCandidate(input);

    await selectFinalVoucher({ ...input, attemptId: a.id });
    for (const attemptId of [b.id, c.id, a.id]) {
      await expect(selectFinalVoucher({ ...input, attemptId })).rejects.toThrow(AppError);
    }

    const db = await getDb();
    const count = await one(db, "SELECT COUNT(*) AS c FROM vouchers WHERE user_id = (SELECT id FROM users WHERE phone = ?)", [
      "+639170000001"
    ]);
    expect(Number(count.c)).toBe(1);
  });

  it("does not over-issue final vouchers beyond slot capacity", async () => {
    // slot_dinner_0705_2000 has remaining_capacity 2.
    const slotId = "slot_dinner_0705_2000";
    let issued = 0;
    for (let i = 0; i < 5; i += 1) {
      const input = {
        campaignSlug: "july-dinner",
        slotId,
        phone: `+63918000${2000 + i}`,
        sessionId: `cap${i}`,
        name: `Cap ${i}`
      };
      try {
        await startHunt(input);
        const candidate = await generateCandidate(input);
        await selectFinalVoucher({ ...input, attemptId: candidate.id });
        issued += 1;
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    }
    expect(issued).toBe(2);

    const db = await getDb();
    const slot = await one(db, "SELECT remaining_capacity, status FROM slots WHERE id = ?", [slotId]);
    expect(Number(slot.remaining_capacity)).toBe(0);
    expect(slot.status).toBe("sold_out");
  });

  it("returns held stock to the pool when an unselected candidate is released", async () => {
    const input = {
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: "+639170000009",
      sessionId: "release",
      name: "Release User"
    };
    const db = await getDb();
    const before = Number((await one(db, "SELECT SUM(remaining_quantity) AS q FROM pools WHERE slot_id = ?", [input.slotId])).q);

    await startHunt(input);
    const a = await generateCandidate(input);
    await generateCandidate(input);
    await generateCandidate(input);
    await selectFinalVoucher({ ...input, attemptId: a.id });

    // One benefit consumed (the selected one); the other two returned to pools.
    const after = Number((await one(db, "SELECT SUM(remaining_quantity) AS q FROM pools WHERE slot_id = ?", [input.slotId])).q);
    expect(after).toBe(before - 1);
  });
});
