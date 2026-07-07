import { beforeEach, describe, expect, it } from "vitest";
import { getDb, one, resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { createCampaign, createPool, createSlot } from "@/server/admin";
import { generateCandidate, selectFinalVoucher, startHunt } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

async function setupCampaign(slug: string, slotCapacity: number, tiers: Array<{ label: string; qty: number; weight: number }>) {
  const campaign = await createCampaign({
    businessId: "biz_demo_shop",
    slug,
    title: slug,
    offerMessage: "x",
    heroImage: "#000",
    mode: "online_shop",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    baseAttempts: 3,
    referralDailyLimit: 5,
    candidateTimeoutMinutes: 10,
    terms: "t"
  });
  const slot = await createSlot(campaign.id, { date: "2026-08-05", startTime: "20:00", endTime: "22:00", totalCapacity: slotCapacity });
  for (const tier of tiers) {
    await createPool(campaign.id, {
      benefitType: "discount_percent",
      benefitValue: tier.label,
      displayLabel: tier.label,
      totalQuantity: tier.qty,
      probabilityWeight: tier.weight,
      expiryType: "days",
      expiryValue: 7,
      slotIds: [slot.id]
    });
  }
  return { slug, slotId: slot.id, campaignId: campaign.id };
}

describe("concurrency / stock control", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("never draws a single-quantity tier more than its campaign-wide stock", async () => {
    const { slug } = await setupCampaign("conc-rare", 100, [
      { label: "RARE", qty: 1, weight: 100 },
      { label: "COMMON", qty: 100, weight: 1 }
    ]);
    let rare = 0;
    for (let i = 0; i < 8; i += 1) {
      const base = { campaignSlug: slug, phone: `+63917000${1000 + i}`, sessionId: `s${i}` };
      await startHunt(base);
      if ((await generateCandidate(base)).displayLabel === "RARE") rare += 1;
    }
    expect(rare).toBeLessThanOrEqual(1);
  });

  it("issues at most one final voucher per phone even across many select attempts", async () => {
    const { slug, slotId } = await setupCampaign("conc-one", 100, [{ label: "20% OFF", qty: 10, weight: 10 }]);
    const phone = "+639170000001";
    const base = { campaignSlug: slug, phone, sessionId: "race" };
    await startHunt({ ...base, name: "Race User" });
    const a = await generateCandidate(base);
    const b = await generateCandidate(base);

    await selectFinalVoucher({ campaignSlug: slug, attemptId: a.id, slotId, phone, sessionId: "race", name: "Race User" });
    await expect(
      selectFinalVoucher({ campaignSlug: slug, attemptId: b.id, slotId, phone, sessionId: "race", name: "Race User" })
    ).rejects.toThrow(AppError);

    const db = await getDb();
    const count = await one(db, "SELECT COUNT(*) AS c FROM vouchers WHERE user_id = (SELECT id FROM users WHERE phone = ?)", [phone]);
    expect(Number(count.c)).toBe(1);
  });

  it("does not over-issue final vouchers beyond slot capacity", async () => {
    const { slug, slotId } = await setupCampaign("conc-cap", 2, [{ label: "20% OFF", qty: 100, weight: 10 }]);
    let issued = 0;
    for (let i = 0; i < 5; i += 1) {
      try {
        await huntAndSelect({ campaignSlug: slug, phone: `+63918000${2000 + i}`, sessionId: `cap${i}`, name: `Cap ${i}`, targetSlotId: slotId });
        issued += 1;
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    }
    expect(issued).toBe(2);

    const db = await getDb();
    const slot = await one(db, "SELECT remaining_capacity, status FROM slots WHERE id = ?", [slotId]);
    expect(Number(slot.remaining_capacity)).toBe(0);
    expect(slot.status).toBe("sold_out");
  });

  it("returns held tier stock when an unselected candidate is released", async () => {
    const db = await getDb();
    const totalQ = async () => Number((await one(db, "SELECT SUM(remaining_quantity) AS q FROM pools WHERE campaign_id = 'camp_july_dinner'", []))!.q);
    const before = await totalQ();
    await huntAndSelect({ campaignSlug: "july-dinner", phone: "+639170000009", name: "Release User", targetSlotId: "slot_dinner_0705_1900" });
    // 3 candidates each held 1 tier unit; selecting 1 releases the other 2. Net = -1.
    expect(await totalQ()).toBe(before - 1);
  });
});
