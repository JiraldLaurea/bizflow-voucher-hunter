import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { dashboardMetrics, markNoShow, redeemVoucher, rescheduleReservation } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

// Force issuance at slot_dinner_0705_1900 (offered by the 30%/20%/dessert tiers,
// at least one of which always appears among 3 distinct base draws).
const issue = (phone: string) =>
  huntAndSelect({ campaignSlug: "july-dinner", phone, name: "Lifecycle User", guestCount: 2, targetSlotId: "slot_dinner_0705_1900" });

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
    expect(newSlot.remainingCapacity).toBe(18 - 1); // target had capacity 18
    const metrics = await dashboardMetrics("camp_july_dinner");
    const oldPerf = metrics.slotPerformance.find((s) => s.slot.id === slot.id)!;
    expect(oldPerf.slot.remainingCapacity).toBe(20); // original slot_1900 seat returned
  });

  it("rejects rescheduling onto a sold-out slot", async () => {
    const { voucher } = await issue("+639170000005");
    await expect(
      rescheduleReservation({ codeOrToken: voucher.voucherCode, newSlotId: "slot_dinner_0706_1900" })
    ).rejects.toThrow(AppError);
  });
});
