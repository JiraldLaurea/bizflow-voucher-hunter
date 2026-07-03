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
import { generateCandidate, listCampaignSlots, startHunt } from "@/server/voucher-engine";

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
  beforeEach(() => {
    resetDb();
  });

  it("creates a campaign, slot, and pool that the public hunt flow can use", () => {
    const campaign = createCampaign(campaignInput);
    expect(campaign.id).toMatch(/^camp_/);

    const slot = createSlot(campaign.id, {
      date: "2026-08-05",
      startTime: "20:00",
      endTime: "22:00",
      totalCapacity: 10
    });
    expect(slot.remainingCapacity).toBe(10);

    createPool(slot.id, {
      benefitType: "discount_percent",
      benefitValue: "25",
      displayLabel: "25% OFF",
      totalQuantity: 5,
      probabilityWeight: 10,
      expiryType: "days",
      expiryValue: 7
    });

    expect(listSlots(campaign.id)).toHaveLength(1);
    expect(listPools(slot.id)).toHaveLength(1);

    // Public flow works against the admin-created campaign.
    const publicSlots = listCampaignSlots("admin-created");
    expect(publicSlots[0].remainingPoolQuantity).toBe(5);
    const input = { campaignSlug: "admin-created", slotId: slot.id, phone: "+639170001111", sessionId: "admin-flow" };
    startHunt(input);
    const candidate = generateCandidate(input);
    expect(candidate.displayLabel).toBe("25% OFF");
  });

  it("rejects a duplicate slug", () => {
    createCampaign(campaignInput);
    expect(() => createCampaign(campaignInput)).toThrow(AppError);
  });

  it("rejects invalid invariants", () => {
    expect(() => createCampaign({ ...campaignInput, slug: "bad-dates", startDate: "2026-08-31", endDate: "2026-08-01" })).toThrow(
      AppError
    );

    const campaign = createCampaign({ ...campaignInput, slug: "invariants" });
    expect(() => createSlot(campaign.id, { date: "2026-08-05", startTime: "22:00", endTime: "20:00", totalCapacity: 5 })).toThrow(
      AppError
    );
    const slot = createSlot(campaign.id, { date: "2026-08-05", startTime: "20:00", endTime: "22:00", totalCapacity: 5 });
    expect(() =>
      createPool(slot.id, {
        benefitType: "discount_percent",
        benefitValue: "10",
        displayLabel: "10% OFF",
        totalQuantity: 5,
        probabilityWeight: 0,
        expiryType: "days",
        expiryValue: 7
      })
    ).toThrow(AppError);
  });

  it("patches an existing campaign", () => {
    const campaign = createCampaign({ ...campaignInput, slug: "patch-me" });
    const updated = updateCampaign(campaign.id, { title: "Patched Title", status: "paused" });
    expect(updated.title).toBe("Patched Title");
    expect(updated.status).toBe("paused");
  });

  it("creates a business and a campaign built on top of it end to end", () => {
    const before = listBusinesses().length;
    const business = createBusiness({
      name: "New Sample Cafe",
      logoText: "NSC",
      industry: "restaurant",
      staffPin: "1357"
    });
    expect(business.id).toMatch(/^biz_/);
    expect(listBusinesses()).toHaveLength(before + 1);

    const campaign = createCampaign({
      ...campaignInput,
      businessId: business.id,
      slug: "new-cafe-launch",
      mode: "restaurant"
    });
    expect(listCampaigns().some((c) => c.id === campaign.id)).toBe(true);
  });

  it("rejects a business with an invalid staff PIN", () => {
    expect(() =>
      createBusiness({ name: "Bad Pin Co", logoText: "BP", industry: "retail", staffPin: "12" })
    ).toThrow(AppError);
  });
});
