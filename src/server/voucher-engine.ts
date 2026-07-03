import crypto from "node:crypto";
import type BetterSqlite3 from "better-sqlite3";
import { AppError } from "@/server/errors";
import {
  getDb,
  mapAttempt,
  mapBusiness,
  mapCampaign,
  mapPool,
  mapReferralReward,
  mapRedemptionLog,
  mapSlot,
  mapUser,
  mapVoucher
} from "@/server/db";
import { normalizePhone } from "@/server/phone";
import { sendSms, type SmsResult } from "@/server/sms";
import type { Campaign, CampaignSlot, EndUser, SourceType, Voucher, VoucherAttempt, VoucherPool } from "@/types/voucher";

const now = () => new Date();
const isoNow = () => now().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
const startOfTodayIso = () => {
  const d = now();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

function isUniqueViolation(error: unknown) {
  return error instanceof Error && "code" in error && String((error as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT");
}

function addAnalytics(
  db: BetterSqlite3.Database,
  campaignId: string,
  eventName: string,
  metadata?: Record<string, unknown>,
  userId?: string,
  slotId?: string
) {
  db.prepare(
    `INSERT INTO analytics_events (id, campaign_id, event_name, user_id, slot_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id("evt"), campaignId, eventName, userId ?? null, slotId ?? null, metadata ? JSON.stringify(metadata) : null, isoNow());
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

function campaignByIdOrSlug(db: BetterSqlite3.Database, key: string) {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ? OR slug = ?").get(key, key);
  return row ? mapCampaign(row) : undefined;
}

function getCampaignOrThrow(db: BetterSqlite3.Database, key: string) {
  const campaign = campaignByIdOrSlug(db, key);
  if (!campaign || campaign.status !== "active") {
    throw new AppError("E-CAMPAIGN-404", "Campaign is not available", 404);
  }
  return campaign;
}

function getSlotOrThrow(db: BetterSqlite3.Database, slotId: string, campaignId: string) {
  const row = db.prepare("SELECT * FROM slots WHERE id = ? AND campaign_id = ?").get(slotId, campaignId);
  if (!row) throw new AppError("E-SLOT-404", "Selected slot was not found", 404);
  const slot = mapSlot(row);
  if (slot.status !== "active" || slot.remainingCapacity <= 0) {
    throw new AppError("E-SLOT-SOLD-OUT", "Selected slot is sold out", 409);
  }
  return slot;
}

function findOrCreateUser(
  db: BetterSqlite3.Database,
  campaignId: string,
  phone: string,
  sessionId: string,
  name?: string,
  email?: string
): EndUser {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  }
  const existingRow = db.prepare("SELECT * FROM users WHERE campaign_id = ? AND phone = ?").get(campaignId, normalized);
  if (existingRow) {
    const existing = mapUser(existingRow);
    db.prepare("UPDATE users SET name = ?, email = ?, session_id = ? WHERE id = ?").run(
      name ?? existing.name ?? null,
      email ?? existing.email ?? null,
      sessionId || existing.sessionId,
      existing.id
    );
    return mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id));
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
  db.prepare(
    "INSERT INTO users (id, campaign_id, name, phone, email, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(user.id, campaignId, name ?? null, normalized, email ?? null, sessionId, user.createdAt);
  return user;
}

function hasFinalVoucher(db: BetterSqlite3.Database, campaignId: string, userId: string) {
  return Boolean(db.prepare("SELECT 1 FROM vouchers WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId));
}

function countGrantedRewardsToday(db: BetterSqlite3.Database, campaignId: string, referrerUserId: string) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM referral_rewards
         WHERE campaign_id = ? AND referrer_user_id = ? AND status = 'granted' AND created_at >= ?`
      )
      .get(campaignId, referrerUserId, startOfTodayIso()) as { c: number }
  ).c;
}

function countBonusAttemptsUsedToday(db: BetterSqlite3.Database, campaignId: string, userId: string) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM attempts
         WHERE campaign_id = ? AND user_id = ? AND source_type = 'referral_bonus' AND created_at >= ?`
      )
      .get(campaignId, userId, startOfTodayIso()) as { c: number }
  ).c;
}

function remainingBonusAttempts(db: BetterSqlite3.Database, campaign: Campaign, userId: string) {
  const granted = Math.min(countGrantedRewardsToday(db, campaign.id, userId), campaign.referralDailyLimit);
  const used = countBonusAttemptsUsedToday(db, campaign.id, userId);
  return Math.max(0, granted - used);
}

function insertReferralReward(
  db: BetterSqlite3.Database,
  campaignId: string,
  referrerUserId: string,
  visitorSessionId: string,
  status: "granted" | "rejected",
  reason?: string
) {
  db.prepare(
    `INSERT INTO referral_rewards (id, campaign_id, referrer_user_id, visitor_session_id, status, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id("ref"), campaignId, referrerUserId, visitorSessionId, status, reason ?? null, isoNow());
}

/**
 * Records a visit to a shared referral link. Grants the referrer 1 extra
 * attempt if the visitor is a distinct session/device and the referrer's
 * daily referral limit has not been reached. Each (referrer, visitor) pair
 * can grant at most once, ever, so reloading a link cannot farm rewards.
 */
export function recordReferralOpen(input: { campaignSlug: string; ref: string; visitorSessionId: string }) {
  const db = getDb();
  return db.transaction(() => {
    const campaign = getCampaignOrThrow(db, input.campaignSlug);
    const referrerRow = db.prepare("SELECT * FROM users WHERE id = ? AND campaign_id = ?").get(input.ref, campaign.id);
    if (!referrerRow) throw new AppError("E-REFERRAL-404", "Referral link is invalid", 404);
    const referrer = mapUser(referrerRow);

    addAnalytics(db, campaign.id, "share_link_opened", { referrerUserId: referrer.id });

    const existingRow = db
      .prepare("SELECT * FROM referral_rewards WHERE campaign_id = ? AND referrer_user_id = ? AND visitor_session_id = ?")
      .get(campaign.id, referrer.id, input.visitorSessionId);
    if (existingRow) {
      const existing = mapReferralReward(existingRow);
      return { granted: existing.status === "granted", reason: existing.reason };
    }

    if (referrer.sessionId === input.visitorSessionId) {
      insertReferralReward(db, campaign.id, referrer.id, input.visitorSessionId, "rejected", "self_referral");
      return { granted: false, reason: "self_referral" };
    }

    if (countGrantedRewardsToday(db, campaign.id, referrer.id) >= campaign.referralDailyLimit) {
      insertReferralReward(db, campaign.id, referrer.id, input.visitorSessionId, "rejected", "daily_limit_reached");
      return { granted: false, reason: "daily_limit_reached" };
    }

    try {
      insertReferralReward(db, campaign.id, referrer.id, input.visitorSessionId, "granted");
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { granted: false, reason: "already_processed" };
      }
      throw error;
    }
    addAnalytics(db, campaign.id, "extra_attempt_granted", { referrerUserId: referrer.id }, referrer.id);
    return { granted: true };
  })();
}

