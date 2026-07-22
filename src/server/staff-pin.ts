import crypto from "node:crypto";

const PREFIX = "scrypt";
const KEY_LENGTH = 32;

/** Store business PINs as salted one-way credentials, never as recoverable text. */
export function hashStaffPin(pin: string) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(pin, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export function isHashedStaffPin(value: string) {
  return value.startsWith(`${PREFIX}$`);
}
