import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { generateCandidate, listSlotsForAttempt, redeemVoucher, selectFinalVoucher, startHunt, validateVoucher } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

const base = { campaignSlug: "july-dinner", phone: "+639171234567", sessionId: "test-session" };

describe("voucher engine (hunt-first flow)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("generates exactly three base candidates and blocks the fourth", async () => {
    await startHunt({ ...base, name: "Jane Doe" });
    const first = await generateCandidate(base);
    const second = await generateCandidate(base);
    const third = await generateCandidate(base);

    expect([first, second, third]).toHaveLength(3);
    expect(first.slotId).toBeUndefined(); // no slot chosen at hunt time
    await expect(generateCandidate(base)).rejects.toThrow(AppError);
  });

  it("allows choosing a specific campaign voucher outside production", async () => {
    await startHunt({ ...base, name: "Jane Doe" });
    const candidate = await generateCandidate({
      ...base,
      devPoolId: "pool_dinner_90",
    });

    expect(candidate.poolId).toBe("pool_dinner_90");
    expect(candidate.displayLabel).toBe("90% OFF");
  });

  it("lists rarity-gated slots for the chosen candidate", async () => {
    await startHunt({ ...base, name: "Jane Doe" });
    const candidate = await generateCandidate(base);
    const { slots } = await listSlotsForAttempt({ campaignSlug: "july-dinner", phone: base.phone, attemptId: candidate.id });
    expect(slots.length).toBeGreaterThan(0);
    // A 90% OFF winner is offered at exactly one (off-peak) slot; commons at more.
    if (candidate.displayLabel === "90% OFF") {
      expect(slots).toHaveLength(1);
      expect(slots[0].startTime).toBe("14:00");
    }
  });

  it("issues one final voucher and blocks a duplicate for the same phone", async () => {
    const issued = await huntAndSelect({ ...base, name: "Jane Doe", guestCount: 2 });
    expect(issued.voucher.voucherCode).toMatch(/^BIZ-/);
    expect(issued.voucher.status).toBe("Issued");
    expect(issued.voucher.slotId).toBe(issued.slot.id);
    // The holder can still sign in (to view their voucher)...
    const state = await startHunt({ ...base, sessionId: "another-session" });
    expect(state.voucher?.voucherCode).toBe(issued.voucher.voucherCode);
    // ...but cannot hunt for a second voucher.
    await expect(generateCandidate({ ...base, sessionId: "another-session" })).rejects.toThrow(AppError);
  });

  it("rejects a slot that does not offer the chosen tier", async () => {
    await startHunt({ ...base, name: "Jane Doe" });
    const candidate = await generateCandidate(base);
    const { slots } = await listSlotsForAttempt({ campaignSlug: "july-dinner", phone: base.phone, attemptId: candidate.id });
    const allSlotIds = ["slot_dinner_0705_1400", "slot_dinner_0705_1900", "slot_dinner_0705_2000", "slot_dinner_0707_1900"];
    const forbidden = allSlotIds.find((id) => !slots.some((s) => s.id === id));
    if (forbidden) {
      await expect(
        selectFinalVoucher({ ...base, attemptId: candidate.id, slotId: forbidden, name: "Jane Doe" })
      ).rejects.toThrow(AppError);
    }
  });

  it("validates and redeems an issued voucher", async () => {
    const issued = await huntAndSelect({ ...base, name: "Jane Doe", guestCount: 2 });

    const validation = await validateVoucher({ codeOrToken: issued.voucher.voucherCode });
    expect(validation.voucher.status).toBe("Issued");

    const redeemed = await redeemVoucher({ codeOrToken: issued.voucher.voucherCode, staffName: "Front Desk", purchaseAmount: 2200 });
    expect(redeemed.voucher.status).toBe("Redeemed");
    await expect(redeemVoucher({ codeOrToken: issued.voucher.voucherCode, staffName: "Front Desk" })).rejects.toThrow(AppError);
  });
});
