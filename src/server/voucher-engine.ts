import crypto from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { AppError } from "@/server/errors";
import {
  all,
  getDb,
  mapAttempt,
  mapBusiness,
  mapCampaign,
  mapPool,
  mapReferralReward,
  mapRedemptionLog,
  mapReservation,
  mapSlot,
  mapUser,
  mapVoucher,
  one,
  run,
  withTx
} from "@/server/db";
import { assertOtpVerified } from "@/server/otp";
import { normalizePhone } from "@/server/phone";
import { sendSms, type SmsResult } from "@/server/sms";
import type { Campaign, CampaignSlot, EndUser, SourceType, Voucher, VoucherAttempt, VoucherPool } from "@/types/voucher";

type Exec = Client | Transaction;

const now = () => new Date();
const isoNow = () => now().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
const startOfTodayIso = () => {
  const d = now();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

function isUniqueViolation(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  return code.startsWith("SQLITE_CONSTRAINT") || /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(error.message);
}

async function addAnalytics(
  db: Exec,
  campaignId: string,
  eventName: string,
  metadata?: Record<string, unknown>,
  userId?: string,
  slotId?: string
) {
  await run(
    db,
    `INSERT INTO analytics_events (id, campaign_id, event_name, user_id, slot_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id("evt"), campaignId, eventName, userId ?? null, slotId ?? null, metadata ? JSON.stringify(metadata) : null, isoNow()]
  );
}

function expiryFor(pool: VoucherPool, slot: CampaignSlot) {
  const base = now();
  if (pool.expiryType === "selected_slot_only") {
    return `${slot.date}T${slot.endTime}:00.000+08:00`;
  }
  if (pool.expiryType === "hours") base.setHours(base.getHours() + pool.expiryValue);
  if (pool.expiryType === "days") base.setDate(base.getDate() + pool.expiryValue);
  if (pool.expiryType === "custom") base.setDate(base.getDate() + Math.max(1, pool.expiryValue));
  return base.toISOString();
}

// ---- Read helpers ----

async function campaignByIdOrSlug(db: Exec, key: string) {
  const row = await one(db, "SELECT * FROM campaigns WHERE id = ? OR slug = ?", [key, key]);
  return row ? mapCampaign(row) : undefined;
}

async function getCampaignOrThrow(db: Exec, key: string) {
  const campaign = await campaignByIdOrSlug(db, key);
  if (!campaign || campaign.status !== "active") {
    throw new AppError("E-CAMPAIGN-404", "Campaign is not available", 404);
  }
  return campaign;
}

async function getSlotOrThrow(db: Exec, slotId: string, campaignId: string) {
  const row = await one(db, "SELECT * FROM slots WHERE id = ? AND campaign_id = ?", [slotId, campaignId]);
  if (!row) throw new AppError("E-SLOT-404", "Selected slot was not found", 404);
  const slot = mapSlot(row);
  if (slot.status !== "active" || slot.remainingCapacity <= 0) {
    throw new AppError("E-SLOT-SOLD-OUT", "Selected slot is sold out", 409);
  }
  return slot;
}

async function findOrCreateUser(
  db: Exec,
  campaignId: string,
  phone: string,
  sessionId: string,
  name?: string,
  email?: string
): Promise<EndUser> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  }
  const existingRow = await one(db, "SELECT * FROM users WHERE campaign_id = ? AND phone = ?", [campaignId, normalized]);
  if (existingRow) {
    const existing = mapUser(existingRow);
    await run(db, "UPDATE users SET name = ?, email = ?, session_id = ? WHERE id = ?", [
      name ?? existing.name ?? null,
      email ?? existing.email ?? null,
      sessionId || existing.sessionId,
      existing.id
    ]);
    return mapUser(await one(db, "SELECT * FROM users WHERE id = ?", [existing.id]));
  }
  const user: EndUser = {
    id: id("usr"),
    campaignId,
    phone: normalized,
    name,
    email,
    sessionId,
    createdAt: isoNow()
  };
  await run(db, "INSERT INTO users (id, campaign_id, name, phone, email, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    user.id,
    campaignId,
    name ?? null,
    normalized,
    email ?? null,
    sessionId,
    user.createdAt
  ]);
  return user;
}

async function hasFinalVoucher(db: Exec, campaignId: string, userId: string) {
  return Boolean(await one(db, "SELECT 1 FROM vouchers WHERE campaign_id = ? AND user_id = ?", [campaignId, userId]));
}

async function countGrantedRewardsToday(db: Exec, campaignId: string, referrerUserId: string) {
  const row = await one(
    db,
    `SELECT COUNT(*) AS c FROM referral_rewards
     WHERE campaign_id = ? AND referrer_user_id = ? AND status = 'granted' AND created_at >= ?`,
    [campaignId, referrerUserId, startOfTodayIso()]
  );
  return Number(row.c);
}

async function countBonusAttemptsUsedToday(db: Exec, campaignId: string, userId: string) {
  const row = await one(
    db,
    `SELECT COUNT(*) AS c FROM attempts
     WHERE campaign_id = ? AND user_id = ? AND source_type = 'referral_bonus' AND created_at >= ?`,
    [campaignId, userId, startOfTodayIso()]
  );
  return Number(row.c);
}

async function remainingBonusAttempts(db: Exec, campaign: Campaign, userId: string) {
  const granted = Math.min(await countGrantedRewardsToday(db, campaign.id, userId), campaign.referralDailyLimit);
  const used = await countBonusAttemptsUsedToday(db, campaign.id, userId);
  return Math.max(0, granted - used);
}

async function insertReferralReward(
  db: Exec,
  campaignId: string,
  referrerUserId: string,
  visitorSessionId: string,
  status: "granted" | "rejected",
  reason?: string
) {
  await run(
    db,
    `INSERT INTO referral_rewards (id, campaign_id, referrer_user_id, visitor_session_id, status, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id("ref"), campaignId, referrerUserId, visitorSessionId, status, reason ?? null, isoNow()]
  );
}

/**
 * Records a visit to a shared referral link. Grants the referrer 1 extra
 * attempt if the visitor is a distinct session/device and the referrer's
 * daily referral limit has not been reached. Each (referrer, visitor) pair
 * can grant at most once, ever, so reloading a link cannot farm rewards.
 */
export function recordReferralOpen(input: { campaignSlug: string; ref: string; visitorSessionId: string }) {
  return withTx(async (tx) => {
    const campaign = await getCampaignOrThrow(tx, input.campaignSlug);
    const referrerRow = await one(tx, "SELECT * FROM users WHERE id = ? AND campaign_id = ?", [input.ref, campaign.id]);
    if (!referrerRow) throw new AppError("E-REFERRAL-404", "Referral link is invalid", 404);
    const referrer = mapUser(referrerRow);

    await addAnalytics(tx, campaign.id, "share_link_opened", { referrerUserId: referrer.id });

    const existingRow = await one(
      tx,
      "SELECT * FROM referral_rewards WHERE campaign_id = ? AND referrer_user_id = ? AND visitor_session_id = ?",
      [campaign.id, referrer.id, input.visitorSessionId]
    );
    if (existingRow) {
      const existing = mapReferralReward(existingRow);
      return { granted: existing.status === "granted", reason: existing.reason };
    }

    if (referrer.sessionId === input.visitorSessionId) {
      await insertReferralReward(tx, campaign.id, referrer.id, input.visitorSessionId, "rejected", "self_referral");
      return { granted: false, reason: "self_referral" };
    }

    if ((await countGrantedRewardsToday(tx, campaign.id, referrer.id)) >= campaign.referralDailyLimit) {
      await insertReferralReward(tx, campaign.id, referrer.id, input.visitorSessionId, "rejected", "daily_limit_reached");
      return { granted: false, reason: "daily_limit_reached" };
    }

    try {
      await insertReferralReward(tx, campaign.id, referrer.id, input.visitorSessionId, "granted");
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { granted: false, reason: "already_processed" };
      }
      throw error;
    }
    await addAnalytics(tx, campaign.id, "extra_attempt_granted", { referrerUserId: referrer.id }, referrer.id);
    return { granted: true };
  });
}

