import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { generateCandidate, redeemVoucher, selectFinalVoucher, startHunt, validateVoucher } from "@/server/voucher-engine";

const baseInput = {
  campaignSlug: "july-dinner",
  slotId: "slot_dinner_0705_1900",
  phone: "+639171234567",
  sessionId: "test-session",
  name: "Jane Doe",
  email: "jane@example.com"
};

describe("voucher engine", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("generates exactly three base candidates and blocks the fourth", async () => {
    await startHunt(baseInput);
    const first = await generateCandidate(baseInput);
    const second = await generateCandidate(baseInput);
    const third = await generateCandidate(baseInput);

    expect([first, second, third]).toHaveLength(3);
    await expect(generateCandidate(baseInput)).rejects.toThrow(AppError);
  });

  it("issues one final voucher and blocks duplicate final issue for the same phone", async () => {
    await startHunt(baseInput);
    const first = await generateCandidate(baseInput);
    await generateCandidate(baseInput);
    await generateCandidate(baseInput);

    const issued = await selectFinalVoucher({ ...baseInput, attemptId: first.id, guestCount: 2 });

    expect(issued.voucher.voucherCode).toMatch(/^BIZ-/);
    expect(issued.voucher.status).toBe("Issued");
    await expect(startHunt({ ...baseInput, sessionId: "another-session" })).rejects.toThrow(AppError);
  });

  it("validates and redeems an issued voucher", async () => {
    await startHunt(baseInput);
    const candidate = await generateCandidate(baseInput);
    const issued = await selectFinalVoucher({ ...baseInput, attemptId: candidate.id, guestCount: 2 });

    const validation = await validateVoucher({ codeOrToken: issued.voucher.voucherCode });
    expect(validation.voucher.status).toBe("Issued");

    const redeemed = await redeemVoucher({
      codeOrToken: issued.voucher.voucherCode,
      staffName: "Front Desk",
      purchaseAmount: 2200
    });

    expect(redeemed.voucher.status).toBe("Redeemed");
    await expect(
      redeemVoucher({
        codeOrToken: issued.voucher.voucherCode,
        staffName: "Front Desk"
      })
    ).rejects.toThrow(AppError);
  });
});
