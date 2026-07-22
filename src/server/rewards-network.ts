import crypto from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { all, getDb, one, run, withTx } from "@/server/db";
import { AppError } from "@/server/errors";
import { normalizePhone } from "@/server/phone";
import type {
  RewardLedgerEntry,
  RewardPurchase,
  RewardSettlementStatus,
  RewardVoucher,
  RewardVoucherRedemption,
  RewardWallet,
} from "@/types/voucher";

type Exec = Client | Transaction;
type Row = any;

const REWARD_RATE_BPS = 500; // 5.00%
const MAX_PURCHASE_CENTAVOS = 1_000_000_00; // PHP 1,000,000 per scan
const MAX_REDEMPTION_CENTAVOS = 250_000_00; // PHP 250,000 per voucher payment
const MIN_CONVERSION_CENTAVOS = 50_00; // PHP 50 minimum voucher conversion

const isoNow = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const token = (prefix: string) => `${prefix}_${crypto.randomBytes(18).toString("base64url")}`;

export function moneyToCentavos(value: unknown, fieldName = "amount") {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppError("E-MONEY-INVALID", `Invalid ${fieldName}`, 400);
    return Math.round(value * 100);
  }

  if (typeof value !== "string") {
    throw new AppError("E-MONEY-INVALID", `Invalid ${fieldName}`, 400);
  }

  const trimmed = value.trim().replace(/^₱/u, "").replace(/^PHP/i, "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new AppError("E-MONEY-INVALID", `Invalid ${fieldName}`, 400);
  }
  const [whole, decimals = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}

export function centavosToMoney(amountCentavos: number) {
  return `₱${(amountCentavos / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `${digits.slice(0, 4)}••••${digits.slice(-3)}`;
}

function mapWallet(row: Row): RewardWallet {
  return {
    id: row.id,
    phone: row.phone,
    maskedPhone: maskPhone(row.phone),
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    walletToken: row.wallet_token,
    balanceCentavos: row.balance_centavos,
    lifetimeEarnedCentavos: row.lifetime_earned_centavos,
    lifetimeConvertedCentavos: row.lifetime_converted_centavos,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedger(row: Row): RewardLedgerEntry {
  return {
    id: row.id,
    walletId: row.wallet_id,
    type: row.type,
    deltaCentavos: row.delta_centavos,
    balanceAfterCentavos: row.balance_after_centavos,
    sourceType: row.source_type,
    sourceId: row.source_id ?? undefined,
    businessId: row.business_id ?? undefined,
    staffName: row.staff_name ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  };
}

function mapPurchase(row: Row): RewardPurchase {
  return {
    id: row.id,
    walletId: row.wallet_id,
    businessId: row.business_id,
    purchaseAmountCentavos: row.purchase_amount_centavos,
    rewardAmountCentavos: row.reward_amount_centavos,
    staffName: row.staff_name,
    status: row.status,
    idempotencyKey: row.idempotency_key ?? undefined,
    fraudFlag: row.fraud_flag ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewNote: row.review_note ?? undefined,
    createdAt: row.created_at,
  };
}

function mapRewardVoucher(row: Row): RewardVoucher {
  return {
    id: row.id,
    walletId: row.wallet_id,
    voucherCode: row.voucher_code,
    qrToken: row.qr_token,
    amountCentavos: row.amount_centavos,
    remainingCentavos: row.remaining_centavos,
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at ?? undefined,
    redeemedAt: row.redeemed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapRedemption(row: Row): RewardVoucherRedemption {
  return {
    id: row.id,
    voucherId: row.voucher_id,
    walletId: row.wallet_id,
    businessId: row.business_id,
    amountCentavos: row.amount_centavos,
    staffName: row.staff_name,
    settlementStatus: row.settlement_status,
    settlementId: row.settlement_id ?? undefined,
    createdAt: row.created_at,
  };
}

async function audit(
  db: Exec,
  input: {
    actorType: "customer" | "staff" | "system";
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const createdAt = isoNow();
  const previous = await one(db, "SELECT event_hash FROM reward_audit_logs WHERE event_hash IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1");
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  const hashPayload = JSON.stringify({
    previousHash: previous?.event_hash ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata,
    createdAt,
  });
  const eventHash = crypto.createHash("sha256").update(hashPayload).digest("hex");
  await run(
    db,
    `INSERT INTO reward_audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, metadata, previous_hash, event_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id("raud"),
      input.actorType,
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      metadata,
      previous?.event_hash ?? null,
      eventHash,
      createdAt,
    ],
  );
}