export function publicSlots(campaignId: string) {
  const db = getDb();
  const slots = db.prepare("SELECT * FROM slots WHERE campaign_id = ?").all(campaignId).map(mapSlot);
  return slots.map((slot) => {
    const agg = db
      .prepare("SELECT COALESCE(SUM(remaining_quantity), 0) AS q FROM pools WHERE slot_id = ? AND status = 'active'")
      .get(slot.id) as { q: number };
    return { ...slot, remainingPoolQuantity: agg.q };
  });
}

export function getPublicCampaign(slug: string) {
  const db = getDb();
  const campaign = getCampaignOrThrow(db, slug);
  const businessRow = db.prepare("SELECT * FROM businesses WHERE id = ?").get(campaign.businessId);
  db.transaction(() => addAnalytics(db, campaign.id, "campaign_page_view"))();
  return {
    campaign,
    business: businessRow ? mapBusiness(businessRow) : undefined,
    slots: publicSlots(campaign.id)
  };
}

export function listCampaignSlots(slug: string) {
  const db = getDb();
  const campaign = getCampaignOrThrow(db, slug);
  return publicSlots(campaign.id);
}

/** Active campaigns for the public campaign switcher/tab bar. */
export function listActiveCampaigns() {
  const db = getDb();
  return db
    .prepare("SELECT * FROM campaigns WHERE status = 'active' ORDER BY start_date DESC")
    .all()
    .map(mapCampaign);
}