export async function publicSlots(campaignId: string) {
  const db = await getDb();
  const slots = (await all(db, "SELECT * FROM slots WHERE campaign_id = ?", [campaignId])).map(mapSlot);
  const withCounts = [];
  for (const slot of slots) {
    const agg = await one(
      db,
      "SELECT COALESCE(SUM(remaining_quantity), 0) AS q FROM pools WHERE slot_id = ? AND status = 'active'",
      [slot.id]
    );
    withCounts.push({ ...slot, remainingPoolQuantity: Number(agg.q) });
  }
  return withCounts;
}

export async function getPublicCampaign(slug: string) {
  const db = await getDb();
  const campaign = await getCampaignOrThrow(db, slug);
  const businessRow = await one(db, "SELECT * FROM businesses WHERE id = ?", [campaign.businessId]);
  await addAnalytics(db, campaign.id, "campaign_page_view");
  return {
    campaign,
    business: businessRow ? mapBusiness(businessRow) : undefined,
    slots: await publicSlots(campaign.id)
  };
}

export async function listCampaignSlots(slug: string) {
  const db = await getDb();
  const campaign = await getCampaignOrThrow(db, slug);
  return publicSlots(campaign.id);
}

/** Active campaigns for the public campaign switcher/tab bar. */
export async function listActiveCampaigns() {
  const db = await getDb();
  return (await all(db, "SELECT * FROM campaigns WHERE status = 'active' ORDER BY start_date DESC")).map(mapCampaign);
}

export async function startHunt(input: {
  campaignSlug: string;
  slotId: string;
  phone: string;
  sessionId: string;
  name?: string;
  email?: string;
}) {
  const result = await withTx(async (tx) => {
    const campaign = await getCampaignOrThrow(tx, input.campaignSlug);
    const slot = await getSlotOrThrow(tx, input.slotId, campaign.id);
    const user = await findOrCreateUser(tx, campaign.id, input.phone, input.sessionId, input.name, input.email);
    if (await hasFinalVoucher(tx, campaign.id, user.id)) {
      throw new AppError("E-DUPLICATE-FINAL", "This phone number already has a final voucher for this campaign", 409);
    }
    await addAnalytics(tx, campaign.id, "hunt_started", { phone: user.phone }, user.id, slot.id);
    return { campaign, slot, user };
  });
  const db = await getDb();
  return huntState(db, result.campaign, result.slot, result.user);
}

function weightedPool(pools: VoucherPool[], existingLabels: Set<string>) {
  const uniqueFirst = pools.filter((pool) => !existingLabels.has(pool.displayLabel));
  const candidates = uniqueFirst.length > 0 ? uniqueFirst : pools;
  const total = candidates.reduce((sum, pool) => sum + pool.probabilityWeight, 0);
  let point = Math.random() * total;
  for (const pool of candidates) {
    point -= pool.probabilityWeight;
    if (point <= 0) return pool;
  }
  return candidates[candidates.length - 1];
}