async function getBusinessOrThrow(db: Exec, businessId: string) {
  const row = await one(db, "SELECT id, name FROM businesses WHERE id = ?", [businessId]);
  if (!row) throw new AppError("E-BUSINESS-404", "Business was not found", 404);
  return { id: String(row.id), name: String(row.name) };
}

// The reward endpoints authenticate the caller from the httpOnly sign-in cookie
// and pass the resolved phone in, so functions only need to normalize it.
function requireWalletPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  return normalized;
}

async function walletByPhone(db: Exec, phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  const row = await one(db, "SELECT * FROM reward_wallets WHERE phone = ?", [normalized]);
  return row ? mapWallet(row) : undefined;
}

async function walletByPhoneAndSecret(db: Exec, phone: string, walletSecret: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  const row = await one(db, "SELECT * FROM reward_wallets WHERE phone = ? AND wallet_secret = ?", [
    normalized,
    walletSecret.trim(),
  ]);
  if (!row) throw new AppError("E-REWARD-WALLET-AUTH", "Reward wallet authorization is required", 401);
  const wallet = mapWallet(row);
  if (wallet.status !== "Active") throw new AppError("E-REWARD-WALLET-SUSPENDED", "Reward wallet is suspended", 409);
  return wallet;
}

async function walletByToken(db: Exec, walletToken: string) {
  const row = await one(db, "SELECT * FROM reward_wallets WHERE wallet_token = ?", [walletToken.trim()]);
  if (!row) throw new AppError("E-REWARD-WALLET-404", "Reward wallet was not found", 404);
  const wallet = mapWallet(row);
  if (wallet.status !== "Active") throw new AppError("E-REWARD-WALLET-SUSPENDED", "Reward wallet is suspended", 409);
  return wallet;
}

export async function getOrCreateRewardWallet(input: {
  phone: string;
  name?: string;
  email?: string;
}) {
  return withTx(async (tx) => {
    const normalized = requireWalletPhone(input.phone);
    const now = isoNow();

    await run(
      tx,
      `INSERT OR IGNORE INTO reward_wallets
       (id, phone, name, email, wallet_token, wallet_secret, balance_centavos, lifetime_earned_centavos, lifetime_converted_centavos, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'Active', ?, ?)`,
      [id("rwal"), normalized, input.name ?? null, input.email ?? null, token("rwallet"), token("rwsecret"), now, now],
    );

    await run(
      tx,
      `UPDATE reward_wallets
       SET name = COALESCE(?, name), email = COALESCE(?, email), updated_at = ?
       WHERE phone = ?`,
      [input.name ?? null, input.email ?? null, now, normalized],
    );

    const wallet = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE phone = ?", [normalized]));
    const secretRow = await one(tx, "SELECT wallet_secret FROM reward_wallets WHERE id = ?", [wallet.id]);
    const [ledger, vouchers] = await Promise.all([
      all(tx, "SELECT * FROM reward_ledger_entries WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 12", [wallet.id]),
      all(tx, "SELECT * FROM reward_vouchers WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 20", [wallet.id]),
    ]);

    await audit(tx, {
      actorType: "customer",
      actorId: wallet.id,
      action: "wallet_upserted",
      entityType: "reward_wallet",
      entityId: wallet.id,
    });

    return {
      wallet,
      walletSecret: String(secretRow.wallet_secret),
      balance: centavosToMoney(wallet.balanceCentavos),
      ledger: ledger.map(mapLedger),
      vouchers: vouchers.map(mapRewardVoucher),
    };
  });
}

