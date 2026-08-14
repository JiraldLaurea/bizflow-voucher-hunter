import crypto from "node:crypto";

/**
 * Alphabet for codes a human reads aloud at a checkout: no O/0 and no I/1, so a
 * misheard character cannot resolve to a different valid code.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * A customer-facing voucher code: prefix plus `length` characters of CSPRNG
 * output — 80 bits at the default of 16.
 *
 * Both campaign (`BIZ-`) and Loyalty Points (`RWD-`) codes were previously
 * `crypto.randomBytes(3)`: six hex characters, 24 bits, a space of 16.7 million.
 * Every endpoint that resolves a code — staff validate, staff redeem, the public
 * resend — is a test oracle for that space, and with a few thousand live
 * vouchers roughly one guess in seventeen hundred lands on a real one. At 80
 * bits the space itself is the defence and the rate limits are only a backstop.
 *
 * Codes are compared case-insensitively (`UPPER(voucher_code) = ?`), so the
 * alphabet is uppercase-only and carries no case entropy that a lookup discards.
 */
export function generateVoucherCode(prefix: string, length = 16) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}

/** An opaque QR token. 192 bits — never typed, so length costs nothing. */
export function generateQrToken() {
  return crypto.randomBytes(24).toString("hex");
}
