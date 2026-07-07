import crypto from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { all, getDb, one, run, withTx } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertCustomerSession } from "@/server/otp";
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
    fraudFlag: row.fraud_flag ?? undefined,
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
  await run(
    db,
    `INSERT INTO reward_audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id("raud"),
      input.actorType,
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      input.metadata ? JSON.stringify(input.metadata) : null,
      isoNow(),
    ],
  );
}

async function getBusinessOrThrow(db: Exec, businessId: string) {
  const row = await one(db, "SELECT id, name FROM businesses WHERE id = ?", [businessId]);
  if (!row) throw new AppError("E-BUSINESS-404", "Business was not found", 404);
  return { id: String(row.id), name: String(row.name) };
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
  campaignSlug: string;
  phone: string;
  customerSessionToken: string;
  name?: string;
  email?: string;
}) {
  const session = await assertCustomerSession(input);
  return withTx(async (tx) => {
    const normalized = session.phone;
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
      ledger: [] as RewardLedgerEntry[],
      vouchers: [] as RewardVoucher[],
    };
  });
}

export async function rewardWalletSnapshot(input: {
  campaignSlug: string;
  phone: string;
  customerSessionToken: string;
  walletSecret: string;
}) {
  const session = await assertCustomerSession(input);
  const db = await getDb();
  const wallet = await walletByPhoneAndSecret(db, session.phone, input.walletSecret);
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
}) {
  return withTx(async (tx) => {
    const wallet = await walletByToken(tx, input.walletToken);
    await getBusinessOrThrow(tx, input.businessId);
    const staffName = input.staffName.trim();
    if (staffName.length < 2) throw new AppError("E-STAFF-NAME", "Staff name is required", 400);

    const purchaseCentavos = moneyToCentavos(input.purchaseAmount, "purchase amount");
    if (purchaseCentavos <= 0 || purchaseCentavos > MAX_PURCHASE_CENTAVOS) {
      throw new AppError("E-MONEY-RANGE", "Purchase amount is outside the allowed range", 400);
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
       (id, wallet_id, business_id, purchase_amount_centavos, reward_amount_centavos, staff_name, status, fraud_flag, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Accepted', ?, ?)`,
      [purchaseId, wallet.id, input.businessId, purchaseCentavos, rewardCentavos, staffName, flag ?? null, now],
    );
    await run(
      tx,
      `UPDATE reward_wallets
       SET balance_centavos = balance_centavos + ?,
           lifetime_earned_centavos = lifetime_earned_centavos + ?,
           updated_at = ?
       WHERE id = ?`,
      [rewardCentavos, rewardCentavos, now, wallet.id],
    );
    const updated = mapWallet(await one(tx, "SELECT * FROM reward_wallets WHERE id = ?", [wallet.id]));
    await run(
      tx,
      `INSERT INTO reward_ledger_entries
       (id, wallet_id, type, delta_centavos, balance_after_centavos, source_type, source_id, business_id, staff_name, metadata, created_at)
       VALUES (?, ?, 'credit_earned', ?, ?, 'staff_scan_purchase', ?, ?, ?, ?, ?)`,
      [
        id("rled"),
        wallet.id,
        rewardCentavos,
        updated.balanceCentavos,
        purchaseId,
        input.businessId,
        staffName,
        JSON.stringify({ purchaseCentavos, rewardRateBps: REWARD_RATE_BPS, fraudFlag: flag ?? null }),
        now,
      ],
    );
    await audit(tx, {
      actorType: "staff",
      actorId: staffName,
      action: "reward_credit_issued",
      entityType: "reward_purchase",
      entityId: purchaseId,
      metadata: { walletId: wallet.id, businessId: input.businessId, purchaseCentavos, rewardCentavos, fraudFlag: flag },
    });

    return {
      wallet: updated,
      purchase: mapPurchase(await one(tx, "SELECT * FROM reward_purchases WHERE id = ?", [purchaseId])),
      rewardAmount: centavosToMoney(rewardCentavos),
      balance: centavosToMoney(updated.balanceCentavos),
      fraudFlag: flag,
    };
  });
}

export async function convertRewardCreditToVoucher(input: {
  campaignSlug: string;
  phone: string;
  customerSessionToken: string;
  walletSecret: string;
  amount: string | number;
}) {
  const session = await assertCustomerSession(input);
  return withTx(async (tx) => {
    const wallet = await walletByPhoneAndSecret(tx, session.phone, input.walletSecret);
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
    date: row.created_at,
    customerReference: maskPhone(row.phone),
    voucherCode: row.voucher_code,
    voucherAmount: centavosToMoney(row.amount_centavos),
    amountCentavos: row.amount_centavos,
    storeBranch: row.business_name,
    settlementAmount: centavosToMoney(row.amount_centavos),
    status: row.settlement_status,
  }));
}
