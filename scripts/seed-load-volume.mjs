#!/usr/bin/env node
/**
 * Fills a *throwaway* database with enough history to make the dashboard's
 * rollups mean something.
 *
 * The demo seed has a handful of rows, so every dashboard page renders in
 * roughly constant time no matter how the queries are written. That makes a load
 * test measure Next's render cost and nothing else. The interesting question is
 * how the pages behave against a campaign with real history behind it, which is
 * what this produces.
 *
 *   node scripts/seed-load-volume.mjs --customers 20000 --db ./data/loadtest.db
 *
 * Refuses to touch data/bizflow.db (the default dev database) — pass --db
 * explicitly. Writes are batched and sequential because libSQL file mode grants
 * one write transaction at a time.
 */

import { createClient } from "@libsql/client";

function parseArgs(argv) {
  const args = { customers: 20_000, db: "", campaign: "camp_july_dinner", batch: 500 };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--customers") args.customers = Number(argv[++i]);
    else if (flag === "--db") args.db = argv[++i];
    else if (flag === "--campaign") args.campaign = argv[++i];
    else if (flag === "--batch") args.batch = Number(argv[++i]);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!args.db) throw new Error("--db is required (path to a throwaway database file)");
  if (/bizflow\.db$/.test(args.db.replace(/\\/g, "/"))) {
    throw new Error("Refusing to seed bulk volume into the default dev database.");
  }
  return args;
}

const iso = (offsetMs) => new Date(Date.now() - offsetMs).toISOString();

async function main() {
  const args = parseArgs(process.argv);
  const url = `file:${args.db.replace(/\\/g, "/")}`;
  const client = createClient({ url, intMode: "number" });

  const campaign = await client.execute({
    sql: "SELECT id FROM campaigns WHERE id = ? OR slug = ?",
    args: [args.campaign, args.campaign],
  });
  if (campaign.rows.length === 0) {
    throw new Error(`No campaign ${args.campaign} in ${args.db}. Start the app once so it seeds.`);
  }
  const campaignId = campaign.rows[0].id;

  const slots = await client.execute({
    sql: "SELECT id FROM slots WHERE campaign_id = ?",
    args: [campaignId],
  });
  const pools = await client.execute({
    sql: "SELECT id, display_label, benefit_type, benefit_value FROM pools WHERE campaign_id = ?",
    args: [campaignId],
  });
  if (slots.rows.length === 0 || pools.rows.length === 0) {
    throw new Error("Campaign has no slots or pools to attach history to.");
  }

  console.log(`seeding ${args.customers} customers into ${args.db} (campaign ${campaignId})`);
  const started = Date.now();
  let statements = [];

  const flush = async () => {
    if (statements.length === 0) return;
    await client.batch(statements, "write");
    statements = [];
  };

  for (let i = 0; i < args.customers; i += 1) {
    const suffix = String(10_000_000 + i).slice(-7);
    const phone = `+63917${suffix}`;
    const userId = `lu_${i}`;
    const createdAt = iso(i * 60_000);
    const slot = slots.rows[i % slots.rows.length].id;
    const pool = pools.rows[i % pools.rows.length];

    statements.push({
      sql: "INSERT OR IGNORE INTO users (id, campaign_id, name, phone, email, session_id, created_at) VALUES (?,?,?,?,?,?,?)",
      args: [userId, campaignId, `Load Customer ${i}`, phone, `load${i}@example.invalid`, `sess_${i}`, createdAt],
    });

    // A wallet for most customers, so the customers list actually exercises its
    // LEFT JOIN rather than matching nothing.
    if (i % 4 !== 0) {
      statements.push({
        sql: "INSERT OR IGNORE INTO reward_wallets (id, phone, name, email, wallet_token, wallet_secret, balance_centavos, lifetime_earned_centavos, lifetime_converted_centavos, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [`lw_${i}`, phone, `Load Customer ${i}`, null, `tok_${i}`, `sec_${i}`, (i % 900) * 100, (i % 1500) * 100, 0, "Active", createdAt, createdAt],
      });
    }

    // Three spins each: the attempts table is the largest in a live campaign.
    for (let a = 0; a < 3; a += 1) {
      statements.push({
        sql: "INSERT OR IGNORE INTO attempts (id, campaign_id, slot_id, user_id, attempt_number, source_type, benefit_type, benefit_value, display_label, pool_id, status, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [
          `la_${i}_${a}`, campaignId, a === 0 ? slot : null, userId, a + 1, "base",
          pool.benefit_type, pool.benefit_value, pool.display_label, pool.id,
          a === 0 ? "Selected" : "Expired", createdAt, createdAt,
        ],
      });
    }

    // Two thirds convert to a booked voucher, a third of those get redeemed.
    if (i % 3 !== 0) {
      statements.push({
        sql: "INSERT OR IGNORE INTO vouchers (id, campaign_id, slot_id, user_id, selected_attempt_id, voucher_code, qr_token, benefit_type, benefit_value, display_label, status, issued_at, expires_at, redeemed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [
          `lv_${i}`, campaignId, slot, userId, `la_${i}_0`, `LOAD-${suffix}`, `qr_load_${i}`,
          pool.benefit_type, pool.benefit_value, pool.display_label,
          i % 9 === 0 ? "Redeemed" : "Issued", createdAt, iso(-7 * 86_400_000),
          i % 9 === 0 ? createdAt : null,
        ],
      });
    }

    statements.push({
      sql: "INSERT OR IGNORE INTO analytics_events (id, campaign_id, event_name, user_id, slot_id, metadata, created_at) VALUES (?,?,?,?,?,?,?)",
      args: [`le_${i}`, campaignId, "hunt_started", userId, null, null, createdAt],
    });

    if (statements.length >= args.batch) {
      await flush();
      if (i % 5_000 === 0 && i > 0) console.log(`  ${i} customers…`);
    }
  }
  await flush();

  const counts = await client.batch(
    ["users", "attempts", "vouchers", "analytics_events", "reward_wallets"].map((table) => ({
      sql: `SELECT '${table}' AS t, COUNT(*) AS c FROM ${table}`,
    })),
    "read",
  );
  console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  for (const result of counts) {
    console.log(`  ${String(result.rows[0].t).padEnd(18)} ${result.rows[0].c}`);
  }
}

main().catch((error) => {
  console.error(`\nseed failed: ${error.message}\n`);
  process.exit(1);
});
