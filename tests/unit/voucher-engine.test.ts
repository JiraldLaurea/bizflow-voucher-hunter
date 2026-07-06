import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:00:00+08:00"));
    resetDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates exactly three base candidates and blocks the fourth", () => {
    startHunt(baseInput);
    const first = generateCandidate(baseInput);
    const second = generateCandidate(baseInput);
    const third = generateCandidate(baseInput);

    expect([first, second, third]).toHaveLength(3);
    expect(() => generateCandidate(baseInput)).toThrow(AppError);
  });

  it("issues one final voucher and blocks duplicate final issue for the same phone", () => {
    startHunt(baseInput);
    const first = generateCandidate(baseInput);
    generateCandidate(baseInput);
    generateCandidate(baseInput);

    const issued = selectFinalVoucher({ ...baseInput, attemptId: first.id, guestCount: 2 });

    expect(issued.voucher.voucherCode).toMatch(/^BIZ-/);
    expect(issued.voucher.status).toBe("Issued");
    expect(() => startHunt({ ...baseInput, sessionId: "another-session" })).toThrow(AppError);
  });

  it("validates and redeems an issued voucher", () => {
    startHunt(baseInput);
    const candidate = generateCandidate(baseInput);
    const issued = selectFinalVoucher({ ...baseInput, attemptId: candidate.id, guestCount: 2 });

    const validation = validateVoucher({ codeOrToken: issued.voucher.voucherCode });
    expect(validation.voucher.status).toBe("Issued");

    const redeemed = redeemVoucher({
      codeOrToken: issued.voucher.voucherCode,
      staffName: "Front Desk",
      purchaseAmount: 2200
    });

    expect(redeemed.voucher.status).toBe("Redeemed");
    expect(() =>
      redeemVoucher({
        codeOrToken: issued.voucher.voucherCode,
        staffName: "Front Desk"
      })
    ).toThrow(AppError);
  });
});