export function generateCandidate(input: {
  campaignSlug: string;
  slotId: string;
  phone: string;
  sessionId: string;
  sourceType?: SourceType;
}) {
  const sourceType = input.sourceType ?? "base";
  return withTx(async (tx) => {
    const campaign = await getCampaignOrThrow(tx, input.campaignSlug);
    const slot = await getSlotOrThrow(tx, input.slotId, campaign.id);
    const user = await findOrCreateUser(tx, campaign.id, input.phone, input.sessionId);
    if (await hasFinalVoucher(tx, campaign.id, user.id)) {
      throw new AppError("E-DUPLICATE-FINAL", "Final voucher already issued", 409);
    }
    await expireCandidates(tx);

    const attempts = (await all(tx, "SELECT * FROM attempts WHERE campaign_id = ? AND user_id = ?", [campaign.id, user.id])).map(
      mapAttempt
    );
    const activeAttempts = attempts.filter((a) => a.status === "Candidate" || a.status === "Held");
    if (sourceType === "base") {
      if (attempts.filter((a) => a.sourceType === "base").length >= campaign.baseAttempts) {
        throw new AppError("E-ATTEMPT-LIMIT", "Base voucher hunt attempts are already used", 409);
      }
    } else if (sourceType === "referral_bonus") {
      if ((await remainingBonusAttempts(tx, campaign, user.id)) <= 0) {
        throw new AppError("E-ATTEMPT-LIMIT", "No extra attempts earned yet. Share your link to earn one.", 409);
      }
    }

    const pools = (
      await all(tx, "SELECT * FROM pools WHERE slot_id = ? AND status = 'active' AND remaining_quantity > 0", [slot.id])
    ).map(mapPool);
    if (pools.length === 0) throw new AppError("E-POOL-EMPTY", "No voucher benefits remain for this slot", 409);

    const pool = weightedPool(pools, new Set(activeAttempts.map((a) => a.displayLabel)));

    // Conditional decrement: guards against over-issue across connections/processes.
    const dec = await run(
      tx,
      `UPDATE pools
       SET remaining_quantity = remaining_quantity - 1,
           status = CASE WHEN remaining_quantity - 1 <= 0 THEN 'depleted' ELSE status END
       WHERE id = ? AND remaining_quantity > 0`,
      [pool.id]
    );
    if (dec !== 1) throw new AppError("E-POOL-EMPTY", "No voucher benefits remain for this slot", 409);

    const expires = now();
    expires.setMinutes(expires.getMinutes() + campaign.candidateTimeoutMinutes);
    const attempt: VoucherAttempt = {
      id: id("att"),
      campaignId: campaign.id,
      slotId: slot.id,
      userId: user.id,
      attemptNumber: attempts.length + 1,
      sourceType,
      benefitType: pool.benefitType,
      benefitValue: pool.benefitValue,
      displayLabel: pool.displayLabel,
      poolId: pool.id,
      status: "Candidate",
      expiresAt: expires.toISOString(),
      createdAt: isoNow()
    };
    await run(
      tx,
      `INSERT INTO attempts (id, campaign_id, slot_id, user_id, attempt_number, source_type, benefit_type, benefit_value, display_label, pool_id, status, expires_at, created_at)
       VALUES (@id, @campaignId, @slotId, @userId, @attemptNumber, @sourceType, @benefitType, @benefitValue, @displayLabel, @poolId, @status, @expiresAt, @createdAt)`,
      attempt
    );
    await addAnalytics(tx, campaign.id, "voucher_candidate_generated", { benefit: attempt.displayLabel }, user.id, slot.id);
    return attempt;
  });
}

