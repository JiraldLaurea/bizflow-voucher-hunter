import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import {
  dashboardMetrics,
  exportCampaignCsv,
  generateCandidate,
  listCampaignSlots,
  redeemVoucher,
  selectFinalVoucher,
  startHunt
} from "@/server/voucher-engine";

describe("voucher hunt integration", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("supports the restaurant date/time-first flow through dashboard and export", async () => {
    const slots = await listCampaignSlots("july-dinner");
    const activeSlot = slots.find((slot) => slot.status === "active" && slot.remainingCapacity > 0);
    expect(activeSlot).toBeDefined();

    const input = {
      campaignSlug: "july-dinner",
      slotId: activeSlot!.id,
      phone: "+639181111111",
      sessionId: "integration-session",
      name: "Integration User",
      email: "integration@example.com"
    };

    await startHunt(input);
    const candidate = await generateCandidate(input);
    await generateCandidate(input);
    await generateCandidate(input);
    const selected = await selectFinalVoucher({ ...input, attemptId: candidate.id, guestCount: 4 });
    await redeemVoucher({ codeOrToken: selected.voucher.voucherCode, staffName: "Staff Tester", purchaseAmount: 1200 });

    const metrics = await dashboardMetrics("camp_july_dinner");
    const csv = await exportCampaignCsv("camp_july_dinner");

    expect(selected.voucher.voucherCode).toContain("BIZ-");
    expect(metrics.summary.finalVouchersIssued).toBe(1);

    expect(csv).toContain("# LEADS");
    expect(csv).toContain("# VOUCHERS");
    expect(csv).toContain("# ATTEMPTS");
    expect(csv).toContain("# REDEMPTIONS");
    expect(csv).toContain(selected.voucher.voucherCode);
    expect(csv).toContain("Integration User");
    expect(csv).toContain("+639181111111");
    expect(csv).toContain(candidate.id);
    expect(csv).toContain("Staff Tester");
    expect(csv).toContain("1200");
  });
});
