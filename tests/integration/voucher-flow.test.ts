import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { dashboardMetrics, exportCampaignCsv, redeemVoucher } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

describe("voucher hunt integration", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("supports the sign-in-first flow through dashboard and export", async () => {
    const selected = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639181111111",
      sessionId: "integration-session",
      name: "Integration User",
      guestCount: 4
    });
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
    expect(csv).toContain("Staff Tester");
    expect(csv).toContain("1200");
  });
});
