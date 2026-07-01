import crypto from "node:crypto";
import type BetterSqlite3 from "better-sqlite3";
import { AppError } from "@/server/errors";
import {
  getDb,
  mapAttempt,
  mapBusiness,
  mapCampaign,
  mapPool,
  mapSlot,
  mapUser,
  mapVoucher
} from "@/server/db";
import type { Campaign, CampaignSlot, EndUser, VoucherAttempt, VoucherPool } from "@/types/voucher";

const now = () => new Date();
const isoNow = () => now().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

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

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
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
  if (!normalized || normalized.length < 7) {
    throw new AppError("E-USER-PHONE", "A valid phone number is required", 400);
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

export function generateCandidate(input: { campaignSlug: string; slotId: string; phone: string; sessionId: string }) {
  const db = getDb();
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
    if (attempts.filter((a) => a.sourceType === "base").length >= campaign.baseAttempts) {
      throw new AppError("E-ATTEMPT-LIMIT", "Base voucher hunt attempts are already used", 409);
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
      sourceType: "base",
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

    db.prepare(
      `INSERT INTO sms_logs (id, campaign_id, user_id, voucher_id, to_number, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'mock_sent', ?)`
    ).run(id("sms"), campaign.id, user.id, voucher.id, user.phone, smsBody(db, campaign, voucher, slot, user), isoNow());

    addAnalytics(db, campaign.id, "voucher_final_selected", { voucherCode: voucher.voucherCode }, user.id, slot.id);
    addAnalytics(db, campaign.id, "voucher_issued", { benefit: voucher.displayLabel }, user.id, slot.id);
    addAnalytics(db, campaign.id, "sms_sent", { provider: "mock" }, user.id, slot.id);

    const freshSlot = mapSlot(db.prepare("SELECT * FROM slots WHERE id = ?").get(slot.id));
    const freshVoucher = mapVoucher(db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucher.id));
    return { voucher: freshVoucher, slot: freshSlot, campaign, user };
  })();
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
    remainingBaseAttempts: Math.max(0, campaign.baseAttempts - attempts.filter((a) => a.sourceType === "base").length)
  };
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

export function exportCampaignCsv(campaignId: string) {
  const db = getDb();
  const campaign = getCampaignOrThrow(db, campaignId);
  const rows = [
    ["voucher_code", "phone", "name", "benefit", "status", "issued_at", "expires_at", "slot_date", "slot_start", "slot_end"].join(",")
  ];
  const vouchers = db.prepare("SELECT * FROM vouchers WHERE campaign_id = ?").all(campaign.id).map(mapVoucher);
  vouchers.forEach((voucher) => {
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(voucher.userId);
    const slotRow = db.prepare("SELECT * FROM slots WHERE id = ?").get(voucher.slotId);
    const user = userRow ? mapUser(userRow) : undefined;
    const slot = slotRow ? mapSlot(slotRow) : undefined;
    rows.push(
      [
        voucher.voucherCode,
        user?.phone ?? "",
        user?.name ?? "",
        voucher.displayLabel,
        voucher.status,
        voucher.issuedAt,
        voucher.expiresAt,
        slot?.date ?? "",
        slot?.startTime ?? "",
        slot?.endTime ?? ""
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    );
  });
  return rows.join("\n");
}
