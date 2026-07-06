import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { createCampaign, createPool, createSlot } from "@/server/admin";
import { requestOtp, verifyOtp } from "@/server/otp";
import { generateCandidate, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

async function setupOtpCampaign() {
  const campaign = createCampaign({
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
  const slot = createSlot(campaign.id, { date: "2026-08-05", startTime: "20:00", endTime: "22:00", totalCapacity: 10 });
  createPool(slot.id, {
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
  beforeEach(() => resetDb());

  it("blocks final selection until the phone is verified, then allows it", async () => {
    const { slug, slotId } = await setupOtpCampaign();
    const input = { campaignSlug: slug, slotId, phone: "+639171112222", sessionId: "otp-s", name: "OTP User" };
    startHunt(input);
    const candidate = generateCandidate(input);

    // Without verification the issue is rejected.
    expect(() => selectFinalVoucher({ ...input, attemptId: candidate.id })).toThrow(AppError);

    const requested = await requestOtp({ campaignSlug: slug, phone: input.phone });
    expect(requested.devCode).toMatch(/^\d{6}$/);
    verifyOtp({ campaignSlug: slug, phone: input.phone, code: requested.devCode! });

    const issued = selectFinalVoucher({ ...input, attemptId: candidate.id });
    expect(issued.voucher.status).toBe("Issued");
  });

  it("rejects an incorrect code and does not verify", async () => {
    const { slug } = await setupOtpCampaign();
    await requestOtp({ campaignSlug: slug, phone: "+639170003333" });
    expect(() => verifyOtp({ campaignSlug: slug, phone: "+639170003333", code: "000000" })).toThrow(AppError);
  });

  it("does not require OTP for campaigns with the flag off", () => {
    // Seeded july-dinner has requireOtp = false; issuing works without OTP.
    const input = { campaignSlug: "july-dinner", slotId: "slot_dinner_0705_1900", phone: "+639170004444", sessionId: "no-otp", name: "Plain User" };
    startHunt(input);
    const candidate = generateCandidate(input);
    expect(selectFinalVoucher({ ...input, attemptId: candidate.id }).voucher.status).toBe("Issued");
  });
});