export function selectFinalVoucher(input: {
  campaignSlug: string;
  attemptId: string;
  phone: string;
  sessionId: string;
  name: string;
  email?: string;
  guestCount?: number;
}) {
  return withTx(async (tx) => {
    const campaign = await getCampaignOrThrow(tx, input.campaignSlug);
    const user = await findOrCreateUser(tx, campaign.id, input.phone, input.sessionId, input.name, input.email);
    if (await hasFinalVoucher(tx, campaign.id, user.id)) {
      throw new AppError("E-DUPLICATE-FINAL", "This phone number already has a final voucher for this campaign", 409);
    }
    // Enforce phone OTP verification for campaigns that require it (no-op otherwise).
    await assertOtpVerified(tx, campaign, user.phone);
    await expireCandidates(tx);

    const attemptRow = await one(tx, "SELECT * FROM attempts WHERE id = ? AND campaign_id = ? AND user_id = ?", [
      input.attemptId,
      campaign.id,
      user.id
    ]);
    if (!attemptRow) throw new AppError("E-ATTEMPT-404", "Selected candidate was not found", 404);
    const attempt = mapAttempt(attemptRow);
    if (attempt.status !== "Candidate" && attempt.status !== "Held") {
      throw new AppError("E-ATTEMPT-STATE", "Selected candidate is no longer available", 409);
    }
    if (new Date(attempt.expiresAt).getTime() < Date.now()) {
      await releaseAttempt(tx, attempt);
      throw new AppError("E-ATTEMPT-EXPIRED", "Selected candidate has expired", 409);
    }

    const slot = await getSlotOrThrow(tx, attempt.slotId, campaign.id);
    const pool = mapPool(await one(tx, "SELECT * FROM pools WHERE id = ?", [attempt.poolId]));

    // Conditional capacity decrement guards the slot against over-booking.
    const cap = await run(
      tx,
      `UPDATE slots
       SET remaining_capacity = remaining_capacity - 1,
           status = CASE WHEN remaining_capacity - 1 <= 0 THEN 'sold_out' ELSE status END
       WHERE id = ? AND remaining_capacity > 0`,
      [slot.id]
    );
    if (cap !== 1) throw new AppError("E-SLOT-SOLD-OUT", "Selected slot is sold out", 409);

    const voucher = {
      id: id("vch"),
      campaignId: campaign.id,
      slotId: slot.id,
      userId: user.id,
      selectedAttemptId: attempt.id,
      voucherCode: `BIZ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      qrToken: crypto.randomBytes(10).toString("hex"),
      benefitType: attempt.benefitType,
      benefitValue: attempt.benefitValue,
      displayLabel: attempt.displayLabel,
      status: "Issued" as const,
      issuedAt: isoNow(),
      expiresAt: expiryFor(pool, slot),
      redeemedAt: null as string | null
    };
    try {
      await run(
        tx,
        `INSERT INTO vouchers (id, campaign_id, slot_id, user_id, selected_attempt_id, voucher_code, qr_token, benefit_type, benefit_value, display_label, status, issued_at, expires_at, redeemed_at)
         VALUES (@id, @campaignId, @slotId, @userId, @selectedAttemptId, @voucherCode, @qrToken, @benefitType, @benefitValue, @displayLabel, @status, @issuedAt, @expiresAt, @redeemedAt)`,
        voucher
      );
    } catch (error) {
      // UNIQUE(campaign_id, user_id) is the authoritative one-final-voucher guard under concurrency.
      if (isUniqueViolation(error)) {
        throw new AppError("E-DUPLICATE-FINAL", "This phone number already has a final voucher for this campaign", 409);
      }
      throw error;
    }

    await run(tx, "UPDATE attempts SET status = 'Selected' WHERE id = ?", [attempt.id]);
    // Release every other candidate for this user back to the pool.
    const others = (
      await all(tx, "SELECT * FROM attempts WHERE campaign_id = ? AND user_id = ? AND id != ?", [campaign.id, user.id, attempt.id])
    ).map(mapAttempt);
    for (const other of others) await releaseAttempt(tx, other);

    if (campaign.mode === "restaurant") {
      await run(
        tx,
        `INSERT INTO reservations (id, campaign_id, slot_id, user_id, voucher_id, guest_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Reserved', ?)`,
        [id("res"), campaign.id, slot.id, user.id, voucher.id, input.guestCount ?? null, isoNow()]
      );
    }

    await addAnalytics(tx, campaign.id, "voucher_final_selected", { voucherCode: voucher.voucherCode }, user.id, slot.id);
    await addAnalytics(tx, campaign.id, "voucher_issued", { benefit: voucher.displayLabel }, user.id, slot.id);

    const freshSlot = mapSlot(await one(tx, "SELECT * FROM slots WHERE id = ?", [slot.id]));
    const freshVoucher = mapVoucher(await one(tx, "SELECT * FROM vouchers WHERE id = ?", [voucher.id]));
    return { voucher: freshVoucher, slot: freshSlot, campaign, user };
  });
}

/**
 * Sends the actual SMS confirmation for a just-issued voucher. Kept outside
 * selectFinalVoucher's transaction so a slow/failed provider network call never
 * holds a write transaction open or rolls back the (already committed) issuance;
 * the outcome is recorded in sms_logs instead.
 */
export async function sendVoucherConfirmationSms(voucherId: string): Promise<SmsResult> {
  const db = await getDb();
  const voucherRow = await one(db, "SELECT * FROM vouchers WHERE id = ?", [voucherId]);
  if (!voucherRow) throw new AppError("E-VOUCHER-404", "Voucher was not found", 404);
  const voucher = mapVoucher(voucherRow);
  const context = await loadSmsContext(db, voucher);
  const message = smsBody(context.business, context.campaign, voucher, context.slot, context.user);
  return dispatchSms(db, {
    campaignId: context.campaign.id,
    userId: context.user.id,
    voucherId: voucher.id,
    slotId: context.slot.id,
    phone: context.user.phone,
    message
  });
}

/** Re-sends the SMS confirmation for an existing voucher, e.g. from a "resend" action. */
export async function resendVoucherSms(input: { codeOrToken: string }): Promise<SmsResult & { voucherCode: string; to: string }> {
  const db = await getDb();
  const voucher = await loadVoucherContext(db, input.codeOrToken);
  const context = await loadSmsContext(db, voucher);
  const message = smsBody(context.business, context.campaign, voucher, context.slot, context.user);
  const result = await dispatchSms(db, {
    campaignId: context.campaign.id,
    userId: context.user.id,
    voucherId: voucher.id,
    slotId: context.slot.id,
    phone: context.user.phone,
    message
  });
  return { ...result, voucherCode: voucher.voucherCode, to: context.user.phone };
}

