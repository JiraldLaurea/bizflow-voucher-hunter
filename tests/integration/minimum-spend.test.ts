import { beforeEach, describe, expect, it } from "vitest";
import { createCampaign, createPool, createSlot } from "@/server/admin";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { redeemVoucher, validateVoucher } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

/**
 * A single-tier campaign carrying a minimum spend, so the drawn benefit is
 * deterministic and the condition under test is the only variable.
 */
async function setupCampaign(slug: string, minimumSpend?: number) {
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
  await createPool(campaign.id, {
    benefitType: "discount_percent",
    benefitValue: "90",
    displayLabel: "90% OFF",
    totalQuantity: 50,
    rarity: "rare",
    minimumSpend,
    slotIds: [slot.id]
  });
  return { slug, slotId: slot.id };
}

describe("minimum spend", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reports the tier's minimum spend when validating a voucher", async () => {
    const { slug } = await setupCampaign("min-spend-shown", 1500);
    const { voucher } = await huntAndSelect({ campaignSlug: slug, phone: "+639171110001" });

    const validation = await validateVoucher({ codeOrToken: voucher.voucherCode });
    expect(validation.minimumSpend).toBe(1500);
  });

  it("refuses a redemption below the minimum spend", async () => {
    const { slug } = await setupCampaign("min-spend-block", 1500);
    const { voucher } = await huntAndSelect({ campaignSlug: slug, phone: "+639171110002" });

    await expect(
      redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout@test", purchaseAmount: 200 })
    ).rejects.toMatchObject({ code: "E-VOUCHER-MIN-SPEND" });

    // The voucher must survive the refusal — a rejected sale is not a spent one.
    const validation = await validateVoucher({ codeOrToken: voucher.voucherCode });
    expect(validation.voucher.status).toBe("Issued");
  });

  it("allows a redemption at or above the minimum spend", async () => {
    const { slug } = await setupCampaign("min-spend-allow", 1500);
    const { voucher } = await huntAndSelect({ campaignSlug: slug, phone: "+639171110003" });

    await redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout@test", purchaseAmount: 1500 });
    const validation = await validateVoucher({ codeOrToken: voucher.voucherCode });
    expect(validation.voucher.status).toBe("Redeemed");
  });

  it("allows a redemption when no amount was entered", async () => {
    // The checkout records the visit without a sale to judge. Refusing here would
    // block every redemption that skips the optional amount field.
    const { slug } = await setupCampaign("min-spend-blank", 1500);
    const { voucher } = await huntAndSelect({ campaignSlug: slug, phone: "+639171110004" });

    await redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout@test" });
    const validation = await validateVoucher({ codeOrToken: voucher.voucherCode });
    expect(validation.voucher.status).toBe("Redeemed");
  });

  it("leaves tiers without a minimum spend unrestricted", async () => {
    const { slug } = await setupCampaign("min-spend-none");
    const { voucher } = await huntAndSelect({ campaignSlug: slug, phone: "+639171110005" });

    const validation = await validateVoucher({ codeOrToken: voucher.voucherCode });
    expect(validation.minimumSpend).toBeUndefined();

    await redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout@test", purchaseAmount: 1 });
    expect((await validateVoucher({ codeOrToken: voucher.voucherCode })).voucher.status).toBe("Redeemed");
  });

  it("rejects a benefit value outside its type's range", async () => {
    const campaign = await createCampaign({
      businessId: "biz_demo_shop",
      slug: "bad-benefit-value",
      title: "bad",
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
    await expect(
      createPool(campaign.id, {
        benefitType: "discount_percent",
        benefitValue: "500",
        displayLabel: "500% OFF",
        totalQuantity: 5,
        rarity: "rare"
      })
    ).rejects.toThrow(AppError);
  });
});
