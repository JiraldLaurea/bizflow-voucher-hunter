import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { createCampaign, createPool, createSlot } from "@/server/admin";
import { requestOtp, verifyOtp } from "@/server/otp";
import { generateCandidate, listSlotsForAttempt, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

async function setupOtpCampaign() {
  const campaign = await createCampaign({
    businessId: "biz_demo_shop",
    slug: "otp-drop",
    title: "OTP Drop",
    offerMessage: "Verify to claim.",
    heroImage: "#000",
    mode: "online_shop",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    baseAttempts: 3,
    referralDailyLimit: 5,
    candidateTimeoutMinutes: 10,
    terms: "Verified only.",
    requireOtp: true
  });
  const slot = await createSlot(campaign.id, { date: "2026-08-05", startTime: "20:00", endTime: "22:00", totalCapacity: 10 });
  await createPool(campaign.id, {
    benefitType: "discount_percent",
    benefitValue: "20",
    displayLabel: "20% OFF",
    totalQuantity: 5,
    probabilityWeight: 10,
    expiryType: "days",
    expiryValue: 7,
    slotIds: [slot.id]
  });
  return { slug: campaign.slug, slotId: slot.id };
}

async function drawFirstCandidate(slug: string, phone: string) {
  const base = { campaignSlug: slug, phone, sessionId: "otp-s" };
  await startHunt({ ...base, name: "OTP User" });
  const candidate = await generateCandidate(base);
  const { slots } = await listSlotsForAttempt({ campaignSlug: slug, phone, attemptId: candidate.id });
  return { candidate, slotId: slots[0].id, base };
}

describe("OTP verification gate", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("blocks final selection until the phone is verified, then allows it", async () => {
    const { slug } = await setupOtpCampaign();
    const phone = "+639171112222";
    const { candidate, slotId } = await drawFirstCandidate(slug, phone);
    const select = { campaignSlug: slug, attemptId: candidate.id, slotId, phone, sessionId: "otp-s", name: "OTP User" };

    await expect(selectFinalVoucher(select)).rejects.toThrow(AppError);

    const requested = await requestOtp({ campaignSlug: slug, phone });
    expect(requested.devCode).toMatch(/^\d{6}$/);
    await verifyOtp({ campaignSlug: slug, phone, code: requested.devCode! });

    const issued = await selectFinalVoucher(select);
    expect(issued.voucher.status).toBe("Issued");
  });

  it("rejects an incorrect code and does not verify", async () => {
    const { slug } = await setupOtpCampaign();
    await requestOtp({ campaignSlug: slug, phone: "+639170003333" });
    await expect(verifyOtp({ campaignSlug: slug, phone: "+639170003333", code: "000000" })).rejects.toThrow(AppError);
  });
});