export function startHunt(input: {
  campaignSlug: string;
  slotId: string;
  phone: string;
  sessionId: string;
  name?: string;
  email?: string;
}) {
  const db = getDb();
  const result = db.transaction(() => {
    const campaign = getCampaignOrThrow(db, input.campaignSlug);
    const slot = getSlotOrThrow(db, input.slotId, campaign.id);
    const user = findOrCreateUser(db, campaign.id, input.phone, input.sessionId, input.name, input.email);
    if (hasFinalVoucher(db, campaign.id, user.id)) {
      throw new AppError("E-DUPLICATE-FINAL", "This phone number already has a final voucher for this campaign", 409);
    }
    addAnalytics(db, campaign.id, "hunt_started", { phone: user.phone }, user.id, slot.id);
    return { campaign, slot, user };
  })();
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
  const db = getDb();
  const sourceType = input.sourceType ?? "base";
  return db.transaction(() => {
    const campaign = getCampaignOrThrow(db, input.campaignSlug);
    const slot = getSlotOrThrow(db, input.slotId, campaign.id);
    const user = findOrCreateUser(db, campaign.id, input.phone, input.sessionId);
    if (hasFinalVoucher(db, campaign.id, user.id)) {
      throw new AppError("E-DUPLICATE-FINAL", "Final voucher already issued", 409);
    }
    expireCandidates(db);

    const attempts = db.prepare("SELECT * FROM attempts WHERE campaign_id = ? AND user_id = ?").all(campaign.id, user.id).map(mapAttempt);
    const activeAttempts = attempts.filter((a) => a.status === "Candidate" || a.status === "Held");
    if (sourceType === "base") {
      if (attempts.filter((a) => a.sourceType === "base").length >= campaign.baseAttempts) {
        throw new AppError("E-ATTEMPT-LIMIT", "Base voucher hunt attempts are already used", 409);
      }
    } else if (sourceType === "referral_bonus") {
      if (remainingBonusAttempts(db, campaign, user.id) <= 0) {
        throw new AppError("E-ATTEMPT-LIMIT", "No extra attempts earned yet. Share your link to earn one.", 409);
      }
    }

    const pools = db
      .prepare("SELECT * FROM pools WHERE slot_id = ? AND status = 'active' AND remaining_quantity > 0")
      .all(slot.id)
      .map(mapPool);
    if (pools.length === 0) throw new AppError("E-POOL-EMPTY", "No voucher benefits remain for this slot", 409);

    const pool = weightedPool(pools, new Set(activeAttempts.map((a) => a.displayLabel)));

    // Conditional decrement: guards against over-issue across connections/processes.
    const dec = db
      .prepare(
        `UPDATE pools
         SET remaining_quantity = remaining_quantity - 1,
             status = CASE WHEN remaining_quantity - 1 <= 0 THEN 'depleted' ELSE status END
         WHERE id = ? AND remaining_quantity > 0`
      )
      .run(pool.id);
    if (dec.changes !== 1) throw new AppError("E-POOL-EMPTY", "No voucher benefits remain for this slot", 409);

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
    db.prepare(
      `INSERT INTO attempts (id, campaign_id, slot_id, user_id, attempt_number, source_type, benefit_type, benefit_value, display_label, pool_id, status, expires_at, created_at)
       VALUES (@id, @campaignId, @slotId, @userId, @attemptNumber, @sourceType, @benefitType, @benefitValue, @displayLabel, @poolId, @status, @expiresAt, @createdAt)`
    ).run(attempt);
    addAnalytics(db, campaign.id, "voucher_candidate_generated", { benefit: attempt.displayLabel }, user.id, slot.id);
    return attempt;
  })();
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
  const db = getDb();
  return db.transaction(() => {
    const campaign = getCampaignOrThrow(db, input.campaignSlug);
    const user = findOrCreateUser(db, campaign.id, input.phone, input.sessionId, input.name, input.email);
    if (hasFinalVoucher(db, campaign.id, user.id)) {
      throw new AppError("E-DUPLICATE-FINAL", "This phone number already has a final voucher for this campaign", 409);
    }
    expireCandidates(db);

    const attemptRow = db
      .prepare("SELECT * FROM attempts WHERE id = ? AND campaign_id = ? AND user_id = ?")
      .get(input.attemptId, campaign.id, user.id);
    if (!attemptRow) throw new AppError("E-ATTEMPT-404", "Selected candidate was not found", 404);
    const attempt = mapAttempt(attemptRow);
    if (attempt.status !== "Candidate" && attempt.status !== "Held") {
      throw new AppError("E-ATTEMPT-STATE", "Selected candidate is no longer available", 409);
    }
    if (new Date(attempt.expiresAt).getTime() < Date.now()) {
      releaseAttempt(db, attempt);
      throw new AppError("E-ATTEMPT-EXPIRED", "Selected candidate has expired", 409);
    }

    const slot = getSlotOrThrow(db, attempt.slotId, campaign.id);
    const poolRow = db.prepare("SELECT * FROM pools WHERE id = ?").get(attempt.poolId);
    const pool = mapPool(poolRow);

    // Conditional capacity decrement guards the slot against over-booking.
    const cap = db
      .prepare(
        `UPDATE slots
         SET remaining_capacity = remaining_capacity - 1,
             status = CASE WHEN remaining_capacity - 1 <= 0 THEN 'sold_out' ELSE status END
         WHERE id = ? AND remaining_capacity > 0`
      )
      .run(slot.id);
    if (cap.changes !== 1) throw new AppError("E-SLOT-SOLD-OUT", "Selected slot is sold out", 409);

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
      db.prepare(
        `INSERT INTO vouchers (id, campaign_id, slot_id, user_id, selected_attempt_id, voucher_code, qr_token, benefit_type, benefit_value, display_label, status, issued_at, expires_at, redeemed_at)
         VALUES (@id, @campaignId, @slotId, @userId, @selectedAttemptId, @voucherCode, @qrToken, @benefitType, @benefitValue, @displayLabel, @status, @issuedAt, @expiresAt, @redeemedAt)`
      ).run(voucher);
    } catch (error) {
      // UNIQUE(campaign_id, user_id) is the authoritative one-final-voucher guard under concurrency.
      if (isUniqueViolation(error)) {
        throw new AppError("E-DUPLICATE-FINAL", "This phone number already has a final voucher for this campaign", 409);
      }
      throw error;
    }

    db.prepare("UPDATE attempts SET status = 'Selected' WHERE id = ?").run(attempt.id);
    // Release every other candidate for this user back to the pool.
    db.prepare("SELECT * FROM attempts WHERE campaign_id = ? AND user_id = ? AND id != ?")
      .all(campaign.id, user.id, attempt.id)
      .map(mapAttempt)
      .forEach((other) => releaseAttempt(db, other));

    if (campaign.mode === "restaurant") {
      db.prepare(
        `INSERT INTO reservations (id, campaign_id, slot_id, user_id, voucher_id, guest_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Reserved', ?)`
      ).run(id("res"), campaign.id, slot.id, user.id, voucher.id, input.guestCount ?? null, isoNow());
    }

    addAnalytics(db, campaign.id, "voucher_final_selected", { voucherCode: voucher.voucherCode }, user.id, slot.id);
    addAnalytics(db, campaign.id, "voucher_issued", { benefit: voucher.displayLabel }, user.id, slot.id);

    const freshSlot = mapSlot(db.prepare("SELECT * FROM slots WHERE id = ?").get(slot.id));
    const freshVoucher = mapVoucher(db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucher.id));
    return { voucher: freshVoucher, slot: freshSlot, campaign, user };
  })();
}

