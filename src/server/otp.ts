import crypto from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { all, getDb, mapBusiness, mapCampaign, one, run } from "@/server/db";
import { AppError } from "@/server/errors";
import { normalizePhone } from "@/server/phone";
import { sendSms, type SmsResult } from "@/server/sms";
import type { Campaign } from "@/types/voucher";

type Exec = Client | Transaction;

const OTP_TTL_MS = 5 * 60_000;
const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const isoNow = () => new Date().toISOString();
const otpId = () => `otp_${crypto.randomBytes(6).toString("hex")}`;
const customerSessionId = () => `cs_${crypto.randomBytes(8).toString("hex")}`;
const customerSessionToken = () => `cust_${crypto.randomBytes(24).toString("base64url")}`;

function hashCode(campaignId: string, phone: string, code: string) {
  const salt = process.env.OTP_SALT ?? process.env.ADMIN_ACCESS_TOKEN ?? "bizflow-otp";
  return crypto.createHash("sha256").update(`${salt}:${campaignId}:${phone}:${code}`).digest("hex");
}

async function activeCampaign(db: Exec, slugOrId: string): Promise<Campaign> {
  const row = await one(db, "SELECT * FROM campaigns WHERE (id = ? OR slug = ?) AND status = 'active'", [slugOrId, slugOrId]);
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
  const db = await getDb();
  const campaign = await activeCampaign(db, input.campaignSlug);
  const phone = requireValidPhone(input.phone);
  const businessRow = await one(db, "SELECT * FROM businesses WHERE id = ?", [campaign.businessId]);
  const businessName = businessRow ? mapBusiness(businessRow).name : "BizFlow";

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  await run(
    db,
    `INSERT INTO otp_challenges (id, campaign_id, phone, code_hash, expires_at, verified, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [otpId(), campaign.id, phone, hashCode(campaign.id, phone, code), expiresAt, isoNow()]
  );

  const result: SmsResult = await sendSms(phone, `[${businessName}] Your verification code is ${code}. It expires in 5 minutes.`);

  return {
    sent: result.success,
    expiresAt,
    // Surface the code outside production so local/demo/tests can complete the flow without a live SMS.
    devCode: process.env.NODE_ENV === "production" ? undefined : code
  };
}

/** Verifies a submitted code and mints a customer session for protected public actions. */
export async function verifyOtp(input: {
  campaignSlug: string;
  phone: string;
  code: string;
}): Promise<{ verified: boolean; customerSessionToken: string; expiresAt: string }> {
  const db = await getDb();
  const campaign = await activeCampaign(db, input.campaignSlug);
  const phone = requireValidPhone(input.phone);
  const rows = await all(
    db,
    `SELECT * FROM otp_challenges
     WHERE campaign_id = ? AND phone = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [campaign.id, phone]
  );
  const row = rows[0] as { id: string; code_hash: string; expires_at: string } | undefined;
  if (!row) throw new AppError("E-OTP-404", "No verification code was requested for this number", 404);
  if (new Date(row.expires_at).getTime() < Date.now()) throw new AppError("E-OTP-EXPIRED", "Verification code has expired", 409);
  if (row.code_hash !== hashCode(campaign.id, phone, input.code)) {
    throw new AppError("E-OTP-MISMATCH", "Incorrect verification code", 400);
  }
  const sessionToken = customerSessionToken();
  const sessionExpiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS).toISOString();
  await run(db, "UPDATE otp_challenges SET verified = 1 WHERE id = ?", [row.id]);
  await run(
    db,
    `INSERT INTO customer_sessions (id, campaign_id, phone, session_token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [customerSessionId(), campaign.id, phone, sessionToken, sessionExpiresAt, isoNow()]
  );
  return { verified: true, customerSessionToken: sessionToken, expiresAt: sessionExpiresAt };
}

export async function assertCustomerSession(input: {
  campaignSlug: string;
  phone: string;
  customerSessionToken: string;
}) {
  const db = await getDb();
  const campaign = await activeCampaign(db, input.campaignSlug);
  const phone = requireValidPhone(input.phone);
  const row = await one(
    db,
    `SELECT id FROM customer_sessions
     WHERE campaign_id = ? AND phone = ? AND session_token = ? AND expires_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [campaign.id, phone, input.customerSessionToken, isoNow()]
  );
  if (!row) {
    throw new AppError("E-CUSTOMER-SESSION", "Phone verification is required before accessing this wallet", 401);
  }
  return { campaign, phone };
}

/**
 * Enforces OTP verification during final voucher issuance. No-op when the
 * campaign does not require OTP. Consumes the verified challenge so a single
 * verification cannot be replayed for a second voucher. Runs inside the
 * caller's transaction (shares its db handle).
 */
export async function assertOtpVerified(db: Exec, campaign: Campaign, phone: string) {
  if (!campaign.requireOtp) return;
  const row = await one(
    db,
    `SELECT * FROM otp_challenges
     WHERE campaign_id = ? AND phone = ? AND verified = 1 AND consumed_at IS NULL AND expires_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [campaign.id, phone, isoNow()]
  );
  if (!row) {
    throw new AppError("E-OTP-REQUIRED", "Phone verification is required before issuing this voucher", 403);
  }
  await run(db, "UPDATE otp_challenges SET consumed_at = ? WHERE id = ?", [isoNow(), row.id]);
}