export async function rewardWalletSnapshot(input: {
  phone: string;
  walletSecret: string;
}) {
  const db = await getDb();
  const wallet = await walletByPhoneAndSecret(db, requireWalletPhone(input.phone), input.walletSecret);
  const [ledger, vouchers] = await Promise.all([
    all(db, "SELECT * FROM reward_ledger_entries WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 12", [wallet.id]),
    all(db, "SELECT * FROM reward_vouchers WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 20", [wallet.id]),
  ]);
  return {
    wallet,
    walletSecret: input.walletSecret,
    balance: centavosToMoney(wallet.balanceCentavos),
    ledger: ledger.map(mapLedger),
    vouchers: vouchers.map(mapRewardVoucher),
  };
}

function fraudFlag(input: { purchaseCentavos: number; recentCount: number }) {
  if (input.purchaseCentavos > 100_000_00) return "high_payment_amount";
  if (input.recentCount >= 5) return "duplicate_scan_velocity";
  return undefined;
}

export async function creditRewardFromPurchase(input: {
  walletToken: string;
  businessId: string;
  purchaseAmount: string | number;
  staffName: string;
  idempotencyKey: string;
}) {
  return withTx(async (tx) => {
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length < 12 || idempotencyKey.length > 120) {
      throw new AppError("E-IDEMPOTENCY-KEY", "A valid idempotency key is required for purchase scans", 400);
    }
    const existingRow = await one(tx, "SELECT * FROM reward_purchases WHERE business_id = ? AND idempotency_key = ?", [
      input.businessId,
      idempotencyKey,
    ]);
    if (existingRow) {
      const existing = mapPurchase(existingRow);
      const wallet = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE id = ?", [existing.walletId]));
      return {
        wallet,
        purchase: existing,
        rewardAmount: centavosToMoney(existing.rewardAmountCentavos),
        balance: centavosToMoney(wallet.balanceCentavos),
        fraudFlag: existing.fraudFlag,
        heldForReview: existing.status === "Held",
        idempotentReplay: true,
      };
    }

    const wallet = await walletByToken(tx, input.walletToken);
    await getBusinessOrThrow(tx, input.businessId);
    const staffName = input.staffName.trim();
    if (staffName.length < 2) throw new AppError("E-STAFF-NAME", "Staff name is required", 400);

    const purchaseCentavos = moneyToCentavos(input.purchaseAmount, "purchase amount");
    if (purchaseCentavos <= 0 || purchaseCentavos > MAX_PURCHASE_CENTAVOS) {
      throw new AppError(
        "E-MONEY-RANGE",
        `Purchase amount must be between ₱0.01 and ${centavosToMoney(MAX_PURCHASE_CENTAVOS)} per scan`,
        400
      );
    }
    const rewardCentavos = Math.floor((purchaseCentavos * REWARD_RATE_BPS) / 10_000);
    if (rewardCentavos <= 0) throw new AppError("E-REWARD-TOO-SMALL", "Purchase amount is too small to earn credit", 400);

    const recentSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = Number(
      (await one(
        tx,
        `SELECT COUNT(*) AS count FROM reward_purchases
         WHERE wallet_id = ? AND business_id = ? AND created_at >= ?`,
        [wallet.id, input.businessId, recentSince],
      )).count,
    );
    const flag = fraudFlag({ purchaseCentavos, recentCount: recent });
    const purchaseId = id("rpur");
    const now = isoNow();

    await run(
      tx,
      `INSERT INTO reward_purchases
       (id, wallet_id, business_id, purchase_amount_centavos, reward_amount_centavos, staff_name, idempotency_key, status, fraud_flag, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [purchaseId, wallet.id, input.businessId, purchaseCentavos, rewardCentavos, staffName, idempotencyKey, flag ? "Held" : "Accepted", flag ?? null, now],
    );

    let updated = wallet;
    if (!flag) {
      updated = await applyRewardCredit(tx, {
        walletId: wallet.id,
        businessId: input.businessId,
        purchaseId,
        purchaseCentavos,
        rewardCentavos,
        staffName,
        metadata: { fraudFlag: null, idempotencyKey },
      });
    }
    await audit(tx, {
      actorType: "staff",
      actorId: staffName,
      action: flag ? "reward_credit_held_for_review" : "reward_credit_issued",
      entityType: "reward_purchase",
      entityId: purchaseId,
      metadata: { walletId: wallet.id, businessId: input.businessId, purchaseCentavos, rewardCentavos, fraudFlag: flag, idempotencyKey },
    });

    return {
      wallet: updated,
      purchase: mapPurchase(await one(tx, "SELECT * FROM reward_purchases WHERE id = ?", [purchaseId])),
      rewardAmount: centavosToMoney(rewardCentavos),
      balance: centavosToMoney(updated.balanceCentavos),
      fraudFlag: flag,
      heldForReview: Boolean(flag),
      idempotentReplay: false,
    };
  });
}

async function applyRewardCredit(
  tx: Exec,
  input: {
    walletId: string;
    businessId: string;
    purchaseId: string;
    purchaseCentavos: number;
    rewardCentavos: number;
    staffName: string;
    metadata?: Record<string, unknown>;
  },
) {
  const now = isoNow();
  await run(
    tx,
    `UPDATE reward_wallets
     SET balance_centavos = balance_centavos + ?,
         lifetime_earned_centavos = lifetime_earned_centavos + ?,
         updated_at = ?
     WHERE id = ?`,
    [input.rewardCentavos, input.rewardCentavos, now, input.walletId],
  );
  const updated = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE id = ?", [input.walletId]));
  await run(
    tx,
    `INSERT INTO reward_ledger_entries
     (id, wallet_id, type, delta_centavos, balance_after_centavos, source_type, source_id, business_id, staff_name, metadata, created_at)
     VALUES (?, ?, 'credit_earned', ?, ?, 'staff_scan_purchase', ?, ?, ?, ?, ?)`,
    [
      id("rled"),
      input.walletId,
      input.rewardCentavos,
      updated.balanceCentavos,
      input.purchaseId,
      input.businessId,
      input.staffName,
      JSON.stringify({ purchaseCentavos: input.purchaseCentavos, rewardRateBps: REWARD_RATE_BPS, ...(input.metadata ?? {}) }),
      now,
    ],
  );
  return updated;
}

export async function convertRewardCreditToVoucher(input: {
  phone: string;
  walletSecret: string;
  amount: string | number;
}) {
  return withTx(async (tx) => {
    const wallet = await walletByPhoneAndSecret(tx, requireWalletPhone(input.phone), input.walletSecret);
    const amountCentavos = moneyToCentavos(input.amount, "voucher amount");
    if (amountCentavos < MIN_CONVERSION_CENTAVOS) {
      throw new AppError("E-REWARD-MIN-CONVERT", `Minimum conversion is ${centavosToMoney(MIN_CONVERSION_CENTAVOS)}`, 400);
    }

    const now = isoNow();
    const affected = await run(
      tx,
      `UPDATE reward_wallets
       SET balance_centavos = balance_centavos - ?,
           lifetime_converted_centavos = lifetime_converted_centavos + ?,
           updated_at = ?
       WHERE id = ? AND balance_centavos >= ? AND status = 'Active'`,
      [amountCentavos, amountCentavos, now, wallet.id, amountCentavos],
    );
    if (affected !== 1) throw new AppError("E-REWARD-BALANCE", "Insufficient reward credit", 409);

    const updated = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE id = ?", [wallet.id]));
    const voucherId = id("rvch");
    const voucherCode = `RWD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const qrToken = token("rvoucher");
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    await run(
      tx,
      `INSERT INTO reward_vouchers
       (id, wallet_id, voucher_code, qr_token, amount_centavos, remaining_centavos, status, issued_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)`,
      [voucherId, wallet.id, voucherCode, qrToken, amountCentavos, amountCentavos, now, expires.toISOString(), now],
    );
    await run(
      tx,
      `INSERT INTO reward_ledger_entries
       (id, wallet_id, type, delta_centavos, balance_after_centavos, source_type, source_id, metadata, created_at)
       VALUES (?, ?, 'voucher_converted', ?, ?, 'customer_conversion', ?, ?, ?)`,
      [id("rled"), wallet.id, -amountCentavos, updated.balanceCentavos, voucherId, JSON.stringify({ voucherCode }), now],
    );
    await audit(tx, {
      actorType: "customer",
      actorId: wallet.id,
      action: "reward_credit_converted",
      entityType: "reward_voucher",
      entityId: voucherId,
      metadata: { amountCentavos },
    });

    return {
      wallet: updated,
      voucher: mapRewardVoucher(await one(tx, "SELECT * FROM reward_vouchers WHERE id = ?", [voucherId])),
      balance: centavosToMoney(updated.balanceCentavos),
    };
  });
}