async function loadSmsContext(db: Exec, voucher: Voucher) {
  const userRow = await one(db, "SELECT * FROM users WHERE id = ?", [voucher.userId]);
  const slotRow = await one(db, "SELECT * FROM slots WHERE id = ?", [voucher.slotId]);
  const campaignRow = await one(db, "SELECT * FROM campaigns WHERE id = ?", [voucher.campaignId]);
  if (!userRow || !slotRow || !campaignRow) {
    throw new AppError("E-VOUCHER-404", "Voucher context is incomplete", 404);
  }
  const campaign = mapCampaign(campaignRow);
  const businessRow = await one(db, "SELECT * FROM businesses WHERE id = ?", [campaign.businessId]);
  return {
    user: mapUser(userRow),
    slot: mapSlot(slotRow),
    campaign,
    business: businessRow ? mapBusiness(businessRow) : undefined
  };
}

/** Sends via the configured SMS provider and records the attempt in sms_logs. */
async function dispatchSms(
  db: Exec,
  params: { campaignId: string; userId: string; voucherId: string; slotId: string; phone: string; message: string }
): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";
  const smsLogId = id("sms");
  await run(
    db,
    `INSERT INTO sms_logs (id, campaign_id, user_id, voucher_id, to_number, body, provider, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [smsLogId, params.campaignId, params.userId, params.voucherId, params.phone, params.message, provider, isoNow()]
  );

  const result = await sendSms(params.phone, params.message);

  await run(db, `UPDATE sms_logs SET status = ?, provider_message_id = ?, failure_reason = ? WHERE id = ?`, [
    result.success ? "sent" : "failed",
    result.providerMessageId ?? null,
    result.error ?? null,
    smsLogId
  ]);

  if (result.success) {
    await addAnalytics(db, params.campaignId, "sms_sent", { provider }, params.userId, params.slotId);
  }

  return result;
}

function smsBody(
  business: { name: string } | undefined,
  campaign: Campaign,
  voucher: { voucherCode: string; displayLabel: string; expiresAt: string },
  slot: CampaignSlot,
  user: EndUser
) {
  const where = campaign.mode === "restaurant" ? "Show this SMS at the restaurant." : `Shop here: ${campaign.shopUrl ?? "campaign shop"}.`;
  return `[${business?.name ?? "BizFlow"}] Your voucher is confirmed. Code: ${voucher.voucherCode}. Benefit: ${voucher.displayLabel}. Date/Time: ${slot.date} ${slot.startTime}-${slot.endTime}. ${where} Valid until ${voucher.expiresAt}. Terms: ${campaign.terms}. ${user.name ? `Name: ${user.name}.` : ""}`;
}

async function releaseAttempt(db: Exec, attempt: VoucherAttempt) {
  if (attempt.status === "Candidate" || attempt.status === "Held") {
    await run(
      db,
      `UPDATE pools
       SET remaining_quantity = remaining_quantity + 1,
           status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END
       WHERE id = ?`,
      [attempt.poolId]
    );
    await run(db, "UPDATE attempts SET status = 'Released' WHERE id = ?", [attempt.id]);
  }
}

/** Expire timed-out candidates and return their held stock. Runs inside a caller transaction. */
async function expireCandidates(db: Exec) {
  const stale = (await all(db, "SELECT * FROM attempts WHERE status IN ('Candidate', 'Held') AND expires_at < ?", [isoNow()])).map(
    mapAttempt
  );
  for (const attempt of stale) {
    await run(
      db,
      `UPDATE pools
       SET remaining_quantity = remaining_quantity + 1,
           status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END
       WHERE id = ?`,
      [attempt.poolId]
    );
    await run(db, "UPDATE attempts SET status = 'Expired' WHERE id = ?", [attempt.id]);
  }
  return stale.length > 0;
}

export function expireOldCandidates() {
  return withTx((tx) => expireCandidates(tx));
}

async function loadVoucherContext(db: Exec, codeOrToken: string) {
  const upper = codeOrToken.trim().toUpperCase();
  const row = await one(db, "SELECT * FROM vouchers WHERE UPPER(voucher_code) = ? OR UPPER(qr_token) = ?", [upper, upper]);
  if (!row) throw new AppError("E-VOUCHER-404", "Voucher was not found", 404);
  return mapVoucher(row);
}

export function validateVoucher(input: { codeOrToken: string }) {
  return withTx(async (tx) => {
    const voucher = await loadVoucherContext(tx, input.codeOrToken);
    if (new Date(voucher.expiresAt).getTime() < Date.now() && voucher.status !== "Redeemed") {
      await run(tx, "UPDATE vouchers SET status = 'Expired' WHERE id = ?", [voucher.id]);
      voucher.status = "Expired";
    }
    const userRow = await one(tx, "SELECT * FROM users WHERE id = ?", [voucher.userId]);
    const slotRow = await one(tx, "SELECT * FROM slots WHERE id = ?", [voucher.slotId]);
    const campaignRow = await one(tx, "SELECT * FROM campaigns WHERE id = ?", [voucher.campaignId]);
    const campaign = campaignRow ? mapCampaign(campaignRow) : undefined;
    const businessRow = campaign ? await one(tx, "SELECT * FROM businesses WHERE id = ?", [campaign.businessId]) : undefined;
    return {
      voucher,
      user: userRow ? mapUser(userRow) : undefined,
      slot: slotRow ? mapSlot(slotRow) : undefined,
      campaign,
      business: businessRow ? mapBusiness(businessRow) : undefined
    };
  });
}

export async function redeemVoucher(input: { codeOrToken: string; staffName: string; purchaseAmount?: number; note?: string }) {
  await withTx(async (tx) => {
    const voucher = await loadVoucherContext(tx, input.codeOrToken);
    if (voucher.status === "Redeemed") throw new AppError("E-VOUCHER-REDEEMED", "Voucher is already redeemed", 409);
    if (new Date(voucher.expiresAt).getTime() < Date.now()) throw new AppError("E-VOUCHER-EXPIRED", "Voucher is expired", 409);
    await run(tx, "UPDATE vouchers SET status = 'Redeemed', redeemed_at = ? WHERE id = ?", [isoNow(), voucher.id]);
    await run(tx, "UPDATE reservations SET status = 'Redeemed' WHERE voucher_id = ?", [voucher.id]);
    await run(
      tx,
      `INSERT INTO redemption_logs (id, voucher_id, staff_name, purchase_amount, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id("red"), voucher.id, input.staffName, input.purchaseAmount ?? null, input.note ?? null, isoNow()]
    );
    await addAnalytics(tx, voucher.campaignId, "voucher_redeemed", { purchaseAmount: input.purchaseAmount }, voucher.userId, voucher.slotId);
  });
  return validateVoucher({ codeOrToken: input.codeOrToken });
}

