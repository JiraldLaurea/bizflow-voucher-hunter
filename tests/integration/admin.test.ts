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
import {
  decideChangeRequest,
  listChangeRequests,
  requestCampaignChange,
  reviseChangeRequest,
} from "@/server/change-requests";

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
    const updated = await updateCampaign(campaign.id, {
      title: "Patched Title",
      heroImage: "/images/campaigns/replacement.webp",
      status: "paused",
    });
    expect(updated.title).toBe("Patched Title");
    expect(updated.heroImage).toBe("/images/campaigns/replacement.webp");
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

  it("keeps approved and rejected staff requests in admin history", async () => {
    const approved = await requestCampaignChange({
      campaignId: "camp_july_dinner",
      requestedBy: "staff@bizflow.local",
      requestType: "slot_create",
      payload: {
        date: "2026-07-08",
        startTime: "12:00",
        endTime: "13:00",
        totalCapacity: 8,
      },
    });
    const rejected = await requestCampaignChange({
      campaignId: "camp_july_dinner",
      requestedBy: "staff@bizflow.local",
      requestType: "slot_create",
      payload: {
        date: "2026-07-09",
        startTime: "15:00",
        endTime: "16:00",
        totalCapacity: 4,
      },
    });

    await decideChangeRequest(approved.id, true, "admin@bizflow.local");
    await decideChangeRequest(rejected.id, false, "admin@bizflow.local");

    const history = await listChangeRequests("camp_july_dinner", "slot_create");
    expect(history.find((request) => request.id === approved.id)).toMatchObject({
      status: "Approved",
      reviewedBy: "admin@bizflow.local",
    });
    expect(history.find((request) => request.id === rejected.id)).toMatchObject({
      status: "Rejected",
      reviewedBy: "admin@bizflow.local",
    });
    expect(history.every((request) => Boolean(request.reviewedAt))).toBe(true);

    const revision = await reviseChangeRequest(rejected.id, {
      date: "2026-07-10",
      startTime: "15:30",
      endTime: "16:30",
      totalCapacity: 6,
    });
    const revisedHistory = await listChangeRequests("camp_july_dinner", "slot_create");
    expect(revision).toMatchObject({
      status: "Pending",
      requestedBy: "staff@bizflow.local",
    });
    expect(revisedHistory[0].id).toBe(revision.id);
    expect(revisedHistory.find((request) => request.id === rejected.id)?.status).toBe("Rejected");
  });

  it("approves a staff request only once under concurrent review", async () => {
    const request = await requestCampaignChange({
      campaignId: "camp_july_dinner",
      requestedBy: "staff@bizflow.local",
      requestType: "slot_create",
      payload: {
        date: "2026-07-11",
        startTime: "12:00",
        endTime: "13:00",
        totalCapacity: 7,
      },
    });

    const decisions = await Promise.allSettled([
      decideChangeRequest(request.id, true, "admin-one@bizflow.local"),
      decideChangeRequest(request.id, true, "admin-two@bizflow.local"),
    ]);
    expect(decisions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter((result) => result.status === "rejected")).toHaveLength(1);

    const matchingSlots = (await listSlots("camp_july_dinner")).filter(
      (slot) => slot.date === "2026-07-11" && slot.startTime === "12:00" && slot.endTime === "13:00",
    );
    expect(matchingSlots).toHaveLength(1);
  });
});