/**
 * Sends the actual SMS confirmation for a just-issued voucher. Kept outside
 * selectFinalVoucher's transaction: better-sqlite3 transactions must run
 * synchronously, but real SMS providers require a network call. The voucher
 * is already committed by the time this runs, so a failed send never rolls
 * back the issuance -- it's recorded in sms_logs instead.
 */
export async function sendVoucherConfirmationSms(voucherId: string): Promise<SmsResult> {
  const db = getDb();
  const voucherRow = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucherId);
  if (!voucherRow) throw new AppError("E-VOUCHER-404", "Voucher was not found", 404);
  const voucher = mapVoucher(voucherRow);
  const context = loadSmsContext(db, voucher);
  const message = smsBody(db, context.campaign, voucher, context.slot, context.user);
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
  const db = getDb();
  const voucher = loadVoucherContext(db, input.codeOrToken);
  const context = loadSmsContext(db, voucher);
  const message = smsBody(db, context.campaign, voucher, context.slot, context.user);
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

function loadSmsContext(db: BetterSqlite3.Database, voucher: Voucher) {
  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(voucher.userId);
  const slotRow = db.prepare("SELECT * FROM slots WHERE id = ?").get(voucher.slotId);
  const campaignRow = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(voucher.campaignId);
  if (!userRow || !slotRow || !campaignRow) {
    throw new AppError("E-VOUCHER-404", "Voucher context is incomplete", 404);
  }
  return { user: mapUser(userRow), slot: mapSlot(slotRow), campaign: mapCampaign(campaignRow) };
}

