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
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
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
-- Which date/time slots offer each benefit tier. Rarer tiers map to fewer slots.
CREATE TABLE IF NOT EXISTS pool_slots (
  pool_id TEXT NOT NULL REFERENCES pools(id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  PRIMARY KEY (pool_id, slot_id)
);
CREATE INDEX IF NOT EXISTS idx_pool_slots_slot ON pool_slots (slot_id);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
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
  slot_id TEXT,
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
  failure_reason TEXT,
  delivery_status TEXT,
  delivery_error TEXT,
  delivery_receipt TEXT,
  delivered_at TEXT
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
CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_phone ON customer_sessions (campaign_id, phone, expires_at);
CREATE TABLE IF NOT EXISTS rate_events (
  id TEXT PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_bucket ON rate_events (bucket_key, created_at);
CREATE TABLE IF NOT EXISTS reward_wallets (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  wallet_token TEXT NOT NULL UNIQUE,
  wallet_secret TEXT NOT NULL UNIQUE,
  balance_centavos INTEGER NOT NULL DEFAULT 0 CHECK (balance_centavos >= 0),
  lifetime_earned_centavos INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned_centavos >= 0),
  lifetime_converted_centavos INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_converted_centavos >= 0),
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reward_purchases (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES reward_wallets(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  purchase_amount_centavos INTEGER NOT NULL CHECK (purchase_amount_centavos > 0),
  reward_amount_centavos INTEGER NOT NULL CHECK (reward_amount_centavos > 0),
  staff_name TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL,
  fraud_flag TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_purchases_wallet ON reward_purchases (wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reward_purchases_business ON reward_purchases (business_id, created_at);
CREATE TABLE IF NOT EXISTS reward_ledger_entries (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES reward_wallets(id),
  type TEXT NOT NULL,
  delta_centavos INTEGER NOT NULL,
  balance_after_centavos INTEGER NOT NULL CHECK (balance_after_centavos >= 0),
  source_type TEXT NOT NULL,
  source_id TEXT,
  business_id TEXT,
  staff_name TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_wallet ON reward_ledger_entries (wallet_id, created_at);
CREATE TABLE IF NOT EXISTS reward_vouchers (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES reward_wallets(id),
  voucher_code TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
  remaining_centavos INTEGER NOT NULL CHECK (remaining_centavos >= 0),
  status TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  redeemed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_vouchers_wallet ON reward_vouchers (wallet_id, created_at);
CREATE TABLE IF NOT EXISTS reward_voucher_redemptions (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES reward_vouchers(id),
  wallet_id TEXT NOT NULL REFERENCES reward_wallets(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
  staff_name TEXT NOT NULL,
  settlement_status TEXT NOT NULL,
  settlement_id TEXT,
  settlement_verified_by TEXT,
  settlement_verified_at TEXT,
  adjustment_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_business ON reward_voucher_redemptions (business_id, created_at);
CREATE TABLE IF NOT EXISTS reward_settlements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  period TEXT NOT NULL,
  total_amount_centavos INTEGER NOT NULL CHECK (total_amount_centavos >= 0),
  status TEXT NOT NULL,
  gcash_reference TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (business_id, period)
);
CREATE TABLE IF NOT EXISTS reward_audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata TEXT,
  previous_hash TEXT,
  event_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_audit_entity ON reward_audit_logs (entity_type, entity_id, created_at);
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

// Every data table, ordered so deletes respect (soft) references. Used by the
// migration reset and by resetDb.
const DATA_TABLES = [
  "reward_audit_logs",
  "reward_settlements",
  "reward_voucher_redemptions",
  "reward_vouchers",
  "reward_ledger_entries",
  "reward_purchases",
  "reward_wallets",
  "rate_events",
  "customer_sessions",
  "otp_challenges",
  "analytics_events",
  "referral_rewards",
  "redemption_logs",
  "sms_logs",
  "reservations",
  "vouchers",
  "attempts",
  "users",
  "pool_slots",
  "pools",
  "slots",
  "campaigns",
  "businesses"
];

// Bump when the seed or table shapes change so deployed databases refresh.
// v2 = campaign-level pools + pool_slots tier→slot mapping. v3 = campaign titles.
// v4 = rewards network wallet/settlement tables.
const SCHEMA_VERSION = "4";

async function init() {
  const c = rawClient();
  await c.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const versionRow = (await c.execute("SELECT value FROM meta WHERE key = 'schema_version'")).rows[0] as Row | undefined;
  const migrating = (versionRow?.value as string | undefined) !== SCHEMA_VERSION;

  if (migrating) {
    // The pools/attempts model changed fundamentally; drop the affected tables
    // (demo data is disposable) so executeMultiple(SCHEMA) recreates them fresh.
    await c.batch(
      [
        "DROP TABLE IF EXISTS pool_slots",
        "DROP TABLE IF EXISTS pools",
        "DROP TABLE IF EXISTS attempts",
        "DROP TABLE IF EXISTS vouchers",
        "DROP TABLE IF EXISTS reservations"
      ],
      "write"
    );
  }

  await c.executeMultiple(SCHEMA);
  await ensureRewardsSchema(c);
  await ensureSmsSchema(c);

  if (migrating) {
    // Full reset so seed changes (e.g. campaign titles) reach already-seeded
    // databases; INSERT OR IGNORE alone would keep stale rows.
    await c.batch(DATA_TABLES.map((table) => `DELETE FROM ${table}`), "write");
    await seed(c);
    await c.execute({ sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)", args: [SCHEMA_VERSION] });
    return;
  }

  // Same version: self-heal an empty or partially-seeded database.
  if (!(await hasCompleteSeed(c))) await seed(c);
}

async function hasColumn(c: Client, table: string, column: string) {
  const result = await c.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => String((row as Row).name) === column);
}

async function ensureRewardsSchema(c: Client) {
  const walletSecretExists = await hasColumn(c, "reward_wallets", "wallet_secret");
  if (!walletSecretExists) {
    await c.execute("ALTER TABLE reward_wallets ADD COLUMN wallet_secret TEXT");
  }

  const rewardColumnAdds: Array<[string, string, string]> = [
    ["reward_purchases", "idempotency_key", "TEXT"],
    ["reward_purchases", "reviewed_by", "TEXT"],
    ["reward_purchases", "reviewed_at", "TEXT"],
    ["reward_purchases", "review_note", "TEXT"],
    ["reward_voucher_redemptions", "settlement_verified_by", "TEXT"],
    ["reward_voucher_redemptions", "settlement_verified_at", "TEXT"],
    ["reward_voucher_redemptions", "adjustment_note", "TEXT"],
    ["reward_audit_logs", "previous_hash", "TEXT"],
    ["reward_audit_logs", "event_hash", "TEXT"],
  ];

  for (const [table, column, definition] of rewardColumnAdds) {
    if (!(await hasColumn(c, table, column))) {
      await c.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  await c.execute(
    `UPDATE reward_wallets
     SET wallet_secret = 'rwsecret_' || lower(hex(randomblob(18)))
     WHERE wallet_secret IS NULL OR wallet_secret = ''`
  );
  await c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_wallets_secret ON reward_wallets (wallet_secret)");
  await c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_purchases_idempotency ON reward_purchases (business_id, idempotency_key) WHERE idempotency_key IS NOT NULL");
}

// Adds the SMPP delivery-receipt columns to already-deployed databases without a
// destructive schema-version bump. Also indexes provider_message_id, which DLR
// handling looks up on every inbound deliver_sm.
async function ensureSmsSchema(c: Client) {
  const smsColumnAdds: Array<[string, string, string]> = [
    ["sms_logs", "delivery_status", "TEXT"],
    ["sms_logs", "delivery_error", "TEXT"],
    ["sms_logs", "delivery_receipt", "TEXT"],
    ["sms_logs", "delivered_at", "TEXT"]
  ];
  for (const [table, column, definition] of smsColumnAdds) {
    if (!(await hasColumn(c, table, column))) {
      await c.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  await c.execute("CREATE INDEX IF NOT EXISTS idx_sms_logs_provider_message_id ON sms_logs (provider_message_id)");
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
  poolSlots: Array<{ poolId: string; slotId: string }>;
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
      title: "July Dinner",
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
      title: "8PM Shopping",
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
    // Restaurant: a 2pm off-peak lunch window plus busier dinner windows.
    { id: "slot_dinner_0705_1400", campaignId: "camp_july_dinner", date: "2026-07-05", startTime: "14:00", endTime: "16:00", timezone: "Asia/Manila", totalCapacity: 6, remainingCapacity: 6, status: "active" },
    { id: "slot_dinner_0705_1900", campaignId: "camp_july_dinner", date: "2026-07-05", startTime: "19:00", endTime: "21:00", timezone: "Asia/Manila", totalCapacity: 20, remainingCapacity: 20, status: "active" },
    { id: "slot_dinner_0705_2000", campaignId: "camp_july_dinner", date: "2026-07-05", startTime: "20:00", endTime: "22:00", timezone: "Asia/Manila", totalCapacity: 2, remainingCapacity: 2, status: "active" },
    { id: "slot_dinner_0706_1400", campaignId: "camp_july_dinner", date: "2026-07-06", startTime: "14:00", endTime: "16:00", timezone: "Asia/Manila", totalCapacity: 6, remainingCapacity: 6, status: "active" },
    { id: "slot_dinner_0706_1900", campaignId: "camp_july_dinner", date: "2026-07-06", startTime: "19:00", endTime: "21:00", timezone: "Asia/Manila", totalCapacity: 12, remainingCapacity: 0, status: "sold_out" },
    { id: "slot_dinner_0707_1900", campaignId: "camp_july_dinner", date: "2026-07-07", startTime: "19:00", endTime: "21:00", timezone: "Asia/Manila", totalCapacity: 18, remainingCapacity: 18, status: "active" },
    // Online shop: two evening drops plus a 10am off-peak morning drop.
    { id: "slot_shop_0705_2000", campaignId: "camp_8pm_drop", date: "2026-07-05", startTime: "20:00", endTime: "22:00", timezone: "Asia/Manila", totalCapacity: 100, remainingCapacity: 100, status: "active" },
    { id: "slot_shop_0706_2200", campaignId: "camp_8pm_drop", date: "2026-07-06", startTime: "22:00", endTime: "23:59", timezone: "Asia/Manila", totalCapacity: 75, remainingCapacity: 75, status: "active" },
    { id: "slot_shop_0707_1000", campaignId: "camp_8pm_drop", date: "2026-07-07", startTime: "10:00", endTime: "12:00", timezone: "Asia/Manila", totalCapacity: 50, remainingCapacity: 50, status: "active" }
  ],
  pools: [
    // Restaurant: campaign-wide benefit tiers. Rarer tiers have less stock.
    { id: "pool_dinner_90", campaignId: "camp_july_dinner", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_50", campaignId: "camp_july_dinner", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 6, remainingQuantity: 6, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_30", campaignId: "camp_july_dinner", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 15, remainingQuantity: 15, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_20", campaignId: "camp_july_dinner", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 60, remainingQuantity: 60, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_dessert", campaignId: "camp_july_dinner", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 40, remainingQuantity: 40, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },

    // Online shop: campaign-wide benefit tiers.
    { id: "pool_shop_90", campaignId: "camp_8pm_drop", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 2, remainingQuantity: 2, probabilityWeight: 1, expiryType: "hours", expiryValue: 2, minimumSpend: 2000, status: "active" },
    { id: "pool_shop_50", campaignId: "camp_8pm_drop", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 9, remainingQuantity: 9, probabilityWeight: 5, expiryType: "hours", expiryValue: 24, minimumSpend: 1500, status: "active" },
    { id: "pool_shop_20", campaignId: "camp_8pm_drop", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 85, remainingQuantity: 85, probabilityWeight: 50, expiryType: "days", expiryValue: 7, minimumSpend: 1000, status: "active" },
    { id: "pool_shop_10", campaignId: "camp_8pm_drop", benefitType: "discount_percent", benefitValue: "10", displayLabel: "10% OFF", totalQuantity: 24, remainingQuantity: 24, probabilityWeight: 15, expiryType: "days", expiryValue: 14, minimumSpend: 500, status: "active" },
    { id: "pool_shop_ship", campaignId: "camp_8pm_drop", benefitType: "free_shipping", benefitValue: "free_shipping", displayLabel: "Free Shipping", totalQuantity: 55, remainingQuantity: 55, probabilityWeight: 30, expiryType: "days", expiryValue: 7, status: "active" }
  ],
  // Which slots each benefit tier is offered at. Rarer/higher tiers map to
  // fewer (off-peak) slots; common tiers are available everywhere.
  poolSlots: [
    // 90% OFF: 2pm off-peak only
    { poolId: "pool_dinner_90", slotId: "slot_dinner_0705_1400" },
    // 50% OFF: off-peak lunch windows
    { poolId: "pool_dinner_50", slotId: "slot_dinner_0705_1400" },
    { poolId: "pool_dinner_50", slotId: "slot_dinner_0706_1400" },
    // 30% OFF: lunch + a couple of dinner windows
    { poolId: "pool_dinner_30", slotId: "slot_dinner_0705_1400" },
    { poolId: "pool_dinner_30", slotId: "slot_dinner_0706_1400" },
    { poolId: "pool_dinner_30", slotId: "slot_dinner_0705_1900" },
    { poolId: "pool_dinner_30", slotId: "slot_dinner_0707_1900" },
    // 20% OFF: every slot
    { poolId: "pool_dinner_20", slotId: "slot_dinner_0705_1400" },
    { poolId: "pool_dinner_20", slotId: "slot_dinner_0705_1900" },
    { poolId: "pool_dinner_20", slotId: "slot_dinner_0705_2000" },
    { poolId: "pool_dinner_20", slotId: "slot_dinner_0706_1400" },
    { poolId: "pool_dinner_20", slotId: "slot_dinner_0706_1900" },
    { poolId: "pool_dinner_20", slotId: "slot_dinner_0707_1900" },
    // Free Dessert: dinner windows
    { poolId: "pool_dinner_dessert", slotId: "slot_dinner_0705_1900" },
    { poolId: "pool_dinner_dessert", slotId: "slot_dinner_0705_2000" },
    { poolId: "pool_dinner_dessert", slotId: "slot_dinner_0706_1900" },
    { poolId: "pool_dinner_dessert", slotId: "slot_dinner_0707_1900" },

    // Shop: 90% at the 10am off-peak drop only
    { poolId: "pool_shop_90", slotId: "slot_shop_0707_1000" },
    { poolId: "pool_shop_50", slotId: "slot_shop_0707_1000" },
    { poolId: "pool_shop_50", slotId: "slot_shop_0706_2200" },
    { poolId: "pool_shop_20", slotId: "slot_shop_0705_2000" },
    { poolId: "pool_shop_20", slotId: "slot_shop_0706_2200" },
    { poolId: "pool_shop_20", slotId: "slot_shop_0707_1000" },
    { poolId: "pool_shop_10", slotId: "slot_shop_0705_2000" },
    { poolId: "pool_shop_10", slotId: "slot_shop_0706_2200" },
    { poolId: "pool_shop_10", slotId: "slot_shop_0707_1000" },
    { poolId: "pool_shop_ship", slotId: "slot_shop_0705_2000" },
    { poolId: "pool_shop_ship", slotId: "slot_shop_0706_2200" },
    { poolId: "pool_shop_ship", slotId: "slot_shop_0707_1000" }
  ]
};

async function hasCompleteSeed(c: Client) {
  const groups: Array<[string, Array<{ id: string }>]> = [
    ["businesses", seedData.businesses],
    ["campaigns", seedData.campaigns],
    ["slots", seedData.slots],
    ["pools", seedData.pools],
  ];

  for (const [table, rows] of groups) {
    if (rows.length === 0) continue;
    const result = await c.execute({
      sql: `SELECT COUNT(*) AS count FROM ${table} WHERE id IN (${rows.map(() => "?").join(",")})`,
      args: rows.map((row) => row.id),
    });
    if (Number((result.rows[0] as Row).count) !== rows.length) return false;
  }

  return true;
}

const INSERT_BUSINESS =
  "INSERT OR IGNORE INTO businesses (id, name, logo_text, industry, staff_pin) VALUES (@id, @name, @logoText, @industry, @staffPin)";
const INSERT_CAMPAIGN = `INSERT OR IGNORE INTO campaigns (id, business_id, slug, title, offer_message, hero_image, mode, status, start_date, end_date, base_attempts, referral_daily_limit, candidate_timeout_minutes, terms, shop_url, require_otp, allow_reschedule)
     VALUES (@id, @businessId, @slug, @title, @offerMessage, @heroImage, @mode, @status, @startDate, @endDate, @baseAttempts, @referralDailyLimit, @candidateTimeoutMinutes, @terms, @shopUrl, @requireOtp, @allowReschedule)`;
const INSERT_SLOT = `INSERT OR IGNORE INTO slots (id, campaign_id, date, start_time, end_time, timezone, branch_id, total_capacity, remaining_capacity, status)
     VALUES (@id, @campaignId, @date, @startTime, @endTime, @timezone, @branchId, @totalCapacity, @remainingCapacity, @status)`;
const INSERT_POOL = `INSERT OR IGNORE INTO pools (id, campaign_id, benefit_type, benefit_value, display_label, total_quantity, remaining_quantity, probability_weight, expiry_type, expiry_value, minimum_spend, status, restriction)
     VALUES (@id, @campaignId, @benefitType, @benefitValue, @displayLabel, @totalQuantity, @remainingQuantity, @probabilityWeight, @expiryType, @expiryValue, @minimumSpend, @status, @restriction)`;
const INSERT_POOL_SLOT = "INSERT OR IGNORE INTO pool_slots (pool_id, slot_id) VALUES (@poolId, @slotId)";

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
        campaignId: r.campaignId,
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
    })),
    ...seedData.poolSlots.map((r) => ({ sql: INSERT_POOL_SLOT, args: { poolId: r.poolId, slotId: r.slotId } }))
  ];
  await c.batch(statements, "write");
}

/** Wipe every table and re-seed. Used by tests and the admin reset action. */
export async function resetDb() {
  await ensureReady();
  const c = rawClient();
  await c.batch(
    DATA_TABLES.map((table) => `DELETE FROM ${table}`),
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
  campaignId: r.campaign_id,
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
  slotId: r.slot_id ?? undefined,
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
  failureReason: r.failure_reason ?? undefined,
  deliveryStatus: r.delivery_status ?? undefined,
  deliveryError: r.delivery_error ?? undefined,
  deliveryReceipt: r.delivery_receipt ?? undefined,
  deliveredAt: r.delivered_at ?? undefined
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
