import { createClient, type Client, type InArgs, type InStatement, type Transaction } from "@libsql/client";
import type {
  AnalyticsEvent,
  Business,
  Campaign,
  CampaignSlot,
  EndUser,
  RedemptionLog,
  ReferralReward,
  Reservation,
  SmsLog,
  Voucher,
  VoucherAttempt,
  VoucherPool
} from "@/types/voucher";

// libSQL returns rows keyed by column name; mappers narrow them to domain types.
type Row = any;
type Exec = Client | Transaction;

/**
 * Connection target. Turso/libSQL in production via DATABASE_URL (libsql://...)
 * plus DATABASE_AUTH_TOKEN; a local file (file:./data/...) for dev and tests.
 */
function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const p = process.env.DATABASE_PATH ?? "./data/bizflow.db";
  return `file:${p.replace(/\\/g, "/")}`;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_text TEXT NOT NULL,
  industry TEXT NOT NULL,
  staff_pin TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  offer_message TEXT NOT NULL,
  hero_image TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  base_attempts INTEGER NOT NULL,
  referral_daily_limit INTEGER NOT NULL,
  candidate_timeout_minutes INTEGER NOT NULL,
  terms TEXT NOT NULL,
  shop_url TEXT,
  require_otp INTEGER NOT NULL DEFAULT 0,
  allow_reschedule INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  branch_id TEXT,
  total_capacity INTEGER NOT NULL,
  remaining_capacity INTEGER NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  benefit_type TEXT NOT NULL,
  benefit_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  total_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  probability_weight INTEGER NOT NULL,
  expiry_type TEXT NOT NULL,
  expiry_value INTEGER NOT NULL,
  minimum_spend INTEGER,
  status TEXT NOT NULL,
  restriction TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (campaign_id, phone)
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  attempt_number INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  benefit_type TEXT NOT NULL,
  benefit_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  selected_attempt_id TEXT NOT NULL,
  voucher_code TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  benefit_type TEXT NOT NULL,
  benefit_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  status TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  UNIQUE (campaign_id, user_id)
);
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  voucher_id TEXT NOT NULL,
  guest_count INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  voucher_id TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  created_at TEXT NOT NULL,
  failure_reason TEXT
);
CREATE TABLE IF NOT EXISTS redemption_logs (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  purchase_amount INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  user_id TEXT,
  slot_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  referrer_user_id TEXT NOT NULL REFERENCES users(id),
  visitor_session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (campaign_id, referrer_user_id, visitor_session_id)
);
CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_campaign_phone ON otp_challenges (campaign_id, phone);
CREATE TABLE IF NOT EXISTS rate_events (
  id TEXT PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_bucket ON rate_events (bucket_key, created_at);
`;

let client: Client | null = null;
let readyPromise: Promise<void> | null = null;

function rawClient(): Client {
  if (!client) {
    client = createClient({ url: resolveUrl(), authToken: process.env.DATABASE_AUTH_TOKEN, intMode: "number" });
  }
  return client;
}

/** Creates the schema (and seeds a fresh/partial database) exactly once per process. */
function ensureReady(): Promise<void> {
  if (!readyPromise) {
    // Do not cache a rejected init: a transient failure would otherwise poison
    // every later request in this serverless instance until it cold-starts again.
    readyPromise = init().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function init() {
  const c = rawClient();
  await c.executeMultiple(SCHEMA);
  // Self-heal: seed when the database is empty OR partially seeded (e.g. a
  // previous interactive-transaction seed committed campaigns but not slots).
  // The seed is idempotent (INSERT OR IGNORE), so re-running it is safe.
  const rs = await c.execute("SELECT (SELECT COUNT(*) FROM campaigns) AS c, (SELECT COUNT(*) FROM slots) AS s");
  const row = rs.rows[0] as Row;
  if (Number(row.c) === 0 || Number(row.s) === 0) await seed(c);
}

/** Returns the ready libSQL client (schema created + seeded on first use). */
export async function getDb(): Promise<Client> {
  await ensureReady();
  return rawClient();
}

/** Runs a callback inside a write transaction, committing on success and rolling back on error. */
export async function withTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  await ensureReady();
  const tx = await rawClient().transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Ignore rollback failure; the original error is the useful one.
    }
    throw error;
  }
}

/** Query helpers usable with either the pooled client or an open transaction. */
export async function all(db: Exec, sql: string, args?: InArgs): Promise<Row[]> {
  const rs = await db.execute(args === undefined ? sql : { sql, args });
  return rs.rows as Row[];
}

export async function one(db: Exec, sql: string, args?: InArgs): Promise<Row | undefined> {
  const rs = await db.execute(args === undefined ? sql : { sql, args });
  return rs.rows[0];
}

/** Runs a write statement and returns the number of affected rows. */
export async function run(db: Exec, sql: string, args?: InArgs): Promise<number> {
  const rs = await db.execute(args === undefined ? sql : { sql, args });
  return rs.rowsAffected;
}


/** Seed data. Also used to (re)populate the database for local dev and tests. */
export const seedData: {
  businesses: Business[];
  campaigns: Campaign[];
  slots: CampaignSlot[];
  pools: VoucherPool[];
} = {
  businesses: [
    { id: "biz_demo_restaurant", name: "Mesa Manila Test Kitchen", logoText: "MM", industry: "restaurant", staffPin: "2468" },
    { id: "biz_demo_shop", name: "SariSari Studio", logoText: "SS", industry: "online_shop", staffPin: "1357" }
  ],
  campaigns: [
    {
      id: "camp_july_dinner",
      businessId: "biz_demo_restaurant",
      slug: "july-dinner",
      title: "July Dinner Voucher Hunt",
      offerMessage: "Pick your visit window first, then hunt for one final dining voucher.",
      heroImage:
        "linear-gradient(135deg, rgba(21,72,87,.9), rgba(229,90,54,.76)), url('https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80')",
      mode: "restaurant",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      baseAttempts: 3,
      referralDailyLimit: 5,
      candidateTimeoutMinutes: 10,
      terms: "Valid for selected slot only. Minimum spend applies. One final voucher per phone number.",
      requireOtp: false,
      allowReschedule: true
    },
    {
      id: "camp_8pm_drop",
      businessId: "biz_demo_shop",
      slug: "8pm-drop",
      title: "8PM Shopping Voucher Drop",
      offerMessage: "Choose the drop window, reveal candidates, and keep one checkout code.",
      heroImage:
        "linear-gradient(135deg, rgba(29,44,74,.9), rgba(38,142,125,.72)), url('https://images.unsplash.com/photo-1607082350899-7e105aa886ae?auto=format&fit=crop&w=1600&q=80')",
      mode: "online_shop",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      baseAttempts: 3,
      referralDailyLimit: 5,
      candidateTimeoutMinutes: 10,
      terms: "Valid within the selected drop window or stated expiry. One code per phone number.",
      shopUrl: "https://example.com/shop",
      requireOtp: false,
      allowReschedule: false
    }
  ],
  slots: [
    { id: "slot_dinner_0705_1900", campaignId: "camp_july_dinner", date: "2026-07-05", startTime: "19:00", endTime: "20:30", timezone: "Asia/Manila", totalCapacity: 20, remainingCapacity: 20, status: "active" },
    { id: "slot_dinner_0705_2000", campaignId: "camp_july_dinner", date: "2026-07-05", startTime: "20:00", endTime: "21:30", timezone: "Asia/Manila", totalCapacity: 8, remainingCapacity: 2, status: "active" },
    { id: "slot_dinner_0706_1900", campaignId: "camp_july_dinner", date: "2026-07-06", startTime: "19:00", endTime: "20:30", timezone: "Asia/Manila", totalCapacity: 12, remainingCapacity: 0, status: "sold_out" },
    { id: "slot_dinner_0707_1900", campaignId: "camp_july_dinner", date: "2026-07-07", startTime: "19:00", endTime: "20:30", timezone: "Asia/Manila", totalCapacity: 18, remainingCapacity: 18, status: "active" },
    { id: "slot_dinner_0707_2000", campaignId: "camp_july_dinner", date: "2026-07-07", startTime: "20:00", endTime: "21:30", timezone: "Asia/Manila", totalCapacity: 15, remainingCapacity: 15, status: "active" },
    { id: "slot_dinner_0708_1900", campaignId: "camp_july_dinner", date: "2026-07-08", startTime: "19:00", endTime: "20:30", timezone: "Asia/Manila", totalCapacity: 5, remainingCapacity: 5, status: "active" },
    { id: "slot_dinner_0708_2000", campaignId: "camp_july_dinner", date: "2026-07-08", startTime: "20:00", endTime: "21:30", timezone: "Asia/Manila", totalCapacity: 10, remainingCapacity: 10, status: "active" },
    { id: "slot_dinner_0709_1900", campaignId: "camp_july_dinner", date: "2026-07-09", startTime: "19:00", endTime: "20:30", timezone: "Asia/Manila", totalCapacity: 27, remainingCapacity: 27, status: "active" },
    { id: "slot_dinner_0709_2000", campaignId: "camp_july_dinner", date: "2026-07-09", startTime: "20:00", endTime: "21:30", timezone: "Asia/Manila", totalCapacity: 12, remainingCapacity: 12, status: "active" },
    { id: "slot_shop_0705_2000", campaignId: "camp_8pm_drop", date: "2026-07-05", startTime: "20:00", endTime: "22:00", timezone: "Asia/Manila", totalCapacity: 100, remainingCapacity: 100, status: "active" },
    { id: "slot_shop_0706_2200", campaignId: "camp_8pm_drop", date: "2026-07-06", startTime: "22:00", endTime: "23:59", timezone: "Asia/Manila", totalCapacity: 75, remainingCapacity: 75, status: "active" }
  ],
  pools: [
    // slot_dinner_0705_1900 (capacity 20) - 5 distinct benefit tiers so referral-bonus
    // attempts have real headroom beyond the 3 base attempts before pools force a repeat.
    { id: "pool_dinner_0705_1900_90", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0705_1900_50", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0705_1900_30", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 3, remainingQuantity: 3, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0705_1900_20", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 9, remainingQuantity: 9, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0705_1900_dessert", slotId: "slot_dinner_0705_1900", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0705_2000 (capacity 8)
    { id: "pool_dinner_0705_2000_90", slotId: "slot_dinner_0705_2000", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0705_2000_50", slotId: "slot_dinner_0705_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0705_2000_30", slotId: "slot_dinner_0705_2000", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0705_2000_20", slotId: "slot_dinner_0705_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0705_2000_dessert", slotId: "slot_dinner_0705_2000", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 3, remainingQuantity: 3, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0707_1900 (capacity 18)
    { id: "pool_dinner_0707_1900_90", slotId: "slot_dinner_0707_1900", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0707_1900_50", slotId: "slot_dinner_0707_1900", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0707_1900_30", slotId: "slot_dinner_0707_1900", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 3, remainingQuantity: 3, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0707_1900_20", slotId: "slot_dinner_0707_1900", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 8, remainingQuantity: 8, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0707_1900_dessert", slotId: "slot_dinner_0707_1900", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 4, remainingQuantity: 4, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0707_2000 (capacity 15)
    { id: "pool_dinner_0707_2000_90", slotId: "slot_dinner_0707_2000", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0707_2000_50", slotId: "slot_dinner_0707_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0707_2000_30", slotId: "slot_dinner_0707_2000", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0707_2000_20", slotId: "slot_dinner_0707_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 6, remainingQuantity: 6, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0707_2000_dessert", slotId: "slot_dinner_0707_2000", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0708_1900 (capacity 5) - small slot, one unit per tier
    { id: "pool_dinner_0708_1900_90", slotId: "slot_dinner_0708_1900", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0708_1900_50", slotId: "slot_dinner_0708_1900", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0708_1900_30", slotId: "slot_dinner_0708_1900", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0708_1900_20", slotId: "slot_dinner_0708_1900", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0708_1900_dessert", slotId: "slot_dinner_0708_1900", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0708_2000 (capacity 10)
    { id: "pool_dinner_0708_2000_90", slotId: "slot_dinner_0708_2000", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0708_2000_50", slotId: "slot_dinner_0708_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0708_2000_30", slotId: "slot_dinner_0708_2000", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0708_2000_20", slotId: "slot_dinner_0708_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 4, remainingQuantity: 4, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0708_2000_dessert", slotId: "slot_dinner_0708_2000", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0709_1900 (capacity 27)
    { id: "pool_dinner_0709_1900_90", slotId: "slot_dinner_0709_1900", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0709_1900_50", slotId: "slot_dinner_0709_1900", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 3, remainingQuantity: 3, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0709_1900_30", slotId: "slot_dinner_0709_1900", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0709_1900_20", slotId: "slot_dinner_0709_1900", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 13, remainingQuantity: 13, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0709_1900_dessert", slotId: "slot_dinner_0709_1900", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_dinner_0709_2000 (capacity 12)
    { id: "pool_dinner_0709_2000_90", slotId: "slot_dinner_0709_2000", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_0709_2000_50", slotId: "slot_dinner_0709_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_0709_2000_30", slotId: "slot_dinner_0709_2000", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0709_2000_20", slotId: "slot_dinner_0709_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 6, remainingQuantity: 6, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0709_2000_dessert", slotId: "slot_dinner_0709_2000", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // slot_shop_0705_2000 (capacity 100)
    { id: "pool_shop_0705_2000_90", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 2, minimumSpend: 2000, status: "active" },
    { id: "pool_shop_0705_2000_50", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 5, expiryType: "hours", expiryValue: 24, minimumSpend: 1500, status: "active" },
    { id: "pool_shop_0705_2000_20", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 50, remainingQuantity: 50, probabilityWeight: 50, expiryType: "days", expiryValue: 7, minimumSpend: 1000, status: "active" },
    { id: "pool_shop_0705_2000_10", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "10", displayLabel: "10% OFF", totalQuantity: 14, remainingQuantity: 14, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 500, status: "active" },
    { id: "pool_shop_0705_2000_ship", slotId: "slot_shop_0705_2000", benefitType: "free_shipping", benefitValue: "free_shipping", displayLabel: "Free Shipping", totalQuantity: 30, remainingQuantity: 30, probabilityWeight: 30, expiryType: "days", expiryValue: 7, status: "active" },

    // slot_shop_0706_2200 (capacity 75)
    { id: "pool_shop_0706_2200_90", slotId: "slot_shop_0706_2200", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 2, minimumSpend: 2000, status: "active" },
    { id: "pool_shop_0706_2200_50", slotId: "slot_shop_0706_2200", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 4, remainingQuantity: 4, probabilityWeight: 5, expiryType: "hours", expiryValue: 24, minimumSpend: 1500, status: "active" },
    { id: "pool_shop_0706_2200_20", slotId: "slot_shop_0706_2200", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 35, remainingQuantity: 35, probabilityWeight: 50, expiryType: "days", expiryValue: 7, minimumSpend: 1000, status: "active" },
    { id: "pool_shop_0706_2200_10", slotId: "slot_shop_0706_2200", benefitType: "discount_percent", benefitValue: "10", displayLabel: "10% OFF", totalQuantity: 10, remainingQuantity: 10, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 500, status: "active" },
    { id: "pool_shop_0706_2200_ship", slotId: "slot_shop_0706_2200", benefitType: "free_shipping", benefitValue: "free_shipping", displayLabel: "Free Shipping", totalQuantity: 25, remainingQuantity: 25, probabilityWeight: 30, expiryType: "days", expiryValue: 7, status: "active" }
  ]
};

const INSERT_BUSINESS =
  "INSERT OR IGNORE INTO businesses (id, name, logo_text, industry, staff_pin) VALUES (@id, @name, @logoText, @industry, @staffPin)";
const INSERT_CAMPAIGN = `INSERT OR IGNORE INTO campaigns (id, business_id, slug, title, offer_message, hero_image, mode, status, start_date, end_date, base_attempts, referral_daily_limit, candidate_timeout_minutes, terms, shop_url, require_otp, allow_reschedule)
     VALUES (@id, @businessId, @slug, @title, @offerMessage, @heroImage, @mode, @status, @startDate, @endDate, @baseAttempts, @referralDailyLimit, @candidateTimeoutMinutes, @terms, @shopUrl, @requireOtp, @allowReschedule)`;
const INSERT_SLOT = `INSERT OR IGNORE INTO slots (id, campaign_id, date, start_time, end_time, timezone, branch_id, total_capacity, remaining_capacity, status)
     VALUES (@id, @campaignId, @date, @startTime, @endTime, @timezone, @branchId, @totalCapacity, @remainingCapacity, @status)`;
const INSERT_POOL = `INSERT OR IGNORE INTO pools (id, slot_id, benefit_type, benefit_value, display_label, total_quantity, remaining_quantity, probability_weight, expiry_type, expiry_value, minimum_spend, status, restriction)
     VALUES (@id, @slotId, @benefitType, @benefitValue, @displayLabel, @totalQuantity, @remainingQuantity, @probabilityWeight, @expiryType, @expiryValue, @minimumSpend, @status, @restriction)`;

/**
 * Seeds demo data as a single atomic batch. `client.batch(..., "write")` runs
 * every statement in one implicit transaction over a single network round-trip,
 * which is far more reliable on Turso/Hrana in serverless than an interactive
 * transaction (whose stream can drop between round-trips, leaving a partial
 * seed). Idempotent via INSERT OR IGNORE, so concurrent cold starts are safe.
 */
async function seed(c: Client) {
  const statements: InStatement[] = [
    ...seedData.businesses.map((r) => ({
      sql: INSERT_BUSINESS,
      args: { id: r.id, name: r.name, logoText: r.logoText, industry: r.industry, staffPin: r.staffPin }
    })),
    ...seedData.campaigns.map((r) => ({
      sql: INSERT_CAMPAIGN,
      args: {
        id: r.id,
        businessId: r.businessId,
        slug: r.slug,
        title: r.title,
        offerMessage: r.offerMessage,
        heroImage: r.heroImage,
        mode: r.mode,
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
        baseAttempts: r.baseAttempts,
        referralDailyLimit: r.referralDailyLimit,
        candidateTimeoutMinutes: r.candidateTimeoutMinutes,
        terms: r.terms,
        shopUrl: r.shopUrl ?? null,
        requireOtp: r.requireOtp ? 1 : 0,
        allowReschedule: r.allowReschedule ? 1 : 0
      }
    })),
    ...seedData.slots.map((r) => ({
      sql: INSERT_SLOT,
      args: {
        id: r.id,
        campaignId: r.campaignId,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        timezone: r.timezone,
        branchId: r.branchId ?? null,
        totalCapacity: r.totalCapacity,
        remainingCapacity: r.remainingCapacity,
        status: r.status
      }
    })),
    ...seedData.pools.map((r) => ({
      sql: INSERT_POOL,
      args: {
        id: r.id,
        slotId: r.slotId,
        benefitType: r.benefitType,
        benefitValue: r.benefitValue,
        displayLabel: r.displayLabel,
        totalQuantity: r.totalQuantity,
        remainingQuantity: r.remainingQuantity,
        probabilityWeight: r.probabilityWeight,
        expiryType: r.expiryType,
        expiryValue: r.expiryValue,
        minimumSpend: r.minimumSpend ?? null,
        status: r.status,
        restriction: r.restriction ?? null
      }
    }))
  ];
  await c.batch(statements, "write");
}

/** Wipe every table and re-seed. Used by tests and the admin reset action. */
export async function resetDb() {
  await ensureReady();
  const c = rawClient();
  const tables = [
    "rate_events",
    "otp_challenges",
    "analytics_events",
    "referral_rewards",
    "redemption_logs",
    "sms_logs",
    "reservations",
    "vouchers",
    "attempts",
    "users",
    "pools",
    "slots",
    "campaigns",
    "businesses"
  ];
  await c.batch(
    tables.map((table) => `DELETE FROM ${table}`),
    "write"
  );
  await seed(c);
}

// ---- Row mappers: SQLite snake_case rows -> typed camelCase domain objects ----

export const mapBusiness = (r: Row): Business => ({
  id: r.id,
  name: r.name,
  logoText: r.logo_text,
  industry: r.industry,
  staffPin: r.staff_pin
});

export const mapCampaign = (r: Row): Campaign => ({
  id: r.id,
  businessId: r.business_id,
  slug: r.slug,
  title: r.title,
  offerMessage: r.offer_message,
  heroImage: r.hero_image,
  mode: r.mode,
  status: r.status,
  startDate: r.start_date,
  endDate: r.end_date,
  baseAttempts: r.base_attempts,
  referralDailyLimit: r.referral_daily_limit,
  candidateTimeoutMinutes: r.candidate_timeout_minutes,
  terms: r.terms,
  shopUrl: r.shop_url ?? undefined,
  requireOtp: Boolean(r.require_otp),
  allowReschedule: Boolean(r.allow_reschedule)
});

export const mapSlot = (r: Row): CampaignSlot => ({
  id: r.id,
  campaignId: r.campaign_id,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  timezone: r.timezone,
  branchId: r.branch_id ?? undefined,
  totalCapacity: r.total_capacity,
  remainingCapacity: r.remaining_capacity,
  status: r.status
});

export const mapPool = (r: Row): VoucherPool => ({
  id: r.id,
  slotId: r.slot_id,
  benefitType: r.benefit_type,
  benefitValue: r.benefit_value,
  displayLabel: r.display_label,
  totalQuantity: r.total_quantity,
  remainingQuantity: r.remaining_quantity,
  probabilityWeight: r.probability_weight,
  expiryType: r.expiry_type,
  expiryValue: r.expiry_value,
  minimumSpend: r.minimum_spend ?? undefined,
  status: r.status,
  restriction: r.restriction ?? undefined
});

export const mapUser = (r: Row): EndUser => ({
  id: r.id,
  campaignId: r.campaign_id,
  name: r.name ?? undefined,
  phone: r.phone,
  email: r.email ?? undefined,
  sessionId: r.session_id,
  createdAt: r.created_at
});

export const mapAttempt = (r: Row): VoucherAttempt => ({
  id: r.id,
  campaignId: r.campaign_id,
  slotId: r.slot_id,
  userId: r.user_id,
  attemptNumber: r.attempt_number,
  sourceType: r.source_type,
  benefitType: r.benefit_type,
  benefitValue: r.benefit_value,
  displayLabel: r.display_label,
  poolId: r.pool_id,
  status: r.status,
  expiresAt: r.expires_at,
  createdAt: r.created_at
});

export const mapVoucher = (r: Row): Voucher => ({
  id: r.id,
  campaignId: r.campaign_id,
  slotId: r.slot_id,
  userId: r.user_id,
  selectedAttemptId: r.selected_attempt_id,
  voucherCode: r.voucher_code,
  qrToken: r.qr_token,
  benefitType: r.benefit_type,
  benefitValue: r.benefit_value,
  displayLabel: r.display_label,
  status: r.status,
  issuedAt: r.issued_at,
  expiresAt: r.expires_at,
  redeemedAt: r.redeemed_at ?? undefined
});

export const mapReservation = (r: Row): Reservation => ({
  id: r.id,
  campaignId: r.campaign_id,
  slotId: r.slot_id,
  userId: r.user_id,
  voucherId: r.voucher_id,
  guestCount: r.guest_count ?? undefined,
  status: r.status,
  createdAt: r.created_at
});

export const mapSmsLog = (r: Row): SmsLog => ({
  id: r.id,
  campaignId: r.campaign_id,
  userId: r.user_id,
  voucherId: r.voucher_id,
  to: r.to_number,
  body: r.body,
  provider: r.provider,
  status: r.status,
  providerMessageId: r.provider_message_id ?? undefined,
  createdAt: r.created_at,
  failureReason: r.failure_reason ?? undefined
});

export const mapRedemptionLog = (r: Row): RedemptionLog => ({
  id: r.id,
  voucherId: r.voucher_id,
  staffName: r.staff_name,
  purchaseAmount: r.purchase_amount ?? undefined,
  note: r.note ?? undefined,
  createdAt: r.created_at
});

export const mapAnalyticsEvent = (r: Row): AnalyticsEvent => ({
  id: r.id,
  campaignId: r.campaign_id,
  eventName: r.event_name,
  userId: r.user_id ?? undefined,
  slotId: r.slot_id ?? undefined,
  metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : undefined,
  createdAt: r.created_at
});

export const mapReferralReward = (r: Row): ReferralReward => ({
  id: r.id,
  campaignId: r.campaign_id,
  referrerUserId: r.referrer_user_id,
  visitorSessionId: r.visitor_session_id,
  status: r.status,
  reason: r.reason ?? undefined,
  createdAt: r.created_at
});
