import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, one, resetDb, run } from "@/server/db";
import {
  convertRewardCreditToVoucher,
  creditRewardFromPurchase,
  getOrCreateRewardWallet,
  processRewardSettlements,
  redeemRewardVoucher,
  rewardWalletSnapshot,
} from "@/server/rewards-network";
import { recordReferralOpen, startHunt } from "@/server/voucher-engine";

const phone = "+639171118888";
const businessId = "biz_demo_restaurant";

describe("Loyalty Points", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("awards daily app-use LP once and referral LP once per day", async () => {
    const first = await getOrCreateRewardWallet({ phone, name: "LP User" });
    const second = await getOrCreateRewardWallet({ phone, name: "LP User" });

    expect(first.balance).toBe("10 LP");
    expect(second.balance).toBe("10 LP");
    expect(first.appUseAwardedNow).toBe(true);
    expect(second.appUseAwardedNow).toBe(false);
    expect(second.dailyStatus).toMatchObject({
      appUseAwarded: true,
      referralAwarded: false,
      earnedToday: "10 LP",
      monthlyPotential: "600 LP",
    });

    const user = (
      await startHunt({
        campaignSlug: "july-dinner",
        phone,
        sessionId: "lp-referrer",
        name: "LP User",
      })
    ).user;
    await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: user.id,
      visitorSessionId: "lp-visitor-1",
    });
    await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: user.id,
      visitorSessionId: "lp-visitor-2",
    });

    const snapshot = await rewardWalletSnapshot({
      phone,
      walletSecret: first.walletSecret,
    });
    expect(snapshot.balance).toBe("20 LP");
    expect(snapshot.dailyStatus).toMatchObject({
      appUseAwarded: true,
      referralAwarded: true,
      earnedToday: "20 LP",
    });

    const dailyRows = await one(
      await getDb(),
      "SELECT COUNT(*) AS count FROM loyalty_daily_rewards WHERE wallet_id = ?",
      [first.wallet.id],
    );
    expect(Number(dailyRows.count)).toBe(2);
  });

  it("adds 5% LP from purchases and makes retries idempotent", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    const first = await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId,
      purchaseAmount: "500",
      staffName: "staff@bizflow.local",
      idempotencyKey: "purchase-500-restaurant-1",
    });
    const replay = await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId,
      purchaseAmount: "500",
      staffName: "staff@bizflow.local",
      idempotencyKey: "purchase-500-restaurant-1",
    });
    const second = await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId,
      purchaseAmount: "500",
      staffName: "staff@bizflow.local",
      idempotencyKey: "purchase-500-restaurant-2",
    });

    expect(first.rewardAmount).toBe("25 LP");
    expect(replay.idempotentReplay).toBe(true);
    expect(second.rewardAmount).toBe("25 LP");
    // Includes the once-daily 10 LP app-use award.
    expect(second.balance).toBe("60 LP");
  });

  it("deducts a 10% service fee and settles the 90% partner payout", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId,
      purchaseAmount: "10,000",
      staffName: "staff@bizflow.local",
      idempotencyKey: "purchase-for-500-lp-voucher",
    });
    const converted = await convertRewardCreditToVoucher({
      phone,
      walletSecret: wallet.walletSecret,
      amount: "500",
    });
    const redeemed = await redeemRewardVoucher({
      codeOrToken: converted.voucher.voucherCode,
      businessId,
      amount: "500",
      staffName: "staff@bizflow.local",
    });

    expect(redeemed.amount).toBe("500 LP");
    expect(redeemed.serviceFee).toBe("50 LP");
    expect(redeemed.settlementAmount).toBe("450 LP");

    await expect(
      processRewardSettlements({
        redemptionIds: [redeemed.redemption.id],
        reviewer: "admin@bizflow.local",
      }),
    ).rejects.toThrow(/completed month/);

    // The test clock is July 3. A June redemption is eligible for the July
    // 1–7 settlement window.
    await run(
      await getDb(),
      "UPDATE reward_voucher_redemptions SET created_at = ? WHERE id = ?",
      ["2026-06-30T12:00:00.000Z", redeemed.redemption.id],
    );
    vi.setSystemTime(new Date("2026-07-10T12:00:00+08:00"));
    await expect(
      processRewardSettlements({
        redemptionIds: [redeemed.redemption.id],
        reviewer: "admin@bizflow.local",
      }),
    ).rejects.toThrow(/first 7 days/);

    vi.setSystemTime(new Date("2026-07-03T12:00:00+08:00"));
    const processed = await processRewardSettlements({
      redemptionIds: [redeemed.redemption.id],
      reviewer: "admin@bizflow.local",
    });
    expect(processed.settlements).toEqual([
      expect.objectContaining({
        period: "2026-06",
        grossAmount: "500 LP",
        serviceFee: "50 LP",
        totalAmount: "450 LP",
      }),
    ]);

    const settlement = await one(
      await getDb(),
      "SELECT gross_amount_centavos, service_fee_centavos, total_amount_centavos FROM reward_settlements LIMIT 1",
    );
    expect(settlement).toMatchObject({
      gross_amount_centavos: 50_000,
      service_fee_centavos: 5_000,
      total_amount_centavos: 45_000,
    });
  });
});