/** Sends via the configured SMS provider and records the attempt in sms_logs. */
async function dispatchSms(
  db: BetterSqlite3.Database,
  params: { campaignId: string; userId: string; voucherId: string; slotId: string; phone: string; message: string }
): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";
  const smsLogId = id("sms");
  db.prepare(
    `INSERT INTO sms_logs (id, campaign_id, user_id, voucher_id, to_number, body, provider, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(smsLogId, params.campaignId, params.userId, params.voucherId, params.phone, params.message, provider, isoNow());

  const result = await sendSms(params.phone, params.message);

  db.prepare(
    `UPDATE sms_logs SET status = ?, provider_message_id = ?, failure_reason = ? WHERE id = ?`
  ).run(result.success ? "sent" : "failed", result.providerMessageId ?? null, result.error ?? null, smsLogId);

  if (result.success) {
    addAnalytics(db, params.campaignId, "sms_sent", { provider }, params.userId, params.slotId);
  }

  return result;
}

function smsBody(
  db: BetterSqlite3.Database,
  campaign: Campaign,
  voucher: { voucherCode: string; displayLabel: string; expiresAt: string },
  slot: CampaignSlot,
  user: EndUser
) {
  const businessRow = db.prepare("SELECT * FROM businesses WHERE id = ?").get(campaign.businessId);
  const business = businessRow ? mapBusiness(businessRow) : undefined;
  const where = campaign.mode === "restaurant" ? "Show this SMS at the restaurant." : `Shop here: ${campaign.shopUrl ?? "campaign shop"}.`;
  return `[${business?.name ?? "BizFlow"}] Your voucher is confirmed. Code: ${voucher.voucherCode}. Benefit: ${voucher.displayLabel}. Date/Time: ${slot.date} ${slot.startTime}-${slot.endTime}. ${where} Valid until ${voucher.expiresAt}. Terms: ${campaign.terms}. ${user.name ? `Name: ${user.name}.` : ""}`;
}

function releaseAttempt(db: BetterSqlite3.Database, attempt: VoucherAttempt) {
  if (attempt.status === "Candidate" || attempt.status === "Held") {
    db.prepare(
      `UPDATE pools
       SET remaining_quantity = remaining_quantity + 1,
           status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END
       WHERE id = ?`
    ).run(attempt.poolId);
    db.prepare("UPDATE attempts SET status = 'Released' WHERE id = ?").run(attempt.id);
  }
}

/** Expire timed-out candidates and return their held stock. Runs inside a caller transaction. */
function expireCandidates(db: BetterSqlite3.Database) {
  const nowIso = isoNow();
  const stale = db
    .prepare("SELECT * FROM attempts WHERE status IN ('Candidate', 'Held') AND expires_at < ?")
    .all(nowIso)
    .map(mapAttempt);
  stale.forEach((attempt) => {
    db.prepare(
      `UPDATE pools
       SET remaining_quantity = remaining_quantity + 1,
           status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END
       WHERE id = ?`
    ).run(attempt.poolId);
    db.prepare("UPDATE attempts SET status = 'Expired' WHERE id = ?").run(attempt.id);
  });
  return stale.length > 0;
}

export function expireOldCandidates() {
  const db = getDb();
  return db.transaction(() => expireCandidates(db))();
}

function loadVoucherContext(db: BetterSqlite3.Database, codeOrToken: string) {
  const key = codeOrToken.trim();
  const upper = key.toUpperCase();
  const row =
    db.prepare("SELECT * FROM vouchers WHERE UPPER(voucher_code) = ? OR UPPER(qr_token) = ?").get(upper, upper);
  if (!row) throw new AppError("E-VOUCHER-404", "Voucher was not found", 404);
  return mapVoucher(row);
}

export function validateVoucher(input: { codeOrToken: string }) {
  const db = getDb();
  return db.transaction(() => {
    const voucher = loadVoucherContext(db, input.codeOrToken);
    if (new Date(voucher.expiresAt).getTime() < Date.now() && voucher.status !== "Redeemed") {
      db.prepare("UPDATE vouchers SET status = 'Expired' WHERE id = ?").run(voucher.id);
      voucher.status = "Expired";
    }
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(voucher.userId);
    const slotRow = db.prepare("SELECT * FROM slots WHERE id = ?").get(voucher.slotId);
    const campaignRow = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(voucher.campaignId);
    const campaign = campaignRow ? mapCampaign(campaignRow) : undefined;
    const businessRow = campaign ? db.prepare("SELECT * FROM businesses WHERE id = ?").get(campaign.businessId) : undefined;
    return {
      voucher,
      user: userRow ? mapUser(userRow) : undefined,
      slot: slotRow ? mapSlot(slotRow) : undefined,
      campaign,
      business: businessRow ? mapBusiness(businessRow) : undefined
    };
  })();
}

export function redeemVoucher(input: { codeOrToken: string; staffName: string; purchaseAmount?: number; note?: string }) {
  const db = getDb();
  db.transaction(() => {
    const voucher = loadVoucherContext(db, input.codeOrToken);
    if (voucher.status === "Redeemed") throw new AppError("E-VOUCHER-REDEEMED", "Voucher is already redeemed", 409);
    if (new Date(voucher.expiresAt).getTime() < Date.now()) throw new AppError("E-VOUCHER-EXPIRED", "Voucher is expired", 409);
    db.prepare("UPDATE vouchers SET status = 'Redeemed', redeemed_at = ? WHERE id = ?").run(isoNow(), voucher.id);
    db.prepare("UPDATE reservations SET status = 'Redeemed' WHERE voucher_id = ?").run(voucher.id);
    db.prepare(
      `INSERT INTO redemption_logs (id, voucher_id, staff_name, purchase_amount, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id("red"), voucher.id, input.staffName, input.purchaseAmount ?? null, input.note ?? null, isoNow());
    addAnalytics(db, voucher.campaignId, "voucher_redeemed", { purchaseAmount: input.purchaseAmount }, voucher.userId, voucher.slotId);
  })();
  return validateVoucher({ codeOrToken: input.codeOrToken });
}