async function huntState(db: Exec, campaign: Campaign, slot: CampaignSlot, user: EndUser) {
  const attempts = (await all(db, "SELECT * FROM attempts WHERE campaign_id = ? AND user_id = ?", [campaign.id, user.id])).map(
    mapAttempt
  );
  const voucherRow = await one(db, "SELECT * FROM vouchers WHERE campaign_id = ? AND user_id = ?", [campaign.id, user.id]);
  return {
    user,
    campaign,
    slot,
    attempts,
    voucher: voucherRow ? mapVoucher(voucherRow) : undefined,
    remainingBaseAttempts: Math.max(0, campaign.baseAttempts - attempts.filter((a) => a.sourceType === "base").length),
    remainingBonusAttempts: await remainingBonusAttempts(db, campaign, user.id),
    sharesGrantedToday: await countGrantedRewardsToday(db, campaign.id, user.id)
  };
}

/**
 * Read-only hunt/referral snapshot for an already-started user. Used by the
 * client to refresh earned-share counts without re-triggering hunt_started
 * analytics the way startHunt does.
 */
export async function getHuntSnapshot(input: { campaignSlug: string; slotId: string; phone: string }) {
  const db = await getDb();
  const campaign = await getCampaignOrThrow(db, input.campaignSlug);
  const slotRow = await one(db, "SELECT * FROM slots WHERE id = ? AND campaign_id = ?", [input.slotId, campaign.id]);
  if (!slotRow) throw new AppError("E-SLOT-404", "Selected slot was not found", 404);
  const normalized = normalizePhone(input.phone);
  const userRow = normalized ? await one(db, "SELECT * FROM users WHERE campaign_id = ? AND phone = ?", [campaign.id, normalized]) : undefined;
  if (!userRow) throw new AppError("E-USER-404", "No hunt session found for this phone number", 404);
  const user = mapUser(userRow);
  return huntState(db, campaign, mapSlot(slotRow), user);
}

export async function dashboardMetrics(campaignId: string) {
  const db = await getDb();
  const campaign = await getCampaignOrThrow(db, campaignId);
  const slots = await publicSlots(campaign.id);
  const countEvent = async (name: string) =>
    Number(
      (await one(db, "SELECT COUNT(*) AS c FROM analytics_events WHERE campaign_id = ? AND event_name = ?", [campaign.id, name])).c
    );
  const vouchers = (await all(db, "SELECT * FROM vouchers WHERE campaign_id = ?", [campaign.id])).map(mapVoucher);
  const attempts = (await all(db, "SELECT * FROM attempts WHERE campaign_id = ?", [campaign.id])).map(mapAttempt);
  const noShows = Number(
    (await one(db, "SELECT COUNT(*) AS c FROM reservations WHERE campaign_id = ? AND status = 'No-show'", [campaign.id])).c
  );
  return {
    campaign,
    summary: {
      visits: await countEvent("campaign_page_view"),
      hunts: await countEvent("hunt_started"),
      attemptsUsed: attempts.length,
      candidatesGenerated: await countEvent("voucher_candidate_generated"),
      finalVouchersIssued: vouchers.length,
      redemptions: vouchers.filter((v) => v.status === "Redeemed").length,
      noShows
    },
    slotPerformance: slots.map((slot) => ({
      slot,
      issued: vouchers.filter((v) => v.slotId === slot.id).length,
      attempts: attempts.filter((a) => a.slotId === slot.id).length,
      redeemed: vouchers.filter((v) => v.slotId === slot.id && v.status === "Redeemed").length
    })),
    benefitPerformance: Object.values(
      attempts.reduce<Record<string, { label: string; generated: number; selected: number }>>((acc, attempt) => {
        acc[attempt.displayLabel] ??= { label: attempt.displayLabel, generated: 0, selected: 0 };
        acc[attempt.displayLabel].generated += 1;
        if (attempt.status === "Selected") acc[attempt.displayLabel].selected += 1;
        return acc;
      }, {})
    )
  };
}

function csvRow(values: unknown[]) {
  return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
}

function csvSection(title: string, headers: string[], rows: unknown[][]) {
  return [`# ${title}`, csvRow(headers), ...rows.map(csvRow)].join("\n");
}

