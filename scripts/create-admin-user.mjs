// Creates (or resets the password of) a dashboard console account.
//
// This is the same thing /dashboard/team does, minus the need to already be
// signed in as a super admin — which is the point: it is how you get a working
// login on a deploy whose bootstrap ADMIN_PASSWORD nobody remembers.
//
// Usage:
//   node scripts/create-admin-user.mjs <email> <password> [--name "..."] \
//        [--role super_admin|admin|staff] [--businesses biz_a,biz_b]
//
// Local (default DB ./data/bizflow.db):
//   node scripts/create-admin-user.mjs admin@email.com 1234567890
//
// Production (Turso) — pass the credentials in, they are never read from a file:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... \
//     node scripts/create-admin-user.mjs admin@email.com 1234567890
//
// Re-running with an existing email resets that account's password and
// reactivates it; it never creates a duplicate.

import crypto from "node:crypto";
import { createClient } from "@libsql/client";

// Kept in step with MIN_PASSWORD_LENGTH and hashPassword in
// src/server/admin-users.ts — a hash written in any other format fails login.
const MIN_PASSWORD_LENGTH = 10;
const ROLES = ["super_admin", "admin", "staff"];

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const p = process.env.DATABASE_PATH ?? "./data/bizflow.db";
  return `file:${p.replace(/\\/g, "/")}`;
}

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((value, i) => !value.startsWith("--") && !args[i - 1]?.startsWith("--"));

const [email, password] = positional;
if (!email || !password) die("usage: node scripts/create-admin-user.mjs <email> <password> [--name ...] [--role ...] [--businesses ...]");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die(`"${email}" is not a valid email address`);
if (password.length < MIN_PASSWORD_LENGTH) {
  die(`password must be at least ${MIN_PASSWORD_LENGTH} characters (the console enforces the same minimum)`);
}

const role = flag("role") ?? "admin";
if (!ROLES.includes(role)) die(`--role must be one of ${ROLES.join(", ")}`);

// Staff must resolve to exactly one business or verifyAdminSession refuses the
// session at login; admins default to every business.
const businesses = (flag("businesses") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (role === "staff" && (businesses.length !== 1 || businesses[0] === "*")) {
  die("a staff account needs exactly one business: --businesses biz_demo_restaurant");
}
const businessIds = role === "staff" ? businesses : businesses.length ? businesses.join(",") : "*";

const name = flag("name") ?? "Demo Admin";
const normalisedEmail = email.trim().toLowerCase();

const client = createClient({
  url: resolveUrl(),
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const existing = await client.execute({
  sql: "SELECT id FROM admin_users WHERE email = ?",
  args: [normalisedEmail],
});

if (existing.rows.length > 0) {
  await client.execute({
    sql: `UPDATE admin_users
          SET name = ?, role = ?, password_hash = ?, business_ids = ?, status = 'active'
          WHERE email = ?`,
    args: [name, role, hashPassword(password), String(businessIds), normalisedEmail],
  });
  console.log(`updated ${normalisedEmail} (${role}, businesses: ${businessIds}) — password reset, account active`);
} else {
  await client.execute({
    sql: `INSERT INTO admin_users (id, email, name, role, password_hash, business_ids, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
    args: [
      `au_${crypto.randomBytes(6).toString("hex")}`,
      normalisedEmail,
      name,
      role,
      hashPassword(password),
      String(businessIds),
      new Date().toISOString(),
    ],
  });
  console.log(`created ${normalisedEmail} (${role}, businesses: ${businessIds})`);
}

client.close();
