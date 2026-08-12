import { beforeEach, describe, expect, it } from "vitest";
import { RARITY_WEIGHTS } from "@bizflow/shared";
import { createCampaign, createPool, createSlot, listPools } from "@/server/admin";
import { getDb, one, resetDb } from "@/server/db";
import { generateCandidate, startHunt } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

async function setupCampaign(slug: string, rarity: "standard" | "rare" | "epic" | "legendary") {
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
  const slot = await createSlot(campaign.id, {
    date: "2026-08-05",
    startTime: "20:00",
    endTime: "22:00",
    totalCapacity: 50
  });
  const pool = await createPool(campaign.id, {
    benefitType: "free_item",
    benefitValue: "dessert",
    displayLabel: "Free Dessert",
    totalQuantity: 50,
    rarity,
    slotIds: [slot.id]
  });
  return { campaignId: campaign.id, slug, pool };
}

describe("rarity", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("derives the draw weight from the chosen rarity", async () => {
    const { pool } = await setupCampaign("rarity-weight", "legendary");
    expect(pool.rarity).toBe("legendary");
    expect(pool.probabilityWeight).toBe(RARITY_WEIGHTS.legendary);
  });

  it("gives each rarity its own weight", async () => {
    for (const rarity of ["standard", "rare", "epic", "legendary"] as const) {
      const { pool } = await setupCampaign(`rarity-each-${rarity}`, rarity);
      expect(pool.probabilityWeight).toBe(RARITY_WEIGHTS[rarity]);
    }
  });

  it("carries the tier's rarity onto the candidate and the issued voucher", async () => {
    // A free item derives as "rare" under the old rule, so picking legendary
    // here proves the stored value is what travels rather than the derivation.
    const { slug } = await setupCampaign("rarity-carried", "legendary");
    const base = { campaignSlug: slug, phone: "+639172220001", sessionId: "rarity" };
    await startHunt({ ...base, name: "Rarity User" });
    expect((await generateCandidate(base)).rarity).toBe("legendary");

    const { voucher } = await huntAndSelect({
      campaignSlug: slug,
      phone: "+639172220002"
    });
    expect(voucher.rarity).toBe("legendary");

    const row = await one(await getDb(), "SELECT rarity FROM vouchers WHERE id = ?", [voucher.id]);
    expect(row?.rarity).toBe("legendary");
  });

  it("keeps the rarity readable back off the stored pool", async () => {
    const { campaignId } = await setupCampaign("rarity-readback", "epic");
    const [pool] = await listPools(campaignId);
    expect(pool.rarity).toBe("epic");
  });
});
