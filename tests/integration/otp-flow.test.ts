import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { createCampaign, createPool, createSlot } from "@/server/admin";
import { requestOtp, verifyOtp } from "@/server/otp";
import { generateCandidate, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

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
  await createPool(slot.id, {
    benefitType: "discount_percent",
    benefitValue: "20",
    displayLabel: "20% OFF",
    totalQuantity: 5,
    probabilityWeight: 10,
    expiryType: "days",
    expiryValue: 7
  });
  return { slug: campaign.slug, slotId: slot.id };
}

describe("OTP verification gate", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("blocks final selection until the phone is verified, then allows it", async () => {
    const { slug, slotId } = await setupOtpCampaign();
    const input = { campaignSlug: slug, slotId, phone: "+639171112222", sessionId: "otp-s", name: "OTP User" };
    await startHunt(input);
    const candidate = await generateCandidate(input);

    // Without verification the issue is rejected.
    await expect(selectFinalVoucher({ ...input, attemptId: candidate.id })).rejects.toThrow(AppError);

    const requested = await requestOtp({ campaignSlug: slug, phone: input.phone });
    expect(requested.devCode).toMatch(/^\d{6}$/);
    await verifyOtp({ campaignSlug: slug, phone: input.phone, code: requested.devCode! });

    const issued = await selectFinalVoucher({ ...input, attemptId: candidate.id });
    expect(issued.voucher.status).toBe("Issued");
  });

  it("rejects an incorrect code and does not verify", async () => {
    const { slug } = await setupOtpCampaign();
    await requestOtp({ campaignSlug: slug, phone: "+639170003333" });
    await expect(verifyOtp({ campaignSlug: slug, phone: "+639170003333", code: "000000" })).rejects.toThrow(AppError);
  });

  it("does not require OTP for campaigns with the flag off", async () => {
    // Seeded july-dinner has requireOtp = false; issuing works without OTP.
    const input = { campaignSlug: "july-dinner", slotId: "slot_dinner_0705_1900", phone: "+639170004444", sessionId: "no-otp", name: "Plain User" };
    await startHunt(input);
    const candidate = await generateCandidate(input);
    expect((await selectFinalVoucher({ ...input, attemptId: candidate.id })).voucher.status).toBe("Issued");
  });
});