export async function exportCampaignCsv(campaignId: string) {
  const db = await getDb();
  const campaign = await getCampaignOrThrow(db, campaignId);

  const users = (await all(db, "SELECT * FROM users WHERE campaign_id = ?", [campaign.id])).map(mapUser);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const slots = (await all(db, "SELECT * FROM slots WHERE campaign_id = ?", [campaign.id])).map(mapSlot);
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const attempts = (await all(db, "SELECT * FROM attempts WHERE campaign_id = ?", [campaign.id])).map(mapAttempt);
  const vouchers = (await all(db, "SELECT * FROM vouchers WHERE campaign_id = ?", [campaign.id])).map(mapVoucher);
  const vouchersById = new Map(vouchers.map((voucher) => [voucher.id, voucher]));
  const redemptions = vouchers.length
    ? (
        await all(
          db,
          `SELECT * FROM redemption_logs WHERE voucher_id IN (${vouchers.map(() => "?").join(",")})`,
          vouchers.map((voucher) => voucher.id)
        )
      ).map(mapRedemptionLog)
    : [];

  const leadsSection = csvSection(
    "LEADS",
    ["user_id", "name", "phone", "email", "created_at"],
    users.map((user) => [user.id, user.name ?? "", user.phone, user.email ?? "", user.createdAt])
  );

  const vouchersSection = csvSection(
    "VOUCHERS",
    ["voucher_code", "phone", "name", "benefit", "status", "issued_at", "expires_at", "redeemed_at", "slot_date", "slot_start", "slot_end"],
    vouchers.map((voucher) => {
      const user = usersById.get(voucher.userId);
      const slot = slotsById.get(voucher.slotId);
      return [
        voucher.voucherCode,
        user?.phone ?? "",
        user?.name ?? "",
        voucher.displayLabel,
        voucher.status,
        voucher.issuedAt,
        voucher.expiresAt,
        voucher.redeemedAt ?? "",
        slot?.date ?? "",
        slot?.startTime ?? "",
        slot?.endTime ?? ""
      ];
    })
  );

  const attemptsSection = csvSection(
    "ATTEMPTS",
    ["attempt_id", "phone", "attempt_number", "source_type", "benefit", "status", "slot_date", "created_at", "expires_at"],
    attempts.map((attempt) => {
      const user = usersById.get(attempt.userId);
      const slot = slotsById.get(attempt.slotId);
      return [
        attempt.id,
        user?.phone ?? "",
        attempt.attemptNumber,
        attempt.sourceType,
        attempt.displayLabel,
        attempt.status,
        slot?.date ?? "",
        attempt.createdAt,
        attempt.expiresAt
      ];
    })
  );

  const redemptionsSection = csvSection(
    "REDEMPTIONS",
    ["voucher_code", "phone", "staff_name", "purchase_amount", "note", "redeemed_at"],
    redemptions.map((redemption) => {
      const voucher = vouchersById.get(redemption.voucherId);
      const user = voucher ? usersById.get(voucher.userId) : undefined;
      return [
        voucher?.voucherCode ?? "",
        user?.phone ?? "",
        redemption.staffName,
        redemption.purchaseAmount ?? "",
        redemption.note ?? "",
        redemption.createdAt
      ];
    })
  );

  return [leadsSection, vouchersSection, attemptsSection, redemptionsSection].join("\n\n");
}

/**
 * Marks a confirmed restaurant reservation (and its voucher) as No-show.
 * Only a reservation still in the Reserved state can be flagged; a redeemed
 * voucher cannot be marked no-show.
 */
export function markNoShow(input: { codeOrToken: string; staffName?: string }) {
  return withTx(async (tx) => {
    const voucher = await loadVoucherContext(tx, input.codeOrToken);
    if (voucher.status === "Redeemed") {
      throw new AppError("E-VOUCHER-REDEEMED", "A redeemed voucher cannot be marked no-show", 409);
    }
    const reservationRow = await one(tx, "SELECT * FROM reservations WHERE voucher_id = ?", [voucher.id]);
    if (!reservationRow) throw new AppError("E-RESERVATION-404", "No reservation exists for this voucher", 404);
    const reservation = mapReservation(reservationRow);
    if (reservation.status !== "Reserved") {
      throw new AppError("E-RESERVATION-STATE", "Only a reserved booking can be marked no-show", 409);
    }
    await run(tx, "UPDATE reservations SET status = 'No-show' WHERE id = ?", [reservation.id]);
    await run(tx, "UPDATE vouchers SET status = 'NoShow' WHERE id = ?", [voucher.id]);
    await addAnalytics(tx, voucher.campaignId, "reservation_no_show", { staffName: input.staffName }, voucher.userId, voucher.slotId);
    return { voucherId: voucher.id, reservationId: reservation.id, status: "No-show" as const };
  });
}

/**
 * Moves an issued restaurant reservation to a different active slot, when the
 * campaign allows rescheduling. Capacity is transferred atomically: the new
 * slot is decremented with a guarded update and the old slot is returned.
 */