function huntState(db: BetterSqlite3.Database, campaign: Campaign, slot: CampaignSlot, user: EndUser) {
  const attempts = db.prepare("SELECT * FROM attempts WHERE campaign_id = ? AND user_id = ?").all(campaign.id, user.id).map(mapAttempt);
  const voucherRow = db.prepare("SELECT * FROM vouchers WHERE campaign_id = ? AND user_id = ?").get(campaign.id, user.id);
  return {
    user,
    campaign,
    slot,
    attempts,
    voucher: voucherRow ? mapVoucher(voucherRow) : undefined,
    remainingBaseAttempts: Math.max(0, campaign.baseAttempts - attempts.filter((a) => a.sourceType === "base").length),
    remainingBonusAttempts: remainingBonusAttempts(db, campaign, user.id),
    sharesGrantedToday: countGrantedRewardsToday(db, campaign.id, user.id)
  };
}

/**
 * Read-only hunt/referral snapshot for an already-started user. Used by the
 * client to refresh earned-share counts without re-triggering hunt_started
 * analytics the way startHunt does.
 */
export function getHuntSnapshot(input: { campaignSlug: string; slotId: string; phone: string }) {
  const db = getDb();
  const campaign = getCampaignOrThrow(db, input.campaignSlug);
  const slotRow = db.prepare("SELECT * FROM slots WHERE id = ? AND campaign_id = ?").get(input.slotId, campaign.id);
  if (!slotRow) throw new AppError("E-SLOT-404", "Selected slot was not found", 404);
  const normalized = normalizePhone(input.phone);
  const userRow = normalized
    ? db.prepare("SELECT * FROM users WHERE campaign_id = ? AND phone = ?").get(campaign.id, normalized)
    : undefined;
  if (!userRow) throw new AppError("E-USER-404", "No hunt session found for this phone number", 404);
  const user = mapUser(userRow);
  return huntState(db, campaign, mapSlot(slotRow), user);
}

