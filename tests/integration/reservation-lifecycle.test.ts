import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  dashboardMetrics,
  generateCandidate,
  markNoShow,
  redeemVoucher,
  rescheduleReservation,
  selectFinalVoucher,
  startHunt
} from "@/server/voucher-engine";

const base = {
  campaignSlug: "july-dinner",
  slotId: "slot_dinner_0705_1900",
  sessionId: "life-session",
  name: "Lifecycle User"
};

async function issue(phone: string, slotId = base.slotId) {
  const input = { ...base, slotId, phone };
  await startHunt(input);
  const candidate = await generateCandidate(input);
  return selectFinalVoucher({ ...input, attemptId: candidate.id, guestCount: 2 });
}

describe("no-show", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marks a reserved booking and its voucher as no-show and counts it", async () => {
    const { voucher } = await issue("+639170000001");
    const result = await markNoShow({ codeOrToken: voucher.voucherCode, staffName: "Host" });
    expect(result.status).toBe("No-show");
    expect((await dashboardMetrics("camp_july_dinner")).summary.noShows).toBe(1);
  });

  it("cannot mark a redeemed voucher as no-show", async () => {
    const { voucher } = await issue("+639170000002");
    await redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "Front Desk" });
    await expect(markNoShow({ codeOrToken: voucher.voucherCode })).rejects.toThrow(AppError);
  });
});

describe("reschedule", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("moves an issued reservation to another active slot and transfers capacity", async () => {
    const { voucher, slot } = await issue("+639170000003");
    const target = "slot_dinner_0707_1900";
    const { voucher: moved, newSlot } = await rescheduleReservation({ codeOrToken: voucher.voucherCode, newSlotId: target });
    expect(moved.slotId).toBe(target);
    // Old slot regained a seat, new slot lost one.
    expect(newSlot.remainingCapacity).toBe(18 - 1);
    const metrics = await dashboardMetrics("camp_july_dinner");
    const oldPerf = metrics.slotPerformance.find((s) => s.slot.id === slot.id)!;
    expect(oldPerf.slot.remainingCapacity).toBe(20); // seat returned
  });

  it("rejects rescheduling to the same slot", async () => {
    const { voucher } = await issue("+639170000004");
    await expect(rescheduleReservation({ codeOrToken: voucher.voucherCode, newSlotId: base.slotId })).rejects.toThrow(AppError);
  });

  it("rejects rescheduling onto a sold-out slot", async () => {
    const { voucher } = await issue("+639170000005");
    // slot_dinner_0706_1900 is seeded sold_out.
    await expect(
      rescheduleReservation({ codeOrToken: voucher.voucherCode, newSlotId: "slot_dinner_0706_1900" })
    ).rejects.toThrow(AppError);
  });
});
