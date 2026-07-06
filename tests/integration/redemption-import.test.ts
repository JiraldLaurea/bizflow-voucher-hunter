import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { generateCandidate, importRedemptions, selectFinalVoucher, startHunt, validateVoucher } from "@/server/voucher-engine";

const base = { campaignSlug: "8pm-drop", slotId: "slot_shop_0705_2000", sessionId: "imp-session", name: "Import User" };

async function issueShopVoucher(phone: string) {
  const input = { ...base, phone };
  await startHunt(input);
  const candidate = await generateCandidate(input);
  return (await selectFinalVoucher({ ...input, attemptId: candidate.id })).voucher;
}

describe("redemption CSV import", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marks matching codes redeemed and reports per-row outcomes", async () => {
    const a = await issueShopVoucher("+639170005001");
    const b = await issueShopVoucher("+639170005002");

    const csv = ["voucher_code,purchase_amount", `${a.voucherCode},1500`, `${b.voucherCode},2000`, "BIZ-UNKNOWN,999"].join("\n");
    const result = await importRedemptions({ campaignId: "camp_8pm_drop", csv, staffName: "Ops" });

    expect(result.redeemed).toBe(2);
    expect(result.results.find((r) => r.code === a.voucherCode)?.status).toBe("redeemed");
    expect(result.results.find((r) => r.code === "BIZ-UNKNOWN")?.status).toBe("not_found");
    expect((await validateVoucher({ codeOrToken: a.voucherCode })).voucher.status).toBe("Redeemed");
  });

  it("reports already-redeemed codes on a second import", async () => {
    const a = await issueShopVoucher("+639170005003");
    const csv = `voucher_code\n${a.voucherCode}`;
    await importRedemptions({ campaignId: "camp_8pm_drop", csv, staffName: "Ops" });
    const second = await importRedemptions({ campaignId: "camp_8pm_drop", csv, staffName: "Ops" });
    expect(second.results[0].status).toBe("already_redeemed");
    expect(second.redeemed).toBe(0);
  });
});
