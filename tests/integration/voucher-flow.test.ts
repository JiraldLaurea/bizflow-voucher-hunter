import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { dashboardMetrics, exportCampaignCsv, generateCandidate, listCampaignSlots, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

describe("voucher hunt integration", () => {
  beforeEach(() => {
    resetDb();
  });

  it("supports the restaurant date/time-first flow through dashboard and export", () => {
    const slots = listCampaignSlots("july-dinner");
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

    startHunt(input);
    const candidate = generateCandidate(input);
    generateCandidate(input);
    generateCandidate(input);
    const selected = selectFinalVoucher({ ...input, attemptId: candidate.id, guestCount: 4 });

    const metrics = dashboardMetrics("camp_july_dinner");
    const csv = exportCampaignCsv("camp_july_dinner");

    expect(selected.voucher.voucherCode).toContain("BIZ-");
    expect(metrics.summary.finalVouchersIssued).toBe(1);
    expect(csv).toContain(selected.voucher.voucherCode);
    expect(csv).toContain("Integration User");
  });
});