async function loadRewardVoucher(db: Exec, codeOrToken: string) {
  const value = codeOrToken.trim();
  const upper = value.toUpperCase();
  const row = await one(db, "SELECT * FROM reward_vouchers WHERE UPPER(voucher_code) = ? OR qr_token = ?", [upper, value]);
  if (!row) throw new AppError("E-REWARD-VOUCHER-404", "Reward voucher was not found", 404);
  return mapRewardVoucher(row);
}

export async function validateRewardVoucher(input: { codeOrToken: string }) {
  return withTx(async (tx) => {
    const voucher = await loadRewardVoucher(tx, input.codeOrToken);
    if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now() && voucher.status === "Active") {
      await run(tx, "UPDATE reward_vouchers SET status = 'Expired' WHERE id = ?", [voucher.id]);
      voucher.status = "Expired";
    }
    const wallet = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE id = ?", [voucher.walletId]));
    return { voucher, wallet };
  });
}

export async function redeemRewardVoucher(input: {
  codeOrToken: string;
  businessId: string;
  amount: string | number;
  staffName: string;
}) {
  return withTx(async (tx) => {
    await getBusinessOrThrow(tx, input.businessId);
    const staffName = input.staffName.trim();
    if (staffName.length < 2) throw new AppError("E-STAFF-NAME", "Staff name is required", 400);
    const amountCentavos = moneyToCentavos(input.amount, "voucher payment amount");
    if (amountCentavos <= 0 || amountCentavos > MAX_REDEMPTION_CENTAVOS) {
      throw new AppError("E-MONEY-RANGE", "Voucher payment amount is outside the allowed range", 400);
    }

    const voucher = await loadRewardVoucher(tx, input.codeOrToken);
    if (voucher.status !== "Active") throw new AppError("E-REWARD-VOUCHER-INACTIVE", "Reward voucher is not active", 409);
    if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now()) {
      await run(tx, "UPDATE reward_vouchers SET status = 'Expired' WHERE id = ?", [voucher.id]);
      throw new AppError("E-REWARD-VOUCHER-EXPIRED", "Reward voucher is expired", 409);
    }
    if (amountCentavos > voucher.remainingCentavos) {
      throw new AppError("E-REWARD-VOUCHER-BALANCE", "Voucher does not have enough remaining value", 409);
    }

    const remaining = voucher.remainingCentavos - amountCentavos;
    const status = remaining === 0 ? "Redeemed" : "Active";
    const now = isoNow();
    const updatedRows = await run(
      tx,
      `UPDATE reward_vouchers
       SET remaining_centavos = ?, status = ?, redeemed_at = CASE WHEN ? = 0 THEN ? ELSE redeemed_at END
       WHERE id = ? AND remaining_centavos >= ? AND status = 'Active'`,
      [remaining, status, remaining, now, voucher.id, amountCentavos],
    );
    if (updatedRows !== 1) {
      throw new AppError("E-REWARD-VOUCHER-RACE", "Reward voucher changed while redeeming. Validate it again.", 409);
    }

    const redemptionId = id("rred");
    await run(
      tx,
      `INSERT INTO reward_voucher_redemptions
       (id, voucher_id, wallet_id, business_id, amount_centavos, staff_name, settlement_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [redemptionId, voucher.id, voucher.walletId, input.businessId, amountCentavos, staffName, now],
    );
    await audit(tx, {
      actorType: "staff",
      actorId: staffName,
      action: "reward_voucher_redeemed",
      entityType: "reward_voucher_redemption",
      entityId: redemptionId,
      metadata: { voucherId: voucher.id, businessId: input.businessId, amountCentavos, settlementStatus: "Pending" },
    });

    return {
      voucher: mapRewardVoucher(await one(tx, "SELECT * FROM reward_vouchers WHERE id = ?", [voucher.id])),
      redemption: mapRedemption(await one(tx, "SELECT * FROM reward_voucher_redemptions WHERE id = ?", [redemptionId])),
      amount: centavosToMoney(amountCentavos),
    };
  });
}

export async function reviewHeldRewardPurchase(input: {
  purchaseId: string;
  decision: "approve" | "reject";
  reviewer: string;
  note?: string;
}) {
  return withTx(async (tx) => {
    const row = await one(tx, "SELECT * FROM reward_purchases WHERE id = ?", [input.purchaseId]);
    if (!row) throw new AppError("E-REWARD-PURCHASE-404", "Reward purchase was not found", 404);
    const purchase = mapPurchase(row);
    if (purchase.status !== "Held") throw new AppError("E-REWARD-PURCHASE-NOT-HELD", "Only held purchases can be reviewed", 409);
    const reviewer = input.reviewer.trim() || "Rewards Reviewer";
    const now = isoNow();

    let wallet = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE id = ?", [purchase.walletId]));
    if (input.decision === "approve") {
      wallet = await applyRewardCredit(tx, {
        walletId: purchase.walletId,
        businessId: purchase.businessId,
        purchaseId: purchase.id,
        purchaseCentavos: purchase.purchaseAmountCentavos,
        rewardCentavos: purchase.rewardAmountCentavos,
        staffName: purchase.staffName,
        metadata: { fraudFlag: purchase.fraudFlag ?? null, reviewedBy: reviewer },
      });
      await run(
        tx,
        "UPDATE reward_purchases SET status = 'Accepted', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
        [reviewer, now, input.note ?? null, purchase.id],
      );
    } else {
      await run(
        tx,
        "UPDATE reward_purchases SET status = 'Rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
        [reviewer, now, input.note ?? null, purchase.id],
      );
    }

    await audit(tx, {
      actorType: "staff",
      actorId: reviewer,
      action: input.decision === "approve" ? "held_reward_approved" : "held_reward_rejected",
      entityType: "reward_purchase",
      entityId: purchase.id,
      metadata: { walletId: purchase.walletId, businessId: purchase.businessId, note: input.note ?? null },
    });

    return {
      wallet,
      purchase: mapPurchase(await one(tx, "SELECT * FROM reward_purchases WHERE id = ?", [purchase.id])),
      balance: centavosToMoney(wallet.balanceCentavos),
    };
  });
}

export async function processRewardSettlements(input: { redemptionIds: string[]; reviewer: string }) {
  return withTx(async (tx) => {
    const ids = Array.from(new Set(input.redemptionIds.map((item) => item.trim()).filter(Boolean)));
    if (ids.length === 0) throw new AppError("E-SETTLEMENT-EMPTY", "Choose at least one redemption to process", 400);
    const placeholders = ids.map(() => "?").join(",");
    const rows = await all(
      tx,
      `SELECT * FROM reward_voucher_redemptions WHERE id IN (${placeholders}) AND settlement_status = 'Pending'`,
      ids,
    );
    if (rows.length !== ids.length) throw new AppError("E-SETTLEMENT-INVALID", "Only pending redemptions can be processed", 409);

    const reviewer = input.reviewer.trim() || "Settlement Reviewer";
    const now = isoNow();
    const period = now.slice(0, 7);
    const byBusiness = new Map<string, Row[]>();
    rows.forEach((row) => {
      const list = byBusiness.get(row.business_id) ?? [];
      list.push(row);
      byBusiness.set(row.business_id, list);
    });

    const settlements: Array<{ settlementId: string; businessId: string; totalAmount: string; redemptionCount: number }> = [];
    for (const [businessId, businessRows] of byBusiness) {
      const settlementId = id("rset");
      const total = businessRows.reduce((sum, row) => sum + Number(row.amount_centavos), 0);
      await run(
        tx,
        `INSERT INTO reward_settlements (id, business_id, period, total_amount_centavos, status, created_at)
         VALUES (?, ?, ?, ?, 'Processed', ?)`,
        [settlementId, businessId, period, total, now],
      );
      const businessIds = businessRows.map((row) => row.id);
      await run(
        tx,
        `UPDATE reward_voucher_redemptions
         SET settlement_status = 'Processed', settlement_id = ?, settlement_verified_by = ?, settlement_verified_at = ?
         WHERE id IN (${businessIds.map(() => "?").join(",")})`,
        [settlementId, reviewer, now, ...businessIds],
      );
      await audit(tx, {
        actorType: "staff",
        actorId: reviewer,
        action: "reward_settlement_processed",
        entityType: "reward_settlement",
        entityId: settlementId,
        metadata: { businessId, redemptionIds: businessIds, totalAmountCentavos: total },
      });
      settlements.push({ settlementId, businessId, totalAmount: centavosToMoney(total), redemptionCount: businessRows.length });
    }
    return { settlements };
  });
}

export async function completeRewardSettlement(input: { settlementId: string; gcashReference: string; reviewer: string }) {
  return withTx(async (tx) => {
    const settlement = await one(tx, "SELECT * FROM reward_settlements WHERE id = ?", [input.settlementId]);
    if (!settlement) throw new AppError("E-SETTLEMENT-404", "Settlement was not found", 404);
    if (settlement.status !== "Processed") throw new AppError("E-SETTLEMENT-STATUS", "Only processed settlements can be completed", 409);
    const reference = input.gcashReference.trim();
    if (reference.length < 3) throw new AppError("E-GCASH-REFERENCE", "GCash reference is required", 400);
    const reviewer = input.reviewer.trim() || "Settlement Reviewer";
    const now = isoNow();
    await run(
      tx,
      "UPDATE reward_settlements SET status = 'Completed', gcash_reference = ?, processed_at = ? WHERE id = ?",
      [reference, now, input.settlementId],
    );
    await run(
      tx,
      "UPDATE reward_voucher_redemptions SET settlement_status = 'Completed', settlement_verified_by = ?, settlement_verified_at = ? WHERE settlement_id = ?",
      [reviewer, now, input.settlementId],
    );
    await audit(tx, {
      actorType: "staff",
      actorId: reviewer,
      action: "reward_settlement_completed",
      entityType: "reward_settlement",
      entityId: input.settlementId,
      metadata: { gcashReference: reference },
    });
    return { settlementId: input.settlementId, status: "Completed" as const };
  });
}

export async function adjustRewardRedemption(input: { redemptionId: string; reviewer: string; note: string }) {
  return withTx(async (tx) => {
    const row = await one(tx, "SELECT * FROM reward_voucher_redemptions WHERE id = ?", [input.redemptionId]);
    if (!row) throw new AppError("E-REDEMPTION-404", "Reward redemption was not found", 404);
    const reviewer = input.reviewer.trim() || "Settlement Reviewer";
    const note = input.note.trim();
    if (note.length < 3) throw new AppError("E-ADJUSTMENT-NOTE", "Adjustment note is required", 400);
    const now = isoNow();
    await run(
      tx,
      `UPDATE reward_voucher_redemptions
       SET settlement_status = 'Adjusted', settlement_verified_by = ?, settlement_verified_at = ?, adjustment_note = ?
       WHERE id = ?`,
      [reviewer, now, note, input.redemptionId],
    );
    await audit(tx, {
      actorType: "staff",
      actorId: reviewer,
      action: "reward_redemption_adjusted",
      entityType: "reward_voucher_redemption",
      entityId: input.redemptionId,
      metadata: { note },
    });
    return { redemptionId: input.redemptionId, status: "Adjusted" as const };
  });
}

export async function rewardsNetworkOverview() {
  const db = await getDb();
  const totals = await one(
    db,
    `SELECT
      COALESCE(SUM(balance_centavos), 0) AS outstanding_credit,
      COALESCE(SUM(lifetime_earned_centavos), 0) AS lifetime_earned,
      COALESCE(SUM(lifetime_converted_centavos), 0) AS lifetime_converted,
      COUNT(*) AS wallets
     FROM reward_wallets`,
  );
  const pending = await one(
    db,
    "SELECT COALESCE(SUM(amount_centavos), 0) AS total, COUNT(*) AS count FROM reward_voucher_redemptions WHERE settlement_status = 'Pending'",
  );
  const held = await one(
    db,
    "SELECT COUNT(*) AS count FROM reward_purchases WHERE status = 'Held'",
  );
  const purchases = (
    await all(
      db,
      `SELECT p.*, w.phone, b.name AS business_name
       FROM reward_purchases p
       JOIN reward_wallets w ON w.id = p.wallet_id
       JOIN businesses b ON b.id = p.business_id
       ORDER BY p.created_at DESC
       LIMIT 20`,
    )
  ).map((row) => ({
    ...mapPurchase(row),
    maskedPhone: maskPhone(row.phone),
    businessName: row.business_name,
    purchaseAmount: centavosToMoney(row.purchase_amount_centavos),
    rewardAmount: centavosToMoney(row.reward_amount_centavos),
  }));
  const redemptions = (
    await all(
      db,
      `SELECT r.*, w.phone, b.name AS business_name, v.voucher_code
       FROM reward_voucher_redemptions r
       JOIN reward_wallets w ON w.id = r.wallet_id
       JOIN businesses b ON b.id = r.business_id
       JOIN reward_vouchers v ON v.id = r.voucher_id
       ORDER BY r.created_at DESC
       LIMIT 20`,
    )
  ).map((row) => ({
    ...mapRedemption(row),
    maskedPhone: maskPhone(row.phone),
    businessName: row.business_name,
    voucherCode: row.voucher_code,
    amount: centavosToMoney(row.amount_centavos),
  }));

  return {
    summary: {
      wallets: Number(totals.wallets),
      outstandingCredit: centavosToMoney(Number(totals.outstanding_credit)),
      lifetimeEarned: centavosToMoney(Number(totals.lifetime_earned)),
      lifetimeConverted: centavosToMoney(Number(totals.lifetime_converted)),
      pendingSettlement: centavosToMoney(Number(pending.total)),
      pendingSettlementCount: Number(pending.count),
      heldReviewCount: Number(held.count),
    },
    purchases,
    redemptions,
  };
}

export async function listRewardSettlementRows(input: { businessId?: string; status?: RewardSettlementStatus } = {}) {
  const db = await getDb();
  const filters: string[] = [];
  const args: string[] = [];
  if (input.businessId) {
    filters.push("r.business_id = ?");
    args.push(input.businessId);
  }
  if (input.status) {
    filters.push("r.settlement_status = ?");
    args.push(input.status);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  return (
    await all(
      db,
      `SELECT r.*, w.phone, b.name AS business_name, v.voucher_code
       FROM reward_voucher_redemptions r
       JOIN reward_wallets w ON w.id = r.wallet_id
       JOIN businesses b ON b.id = r.business_id
       JOIN reward_vouchers v ON v.id = r.voucher_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      args,
    )
  ).map((row) => ({
    redemptionId: row.id,
    settlementId: row.settlement_id ?? undefined,
    date: row.created_at,
    customerReference: maskPhone(row.phone),
    voucherCode: row.voucher_code,
    voucherAmount: centavosToMoney(row.amount_centavos),
    amountCentavos: row.amount_centavos,
    storeBranch: row.business_name,
    settlementAmount: centavosToMoney(row.amount_centavos),
    status: row.settlement_status,
    verifiedBy: row.settlement_verified_by ?? undefined,
    verifiedAt: row.settlement_verified_at ?? undefined,
    adjustmentNote: row.adjustment_note ?? undefined,
  }));
}

export async function listRewardAuditRows() {
  const db = await getDb();
  return (
    await all(
      db,
      `SELECT * FROM reward_audit_logs
       ORDER BY created_at DESC, id DESC
       LIMIT 500`,
    )
  ).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actorType: row.actor_type,
    actorId: row.actor_id ?? "",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? "",
    previousHash: row.previous_hash ?? "",
    eventHash: row.event_hash ?? "",
  }));
}

export function rewardAuditRowsToCsv(rows: Awaited<ReturnType<typeof listRewardAuditRows>>) {
  const headers = ["createdAt", "actorType", "actorId", "action", "entityType", "entityId", "metadata", "previousHash", "eventHash"];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header as keyof typeof row])).join(",")),
  ].join("\n");
}
