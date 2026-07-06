import crypto from "node:crypto";
import type BetterSqlite3 from "better-sqlite3";
import { getDb, mapBusiness, mapCampaign } from "@/server/db";
import { AppError } from "@/server/errors";
import { normalizePhone } from "@/server/phone";
import { sendSms, type SmsResult } from "@/server/sms";
import type { Campaign } from "@/types/voucher";

const OTP_TTL_MS = 5 * 60_000;
const isoNow = () => new Date().toISOString();
const otpId = () => `otp_${crypto.randomBytes(6).toString("hex")}`;

function hashCode(campaignId: string, phone: string, code: string) {
  const salt = process.env.OTP_SALT ?? process.env.ADMIN_ACCESS_TOKEN ?? "bizflow-otp";
  return crypto.createHash("sha256").update(`${salt}:${campaignId}:${phone}:${code}`).digest("hex");
}

function activeCampaign(db: BetterSqlite3.Database, slugOrId: string): Campaign {
  const row = db.prepare("SELECT * FROM campaigns WHERE (id = ? OR slug = ?) AND status = 'active'").get(slugOrId, slugOrId);
  if (!row) throw new AppError("E-CAMPAIGN-404", "Campaign is not available", 404);
  return mapCampaign(row);
}

function requireValidPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  return normalized;
}

/** Generates a 6-digit OTP, stores its hash, and sends it via the SMS layer. */
export async function requestOtp(input: {
  campaignSlug: string;
  phone: string;
}): Promise<{ sent: boolean; expiresAt: string; devCode?: string }> {
  const db = getDb();
  const campaign = activeCampaign(db, input.campaignSlug);
  const phone = requireValidPhone(input.phone);
  const businessRow = db.prepare("SELECT * FROM businesses WHERE id = ?").get(campaign.businessId);
  const businessName = businessRow ? mapBusiness(businessRow).name : "BizFlow";

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO otp_challenges (id, campaign_id, phone, code_hash, expires_at, verified, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(otpId(), campaign.id, phone, hashCode(campaign.id, phone, code), expiresAt, isoNow());

  const result: SmsResult = await sendSms(phone, `[${businessName}] Your verification code is ${code}. It expires in 5 minutes.`);

  return {
    sent: result.success,
    expiresAt,
    // Surface the code outside production so local/demo/tests can complete the flow without a live SMS.
    devCode: process.env.NODE_ENV === "production" ? undefined : code
  };
}

/** Verifies a submitted code against the latest unconsumed challenge. */
export function verifyOtp(input: { campaignSlug: string; phone: string; code: string }): { verified: boolean } {
  const db = getDb();
  const campaign = activeCampaign(db, input.campaignSlug);
  const phone = requireValidPhone(input.phone);
  return db.transaction(() => {
    const row = db
      .prepare(
        `SELECT * FROM otp_challenges
         WHERE campaign_id = ? AND phone = ? AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(campaign.id, phone) as { id: string; code_hash: string; expires_at: string } | undefined;
    if (!row) throw new AppError("E-OTP-404", "No verification code was requested for this number", 404);
    if (new Date(row.expires_at).getTime() < Date.now()) throw new AppError("E-OTP-EXPIRED", "Verification code has expired", 409);
    if (row.code_hash !== hashCode(campaign.id, phone, input.code)) {
      throw new AppError("E-OTP-MISMATCH", "Incorrect verification code", 400);
    }
    db.prepare("UPDATE otp_challenges SET verified = 1 WHERE id = ?").run(row.id);
    return { verified: true };
  })();
}

/**
 * Enforces OTP verification during final voucher issuance. No-op when the
 * campaign does not require OTP. Consumes the verified challenge so a single
 * verification cannot be replayed for a second voucher. Runs inside the
 * caller's transaction (shares its db handle).
 */
export function assertOtpVerified(db: BetterSqlite3.Database, campaign: Campaign, phone: string) {
  if (!campaign.requireOtp) return;
  const row = db
    .prepare(
      `SELECT * FROM otp_challenges
       WHERE campaign_id = ? AND phone = ? AND verified = 1 AND consumed_at IS NULL AND expires_at >= ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(campaign.id, phone, isoNow()) as { id: string } | undefined;
  if (!row) {
    throw new AppError("E-OTP-REQUIRED", "Phone verification is required before issuing this voucher", 403);
  }
  db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").run(isoNow(), row.id);
}
