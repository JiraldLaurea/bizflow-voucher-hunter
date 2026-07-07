import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  createBusiness,
  createCampaign,
  createPool,
  createSlot,
  listBusinesses,
  listCampaigns,
  listPools,
  listSlots,
  updateCampaign
} from "@/server/admin";
import { generateCandidate, listSlotsForAttempt, startHunt } from "@/server/voucher-engine";

const campaignInput = {
  businessId: "biz_demo_shop",
  slug: "admin-created",
  title: "Admin Created Drop",
  offerMessage: "Built through the admin API.",
  heroImage: "linear-gradient(#000,#111)",
  mode: "online_shop" as const,
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  baseAttempts: 3,
  referralDailyLimit: 5,
  candidateTimeoutMinutes: 10,
  terms: "Test terms."
};

describe("admin CRUD", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates a campaign, slot, and pool that the public hunt flow can use", async () => {
    const campaign = await createCampaign(campaignInput);
    expect(campaign.id).toMatch(/^camp_/);

    const slot = await createSlot(campaign.id, {
      date: "2026-08-05",
      startTime: "20:00",
      endTime: "22:00",
      totalCapacity: 10
    });
    expect(slot.remainingCapacity).toBe(10);

    const pool = await createPool(campaign.id, {
      benefitType: "discount_percent",
      benefitValue: "25",
      displayLabel: "25% OFF",
      totalQuantity: 5,
      probabilityWeight: 10,
      expiryType: "days",
      expiryValue: 7,
      slotIds: [slot.id]
    });
    expect(pool.slotIds).toEqual([slot.id]);

    expect(await listSlots(campaign.id)).toHaveLength(1);
    expect(await listPools(campaign.id)).toHaveLength(1);

    // Public flow works against the admin-created campaign (single tier -> always drawn).
    const input = { campaignSlug: "admin-created", phone: "+639170001111", sessionId: "admin-flow" };
    await startHunt({ ...input, name: "Admin Flow" });
    const candidate = await generateCandidate(input);
    expect(candidate.displayLabel).toBe("25% OFF");
    const { slots } = await listSlotsForAttempt({ campaignSlug: "admin-created", phone: input.phone, attemptId: candidate.id });
    expect(slots.map((s) => s.id)).toEqual([slot.id]);
  });

  it("rejects a duplicate slug", async () => {
    await createCampaign(campaignInput);
    await expect(createCampaign(campaignInput)).rejects.toThrow(AppError);
  });

  it("rejects invalid invariants", async () => {
    await expect(
      createCampaign({ ...campaignInput, slug: "bad-dates", startDate: "2026-08-31", endDate: "2026-08-01" })
    ).rejects.toThrow(AppError);

    const campaign = await createCampaign({ ...campaignInput, slug: "invariants" });
    await expect(
      createSlot(campaign.id, { date: "2026-08-05", startTime: "22:00", endTime: "20:00", totalCapacity: 5 })
    ).rejects.toThrow(AppError);
    await createSlot(campaign.id, { date: "2026-08-05", startTime: "20:00", endTime: "22:00", totalCapacity: 5 });
    await expect(
      createPool(campaign.id, {
        benefitType: "discount_percent",
        benefitValue: "10",
        displayLabel: "10% OFF",
        totalQuantity: 5,
        probabilityWeight: 0,
        expiryType: "days",
        expiryValue: 7
      })
    ).rejects.toThrow(AppError);
  });

  it("patches an existing campaign", async () => {
    const campaign = await createCampaign({ ...campaignInput, slug: "patch-me" });
    const updated = await updateCampaign(campaign.id, { title: "Patched Title", status: "paused" });
    expect(updated.title).toBe("Patched Title");
    expect(updated.status).toBe("paused");
  });

  it("creates a business and a campaign built on top of it end to end", async () => {
    const before = (await listBusinesses()).length;
    const business = await createBusiness({
      name: "New Sample Cafe",
      logoText: "NSC",
      industry: "restaurant",
      staffPin: "1357"
    });
    expect(business.id).toMatch(/^biz_/);
    expect(await listBusinesses()).toHaveLength(before + 1);

    const campaign = await createCampaign({
      ...campaignInput,
      businessId: business.id,
      slug: "new-cafe-launch",
      mode: "restaurant"
    });
    expect((await listCampaigns()).some((c) => c.id === campaign.id)).toBe(true);
  });

  it("rejects a business with an invalid staff PIN", async () => {
    await expect(createBusiness({ name: "Bad Pin Co", logoText: "BP", industry: "retail", staffPin: "12" })).rejects.toThrow(
      AppError
    );
  });
});