export function rescheduleReservation(input: { codeOrToken: string; newSlotId: string }) {
  return withTx(async (tx) => {
    const voucher = await loadVoucherContext(tx, input.codeOrToken);
    const campaign = mapCampaign(await one(tx, "SELECT * FROM campaigns WHERE id = ?", [voucher.campaignId]));
    if (!campaign.allowReschedule) {
      throw new AppError("E-RESCHEDULE-DISABLED", "Rescheduling is not enabled for this campaign", 403);
    }
    if (voucher.status !== "Issued") {
      throw new AppError("E-VOUCHER-STATE", "Only an active issued voucher can be rescheduled", 409);
    }
    if (input.newSlotId === voucher.slotId) {
      throw new AppError("E-RESCHEDULE-SAME", "Choose a slot different from the current one", 422);
    }
    const reservationRow = await one(tx, "SELECT * FROM reservations WHERE voucher_id = ?", [voucher.id]);
    if (!reservationRow) throw new AppError("E-RESERVATION-404", "No reservation exists for this voucher", 404);
    const reservation = mapReservation(reservationRow);
    if (reservation.status !== "Reserved") {
      throw new AppError("E-RESERVATION-STATE", "Only a reserved booking can be rescheduled", 409);
    }
    const newSlot = await getSlotOrThrow(tx, input.newSlotId, campaign.id);

    const cap = await run(
      tx,
      `UPDATE slots
       SET remaining_capacity = remaining_capacity - 1,
           status = CASE WHEN remaining_capacity - 1 <= 0 THEN 'sold_out' ELSE status END
       WHERE id = ? AND remaining_capacity > 0`,
      [newSlot.id]
    );
    if (cap !== 1) throw new AppError("E-SLOT-SOLD-OUT", "Selected slot is sold out", 409);

    await run(
      tx,
      `UPDATE slots
       SET remaining_capacity = remaining_capacity + 1,
           status = CASE WHEN status = 'sold_out' THEN 'active' ELSE status END
       WHERE id = ?`,
      [voucher.slotId]
    );

    await run(tx, "UPDATE vouchers SET slot_id = ? WHERE id = ?", [newSlot.id, voucher.id]);
    await run(tx, "UPDATE reservations SET slot_id = ? WHERE id = ?", [newSlot.id, reservation.id]);

    // Slot-bound vouchers must follow their new slot's validity window.
    const attemptRow = await one(tx, "SELECT * FROM attempts WHERE id = ?", [voucher.selectedAttemptId]);
    if (attemptRow) {
      const poolRow = await one(tx, "SELECT * FROM pools WHERE id = ?", [mapAttempt(attemptRow).poolId]);
      if (poolRow) {
        const pool = mapPool(poolRow);
        if (pool.expiryType === "selected_slot_only") {
          await run(tx, "UPDATE vouchers SET expires_at = ? WHERE id = ?", [expiryFor(pool, newSlot), voucher.id]);
        }
      }
    }

    await addAnalytics(tx, campaign.id, "reservation_rescheduled", { from: voucher.slotId, to: newSlot.id }, voucher.userId, newSlot.id);
    const freshVoucher = mapVoucher(await one(tx, "SELECT * FROM vouchers WHERE id = ?", [voucher.id]));
    const freshNewSlot = mapSlot(await one(tx, "SELECT * FROM slots WHERE id = ?", [newSlot.id]));
    return { voucher: freshVoucher, newSlot: freshNewSlot };
  });
}

export type RedemptionImportRow = {
  code: string;
  status: "redeemed" | "already_redeemed" | "expired" | "not_found";
};

/**
 * Bulk-marks vouchers as redeemed from a CSV export (e.g. a Shopify used-codes
 * report). Accepts one code per line, optional second column = purchase amount,
 * with an optional header row. Each valid code is redeemed transactionally.
 */
export async function importRedemptions(input: { campaignId: string; csv: string; staffName: string }) {
  const db = await getDb();
  const campaign = await getCampaignOrThrow(db, input.campaignId);
  const lines = input.csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const results: RedemptionImportRow[] = [];
  let redeemed = 0;

  for (const line of lines) {
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const code = cells[0];
    const header = code?.toLowerCase();
    if (!code || header === "voucher_code" || header === "code") continue; // skip header row
    const amountRaw = cells[1] ? Number(cells[1]) : undefined;
    const amount = amountRaw !== undefined && Number.isFinite(amountRaw) ? amountRaw : undefined;

    const row = await one(db, "SELECT * FROM vouchers WHERE (UPPER(voucher_code) = ? OR UPPER(qr_token) = ?) AND campaign_id = ?", [
      code.toUpperCase(),
      code.toUpperCase(),
      campaign.id
    ]);
    if (!row) {
      results.push({ code, status: "not_found" });
      continue;
    }
    const voucher = mapVoucher(row);
    if (voucher.status === "Redeemed") {
      results.push({ code, status: "already_redeemed" });
      continue;
    }
    if (new Date(voucher.expiresAt).getTime() < Date.now()) {
      results.push({ code, status: "expired" });
      continue;
    }
    await withTx(async (tx) => {
      await run(tx, "UPDATE vouchers SET status = 'Redeemed', redeemed_at = ? WHERE id = ?", [isoNow(), voucher.id]);
      await run(tx, "UPDATE reservations SET status = 'Redeemed' WHERE voucher_id = ?", [voucher.id]);
      await run(
        tx,
        `INSERT INTO redemption_logs (id, voucher_id, staff_name, purchase_amount, note, created_at)
         VALUES (?, ?, ?, ?, 'csv_import', ?)`,
        [id("red"), voucher.id, input.staffName, amount ?? null, isoNow()]
      );
      await addAnalytics(tx, campaign.id, "voucher_redeemed", { source: "csv_import", purchaseAmount: amount }, voucher.userId, voucher.slotId);
    });
    results.push({ code, status: "redeemed" });
    redeemed += 1;
  }

  return { total: results.length, redeemed, skipped: results.length - redeemed, results };
}