export function dashboardMetrics(campaignId: string) {
  const db = getDb();
  const campaign = getCampaignOrThrow(db, campaignId);
  const slots = publicSlots(campaign.id);
  const countEvent = (name: string) =>
    (db.prepare("SELECT COUNT(*) AS c FROM analytics_events WHERE campaign_id = ? AND event_name = ?").get(campaign.id, name) as { c: number }).c;
  const vouchers = db.prepare("SELECT * FROM vouchers WHERE campaign_id = ?").all(campaign.id).map(mapVoucher);
  const attempts = db.prepare("SELECT * FROM attempts WHERE campaign_id = ?").all(campaign.id).map(mapAttempt);
  const noShows = (
    db.prepare("SELECT COUNT(*) AS c FROM reservations WHERE campaign_id = ? AND status = 'No-show'").get(campaign.id) as { c: number }
  ).c;
  return {
    campaign,
    summary: {
      visits: countEvent("campaign_page_view"),
      hunts: countEvent("hunt_started"),
      attemptsUsed: attempts.length,
      candidatesGenerated: countEvent("voucher_candidate_generated"),
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

export function exportCampaignCsv(campaignId: string) {
  const db = getDb();
  const campaign = getCampaignOrThrow(db, campaignId);

  const users = db.prepare("SELECT * FROM users WHERE campaign_id = ?").all(campaign.id).map(mapUser);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const slots = db.prepare("SELECT * FROM slots WHERE campaign_id = ?").all(campaign.id).map(mapSlot);
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const attempts = db.prepare("SELECT * FROM attempts WHERE campaign_id = ?").all(campaign.id).map(mapAttempt);
  const vouchers = db.prepare("SELECT * FROM vouchers WHERE campaign_id = ?").all(campaign.id).map(mapVoucher);
  const vouchersById = new Map(vouchers.map((voucher) => [voucher.id, voucher]));
  const redemptions = vouchers.length
    ? (db
        .prepare(
          `SELECT * FROM redemption_logs WHERE voucher_id IN (${vouchers.map(() => "?").join(",")})`
        )
        .all(...vouchers.map((voucher) => voucher.id))
        .map(mapRedemptionLog))
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
