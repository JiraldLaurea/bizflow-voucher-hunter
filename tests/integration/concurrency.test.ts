import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { generateCandidate, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

/**
 * These tests exercise the stock-control guarantees added with the SQLite
 * migration: conditional decrements + UNIQUE constraints must never over-issue.
 */
describe("concurrency / stock control", () => {
  beforeEach(() => {
    resetDb();
  });

  it("never draws a single-quantity pool more than its stock", () => {
    // slot_dinner_0705_2000 holds a 50% OFF pool (qty 1) and a Free Dessert pool (qty 7): 8 total.
    const slotId = "slot_dinner_0705_2000";
    const draws: string[] = [];
    // 12 distinct users contend for the same slot; excess draws must be refused, not over-issued.
    for (let i = 0; i < 12; i += 1) {
      const input = { campaignSlug: "july-dinner", slotId, phone: `+63917000${1000 + i}`, sessionId: `s${i}` };
      startHunt(input);
      try {
        draws.push(generateCandidate(input).displayLabel);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError); // pool exhausted -> E-POOL-EMPTY
      }
    }
    // Total draws capped at real stock (8); the single-quantity benefit appears at most once.
    expect(draws.length).toBe(8);
    expect(draws.filter((label) => label === "50% OFF").length).toBeLessThanOrEqual(1);

    const db = getDb();
    const total = (db.prepare("SELECT SUM(remaining_quantity) AS q FROM pools WHERE slot_id = ?").get(slotId) as { q: number }).q;
    expect(total).toBe(0);
  });

  it("issues at most one final voucher per phone even across many select attempts", () => {
    const input = {
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: "+639170000001",
      sessionId: "race",
      name: "Race User"
    };
    startHunt(input);
    const a = generateCandidate(input);
    const b = generateCandidate(input);
    const c = generateCandidate(input);

    selectFinalVoucher({ ...input, attemptId: a.id });
    // Every subsequent selection for the same phone must be rejected.
    for (const attemptId of [b.id, c.id, a.id]) {
      expect(() => selectFinalVoucher({ ...input, attemptId })).toThrow(AppError);
    }

    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) AS c FROM vouchers WHERE user_id = (SELECT id FROM users WHERE phone = ?)").get(
      "+639170000001"
    ) as { c: number };
    expect(count.c).toBe(1);
  });

  it("does not over-issue final vouchers beyond slot capacity", () => {
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
        startHunt(input);
        const candidate = generateCandidate(input);
        selectFinalVoucher({ ...input, attemptId: candidate.id });
        issued += 1;
      } catch (error) {
        // Once capacity is gone the slot is sold out and further starts/selects are refused.
        expect(error).toBeInstanceOf(AppError);
      }
    }
    expect(issued).toBe(2);

    const db = getDb();
    const slot = db.prepare("SELECT remaining_capacity, status FROM slots WHERE id = ?").get(slotId) as {
      remaining_capacity: number;
      status: string;
    };
    expect(slot.remaining_capacity).toBe(0);
    expect(slot.status).toBe("sold_out");
  });

  it("returns held stock to the pool when an unselected candidate is released", () => {
    const input = {
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: "+639170000009",
      sessionId: "release",
      name: "Release User"
    };
    const db = getDb();
    const before = (db.prepare("SELECT SUM(remaining_quantity) AS q FROM pools WHERE slot_id = ?").get(input.slotId) as {
      q: number;
    }).q;

    startHunt(input);
    const a = generateCandidate(input);
    generateCandidate(input);
    generateCandidate(input);
    selectFinalVoucher({ ...input, attemptId: a.id });

    // One benefit consumed (the selected one); the other two returned to pools.
    const after = (db.prepare("SELECT SUM(remaining_quantity) AS q FROM pools WHERE slot_id = ?").get(input.slotId) as {
      q: number;
    }).q;
    expect(after).toBe(before - 1);
  });
});
