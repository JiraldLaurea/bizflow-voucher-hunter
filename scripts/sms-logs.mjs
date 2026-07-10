// Prints the most recent sms_logs rows (submit status + SMPP delivery receipt).
//
// Usage:
//   npm run sms:logs           # last 10 rows
//   npm run sms:logs -- 25     # last 25 rows
//
// The DB target is read from the same env vars the app uses (loaded via
// `node --env-file=.env` in the npm script): DATABASE_URL for Turso/libSQL, or
// DATABASE_PATH for the local SQLite file (default ./data/bizflow.db).

import { createClient } from "@libsql/client";

function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const p = process.env.DATABASE_PATH ?? "./data/bizflow.db";
  return `file:${p.replace(/\\/g, "/")}`;
}

const limit = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 10;

const client = createClient({
  url: resolveUrl(),
  authToken: process.env.DATABASE_AUTH_TOKEN
});

const result = await client.execute({
  sql: `SELECT created_at, to_number, provider, status, provider_message_id,
               delivery_status, delivered_at, failure_reason
        FROM sms_logs
        ORDER BY created_at DESC
        LIMIT ?`,
  args: [limit]
});

if (result.rows.length === 0) {
  console.log("No sms_logs rows yet. Complete a voucher confirmation to generate one.");
} else {
  console.table(
    result.rows.map((r) => ({
      created_at: r.created_at,
      to: r.to_number,
      provider: r.provider,
      status: r.status,
      message_id: r.provider_message_id ?? "",
      delivery: r.delivery_status ?? "",
      delivered_at: r.delivered_at ?? "",
      failure: r.failure_reason ?? ""
    }))
  );
}

client.close();
