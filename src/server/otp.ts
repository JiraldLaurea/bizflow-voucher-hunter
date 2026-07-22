import crypto from "node:crypto";
import { all, getDb, run } from "@/server/db";
import { AppError } from "@/server/errors";
import { normalizePhone } from "@/server/phone";
import { sendSms, type SmsResult } from "@/server/sms";

const OTP_TTL_MS = 5 * 60_000;
const isoNow = () => new Date().toISOString();
const otpId = () => `otp_${crypto.randomBytes(6).toString("hex")}`;

// Sign-in OTP is campaign-agnostic — it proves phone ownership for the account
// itself, not for one campaign. The challenge table's campaign_id is plain
// NOT NULL text with no FK, so a sentinel scope is safe.
const SIGNIN_SCOPE = "__signin__";

function hashCode(scope: string, phone: string, code: string) {
  const salt = process.env.OTP_SALT ?? process.env.ADMIN_ACCESS_TOKEN ?? "bizflow-otp";
  return crypto.createHash("sha256").update(`${salt}:${scope}:${phone}:${code}`).digest("hex");
}

function requireValidPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new AppError("E-USER-PHONE", "A valid Philippine mobile number is required", 400);
  return normalized;
}

/** Generates a 6-digit sign-in code, stores its hash, and sends it via SMS. */
export async function requestSignInOtp(input: {
  phone: string;
}): Promise<{ sent: boolean; expiresAt: string; devCode?: string }> {
  const db = await getDb();
  const phone = requireValidPhone(input.phone);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  await run(
    db,
    `INSERT INTO otp_challenges (id, campaign_id, phone, code_hash, expires_at, verified, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [otpId(), SIGNIN_SCOPE, phone, hashCode(SIGNIN_SCOPE, phone, code), expiresAt, isoNow()]
  );
  const result: SmsResult = await sendSms(
    phone,
    `[BizFlow] Your sign-in code is ${code}. It expires in 5 minutes.`
  );
  return {
    sent: result.success,
    expiresAt,
    // Surface the code outside production so local/demo/tests can complete the
    // flow without a live SMS.
    devCode: process.env.NODE_ENV === "production" ? undefined : code
  };
}

/**
 * Verifies a sign-in code and returns the now-proven phone. The challenge is
 * consumed so a code cannot be replayed.
 */
export async function verifySignInOtp(input: {
  phone: string;
  code: string;
}): Promise<{ phone: string }> {
  const db = await getDb();
  const phone = requireValidPhone(input.phone);
  const rows = await all(
    db,
    `SELECT * FROM otp_challenges
     WHERE campaign_id = ? AND phone = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [SIGNIN_SCOPE, phone]
  );
  const row = rows[0] as { id: string; code_hash: string; expires_at: string } | undefined;
  if (!row) throw new AppError("E-OTP-404", "No verification code was requested for this number", 404);
  if (new Date(row.expires_at).getTime() < Date.now()) throw new AppError("E-OTP-EXPIRED", "Verification code has expired", 409);
  if (row.code_hash !== hashCode(SIGNIN_SCOPE, phone, input.code)) {
    throw new AppError("E-OTP-MISMATCH", "Incorrect verification code", 400);
  }
  await run(db, "UPDATE otp_challenges SET verified = 1, consumed_at = ? WHERE id = ?", [isoNow(), row.id]);
  return { phone };
}
