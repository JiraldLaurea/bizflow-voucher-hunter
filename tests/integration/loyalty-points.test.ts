import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, one, resetDb, run } from "@/server/db";
import {
  businessDepositStatus,
  businessStatementPreview,
  closeBusinessStatement,
  convertRewardCreditToVoucher,
  creditRewardFromPurchase,
  getOrCreateRewardWallet,
  listBusinessDepositEntries,
  listRewardProducts,
  listWalletPurchases,
  purchaseRewardProduct,
  recordBusinessDeposit,
  recordStatementPayment,
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

  // The partner's two sides are netted once, at month end. Charging the 10%
  // fee per redemption instead would bill them on gross LP spend even in a
  // month they finish owing us money.
  it("nets LP issued against LP redeemed and charges the fee on the payout", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    // PHP 10,000 spent earns 500 LP, so the partner owes us PHP 500.
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

    // No fee at the till any more: the redemption carries its full value.
    expect(redeemed.amount).toBe("500 LP");
    expect(redeemed.serviceFee).toBe("0 LP");
    expect(redeemed.settlementAmount).toBe("500 LP");

    const db = await getDb();
    // Move both sides into June so July 1-7 can close them.
    await run(db, "UPDATE reward_purchases SET created_at = ?", [
      "2026-06-15T12:00:00.000Z",
    ]);
    await run(db, "UPDATE reward_voucher_redemptions SET created_at = ?", [
      "2026-06-30T12:00:00.000Z",
    ]);

    // 500 LP issued against 500 LP redeemed leaves nothing owed either way.
    const balanced = await businessStatementPreview({ businessId, period: "2026-06" });
    expect(balanced).toMatchObject({
      issued: "₱500.00",
      redeemed: "₱500.00",
      direction: "Balanced",
      serviceFee: "₱0.00",
    });

    // A second redemption, funded by LP earned at another partner, tips the
    // month in the partner's favour: PHP 1,000 net, fee PHP 100, payout PHP 900.
    await run(db, "UPDATE reward_wallets SET balance_centavos = 200000");
    const second = await convertRewardCreditToVoucher({
      phone,
      walletSecret: wallet.walletSecret,
      amount: "1000",
    });
    const secondRedemption = await redeemRewardVoucher({
      codeOrToken: second.voucher.voucherCode,
      businessId,
      amount: "1000",
      staffName: "staff@bizflow.local",
    });
    await run(db, "UPDATE reward_voucher_redemptions SET created_at = ? WHERE id = ?", [
      "2026-06-30T13:00:00.000Z",
      secondRedemption.redemption.id,
    ]);

    await expect(
      closeBusinessStatement({
        businessId,
        period: "2026-07",
        reviewer: "admin@bizflow.local",
      }),
    ).rejects.toThrow(/completed month/);

    vi.setSystemTime(new Date("2026-07-10T12:00:00+08:00"));
    await expect(
      closeBusinessStatement({
        businessId,
        period: "2026-06",
        reviewer: "admin@bizflow.local",
      }),
    ).rejects.toThrow(/first 7 days/);
    vi.setSystemTime(new Date("2026-07-03T12:00:00+08:00"));

    const closed = await closeBusinessStatement({
      businessId,
      period: "2026-06",
      reviewer: "admin@bizflow.local",
    });
    expect(closed).toMatchObject({
      period: "2026-06",
      issued: "₱500.00",
      redeemed: "₱1,500.00",
      net: "₱1,000.00",
      direction: "Payout",
      serviceFee: "₱100.00",
      payout: "₱900.00",
      depositDeduction: "₱0.00",
    });

    // The deposit is untouched when the month runs the partner's way.
    const afterClose = await businessDepositStatus(businessId);
    expect(afterClose.balance).toBe("₱5,000.00");

    // Closing twice would double-pay.
    await expect(
      closeBusinessStatement({
        businessId,
        period: "2026-06",
        reviewer: "admin@bizflow.local",
      }),
    ).rejects.toThrow(/already been closed/);

    const paid = await recordStatementPayment({
      statementId: closed.statementId,
      reference: "GCASH-88231",
      recordedBy: "finance@bizflow.local",
    });
    expect(paid).toMatchObject({ status: "Paid", paymentReference: "GCASH-88231" });
  });

  it("draws the deposit down when the partner owes more than they are owed", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId,
      purchaseAmount: "20,000",
      staffName: "staff@bizflow.local",
      idempotencyKey: "purchase-with-no-redemption",
    });

    const db = await getDb();
    await run(db, "UPDATE reward_purchases SET created_at = ?", [
      "2026-06-15T12:00:00.000Z",
    ]);

    // 1,000 LP issued, nothing spent back: PHP 1,000 comes off the deposit and
    // no service fee applies, because we are not paying them anything.
    const closed = await closeBusinessStatement({
      businessId,
      period: "2026-06",
      reviewer: "admin@bizflow.local",
    });
    expect(closed).toMatchObject({
      direction: "Collection",
      issued: "₱1,000.00",
      redeemed: "₱0.00",
      serviceFee: "₱0.00",
      payout: "₱0.00",
      depositDeduction: "₱1,000.00",
    });

    const status = await businessDepositStatus(businessId);
    expect(status.balance).toBe("₱4,000.00");
    // Under the PHP 5,000 minimum, but still trading.
    expect(status).toMatchObject({ belowMinimum: true, blocked: false, topUpDue: "₱1,000.00" });

    const entries = await listBusinessDepositEntries(businessId);
    expect(entries[0]).toMatchObject({
      type: "StatementDeduction",
      amount: "-₱1,000.00",
      balanceAfter: "₱4,000.00",
    });

    // Nothing to pay out, so the payout recorder refuses the statement.
    await expect(
      recordStatementPayment({
        statementId: closed.statementId,
        reference: "GCASH-00001",
        recordedBy: "finance@bizflow.local",
      }),
    ).rejects.toThrow(/nothing to pay/);
  });

  it("stops issuing LP once a partner's deposit is exhausted, and resumes on top-up", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    const db = await getDb();
    await run(db, "UPDATE businesses SET deposit_balance_centavos = 0 WHERE id = ?", [
      businessId,
    ]);

    await expect(
      creditRewardFromPurchase({
        walletToken: wallet.wallet.walletToken,
        businessId,
        purchaseAmount: "1,000",
        staffName: "staff@bizflow.local",
        idempotencyKey: "purchase-while-deposit-empty",
      }),
    ).rejects.toThrow(/deposit is used up/);

    const topUp = await recordBusinessDeposit({
      businessId,
      amount: "5,000",
      reference: "BPI-4471",
      recordedBy: "finance@bizflow.local",
    });
    expect(topUp.status).toMatchObject({ blocked: false, belowMinimum: false });

    const credited = await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId,
      purchaseAmount: "1,000",
      staffName: "staff@bizflow.local",
      idempotencyKey: "purchase-after-top-up",
    });
    expect(credited.rewardAmount).toBe("50 LP");
  });

  it("buys a storefront item with LP and bills it to the partner", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    const db = await getDb();
    await run(db, "UPDATE reward_wallets SET balance_centavos = 100000");

    const products = await listRewardProducts({ businessId });
    const bowl = products.find((item) => item.id === "rprod_demo_rice_bowl");
    expect(bowl).toMatchObject({
      price: "500 LP",
      businessName: "Mesa Manila Test Kitchen",
      imageUrl: "/images/rewards/adobo-rice-bowl.png",
    });

    const bought = await purchaseRewardProduct({
      phone,
      walletSecret: wallet.walletSecret,
      productId: "rprod_demo_rice_bowl",
    });
    expect(bought.balance).toBe("500 LP");
    expect(bought.voucher.amountCentavos).toBe(500_00);

    // The partner is credited only once staff hand the item over.
    const beforeHandover = await businessStatementPreview({ businessId });
    expect(beforeHandover.redeemed).toBe("₱0.00");

    await redeemRewardVoucher({
      codeOrToken: bought.voucher.voucherCode,
      businessId,
      amount: "500",
      staffName: "staff@bizflow.local",
    });
    const afterHandover = await businessStatementPreview({ businessId });
    expect(afterHandover.redeemed).toBe("₱500.00");
  });
  // The purchase has to outlive the receipt screen: the QR is the only way to
  // collect the item, so it is kept and its state tracked, not shown once.
  it("keeps a bought item and marks it collected once staff scan it", async () => {
    const wallet = await getOrCreateRewardWallet({ phone });
    const db = await getDb();
    await run(db, "UPDATE reward_wallets SET balance_centavos = 100000");

    const bought = await purchaseRewardProduct({
      phone,
      walletSecret: wallet.walletSecret,
      productId: "rprod_demo_rice_bowl",
    });

    const [saved] = await listWalletPurchases({ phone });
    expect(saved).toMatchObject({
      productName: "Adobo Rice Bowl",
      businessName: "Mesa Manila Test Kitchen",
      price: "500 LP",
      status: "Active",
      collectable: true,
      voucherCode: bought.voucher.voucherCode,
    });

    await redeemRewardVoucher({
      codeOrToken: bought.voucher.voucherCode,
      businessId,
      amount: "500",
      staffName: "staff@bizflow.local",
    });

    const [collected] = await listWalletPurchases({ phone });
    expect(collected).toMatchObject({ status: "Redeemed", collectable: false });
    expect(collected.redeemedAt).not.toBe("");
  });
});
