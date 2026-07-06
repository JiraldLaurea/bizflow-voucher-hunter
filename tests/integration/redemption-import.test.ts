import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { generateCandidate, importRedemptions, selectFinalVoucher, startHunt, validateVoucher } from "@/server/voucher-engine";

const base = { campaignSlug: "8pm-drop", slotId: "slot_shop_0705_2000", sessionId: "imp-session", name: "Import User" };

function issueShopVoucher(phone: string) {
  const input = { ...base, phone };
  startHunt(input);
  const candidate = generateCandidate(input);
  return selectFinalVoucher({ ...input, attemptId: candidate.id }).voucher;
}

describe("redemption CSV import", () => {
  beforeEach(() => resetDb());

  it("marks matching codes redeemed and reports per-row outcomes", () => {
    const a = issueShopVoucher("+639170005001");
    const b = issueShopVoucher("+639170005002");

    const csv = ["voucher_code,purchase_amount", `${a.voucherCode},1500`, `${b.voucherCode},2000`, "BIZ-UNKNOWN,999"].join("\n");
    const result = importRedemptions({ campaignId: "camp_8pm_drop", csv, staffName: "Ops" });

    expect(result.redeemed).toBe(2);
    expect(result.results.find((r) => r.code === a.voucherCode)?.status).toBe("redeemed");
    expect(result.results.find((r) => r.code === "BIZ-UNKNOWN")?.status).toBe("not_found");
    expect(validateVoucher({ codeOrToken: a.voucherCode }).voucher.status).toBe("Redeemed");
  });

  it("reports already-redeemed codes on a second import", () => {
    const a = issueShopVoucher("+639170005003");
    const csv = `voucher_code\n${a.voucherCode}`;
    importRedemptions({ campaignId: "camp_8pm_drop", csv, staffName: "Ops" });
    const second = importRedemptions({ campaignId: "camp_8pm_drop", csv, staffName: "Ops" });
    expect(second.results[0].status).toBe("already_redeemed");
    expect(second.redeemed).toBe(0);
  });
});
