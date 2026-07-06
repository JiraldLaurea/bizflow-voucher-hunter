import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:00:00+08:00"));
    resetDb();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    redeemVoucher({ codeOrToken: selected.voucher.voucherCode, staffName: "Staff Tester", purchaseAmount: 1200 });

    const metrics = dashboardMetrics("camp_july_dinner");
    const csv = exportCampaignCsv("camp_july_dinner");

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
