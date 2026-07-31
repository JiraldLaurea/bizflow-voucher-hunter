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

/**
 * Google Play review account.
 *
 * Play reviewers have no Philippine handset, so the SMS code never reaches them,
 * and `devCode` is suppressed in production by design. Play's App access form
 * demands "reusable login details that do not expire", so exactly one number is
 * allowed to sign in with a fixed code instead.
 *
 * Configured entirely by env and inert unless BOTH vars are set:
 *   REVIEW_ACCOUNT_PHONE – the number given to Play, any accepted PH format
 *   REVIEW_ACCOUNT_OTP   – the 6-digit code given to Play
 *
 * Scope is deliberately narrow: this is an ordinary customer account with no
 * elevated rights, and the bypass applies only to the one number. Unset both
 * vars once review passes — see docs/PLAY_CONSOLE_ANSWERS.md §2.
 */
function reviewAccount(): { phone: string; code: string } | null {
  const configuredPhone = process.env.REVIEW_ACCOUNT_PHONE?.trim();
  const code = process.env.REVIEW_ACCOUNT_OTP?.trim();
  if (!configuredPhone || !code || !/^\d{6}$/.test(code)) return null;
  const phone = normalizePhone(configuredPhone);
  return phone ? { phone, code } : null;
}

/** Constant-time compare, so a wrong guess leaks nothing about the real code. */
function codeMatches(expected: string, provided: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Generates a 6-digit sign-in code, stores its hash, and sends it via SMS. */
export async function requestSignInOtp(input: {
  phone: string;
}): Promise<{ sent: boolean; expiresAt: string; devCode?: string }> {
  const db = await getDb();
  const phone = requireValidPhone(input.phone);

  // No challenge row and no SMS for the review account: the number is not a real
  // handset, so sending would only burn provider credit and log a failure. The
  // client advances to the code screen on a successful response, which is what
  // the reviewer needs.
  if (reviewAccount()?.phone === phone) {
    return { sent: true, expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString() };
  }

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
  // Surface the code outside production so local/demo/tests can complete the
  // flow without a live SMS — but only when nothing was actually sent. With the
  // "Live SMS" switch on, a real text goes out and echoing the code back would
  // hand it to any caller, defeating the point of testing the real path.
  const usedMockProvider = result.provider === "mock";
  return {
    sent: result.success,
    expiresAt,
    devCode:
      process.env.NODE_ENV === "production" || !usedMockProvider ? undefined : code
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

  // The review account's fixed code is accepted without a stored challenge, and
  // is never consumed — Play re-reviews on every update, so it must not expire.
  const review = reviewAccount();
  if (review && review.phone === phone) {
    if (!codeMatches(review.code, input.code)) {
      throw new AppError("E-OTP-MISMATCH", "Incorrect verification code", 400);
    }
    return { phone };
  }

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
