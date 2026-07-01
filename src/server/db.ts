import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  AnalyticsEvent,
  Business,
  Campaign,
  CampaignSlot,
  EndUser,
  RedemptionLog,
  Reservation,
  SmsLog,
  Voucher,
  VoucherAttempt,
  VoucherPool
} from "@/types/voucher";

const dbPath = path.resolve(process.env.DATABASE_PATH ?? "./data/bizflow.db");

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
  shop_url TEXT
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
  status TEXT NOT NULL,
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
`;

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  instance = db;
  if (isEmpty(db)) seed(db);
  return db;
}

function isEmpty(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM campaigns").get() as { c: number };
  return row.c === 0;
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
      terms: "Valid for selected slot only. Minimum spend applies. One final voucher per phone number."
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
      shopUrl: "https://example.com/shop"
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
    { id: "pool_dinner_90", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 48, minimumSpend: 1500, status: "active" },
    { id: "pool_dinner_50", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 3, remainingQuantity: 3, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_20", slotId: "slot_dinner_0705_1900", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 16, remainingQuantity: 16, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_2000_50", slotId: "slot_dinner_0705_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_dinner_2000_dessert", slotId: "slot_dinner_0705_2000", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 7, remainingQuantity: 7, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },
    { id: "pool_dinner_0707_20", slotId: "slot_dinner_0707_1900", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 18, remainingQuantity: 18, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0707_2000_dessert", slotId: "slot_dinner_0707_2000", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 15, remainingQuantity: 15, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },
    { id: "pool_dinner_0708_dessert", slotId: "slot_dinner_0708_1900", benefitType: "free_item", benefitValue: "dessert", displayLabel: "Free Dessert", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 30, expiryType: "selected_slot_only", expiryValue: 0, minimumSpend: 500, status: "active" },
    { id: "pool_dinner_0708_2000_20", slotId: "slot_dinner_0708_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 10, remainingQuantity: 10, probabilityWeight: 50, expiryType: "days", expiryValue: 30, minimumSpend: 800, status: "active" },
    { id: "pool_dinner_0709_30", slotId: "slot_dinner_0709_1900", benefitType: "discount_percent", benefitValue: "30", displayLabel: "30% OFF", totalQuantity: 27, remainingQuantity: 27, probabilityWeight: 40, expiryType: "days", expiryValue: 14, minimumSpend: 900, status: "active" },
    { id: "pool_dinner_0709_2000_50", slotId: "slot_dinner_0709_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 12, remainingQuantity: 12, probabilityWeight: 5, expiryType: "days", expiryValue: 7, minimumSpend: 1200, status: "active" },
    { id: "pool_shop_90", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "90", displayLabel: "90% OFF", totalQuantity: 1, remainingQuantity: 1, probabilityWeight: 1, expiryType: "hours", expiryValue: 2, minimumSpend: 2000, status: "active" },
    { id: "pool_shop_50", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "50", displayLabel: "50% OFF", totalQuantity: 5, remainingQuantity: 5, probabilityWeight: 5, expiryType: "hours", expiryValue: 24, minimumSpend: 1500, status: "active" },
    { id: "pool_shop_20", slotId: "slot_shop_0705_2000", benefitType: "discount_percent", benefitValue: "20", displayLabel: "20% OFF", totalQuantity: 94, remainingQuantity: 94, probabilityWeight: 50, expiryType: "days", expiryValue: 7, minimumSpend: 1000, status: "active" },
    { id: "pool_shop_ship", slotId: "slot_shop_0706_2200", benefitType: "free_shipping", benefitValue: "free_shipping", displayLabel: "Free Shipping", totalQuantity: 75, remainingQuantity: 75, probabilityWeight: 50, expiryType: "days", expiryValue: 7, status: "active" }
  ]
};

function seed(db: Database.Database) {
  const insertBusiness = db.prepare(
    "INSERT INTO businesses (id, name, logo_text, industry, staff_pin) VALUES (@id, @name, @logoText, @industry, @staffPin)"
  );
  const insertCampaign = db.prepare(
    `INSERT INTO campaigns (id, business_id, slug, title, offer_message, hero_image, mode, status, start_date, end_date, base_attempts, referral_daily_limit, candidate_timeout_minutes, terms, shop_url)
     VALUES (@id, @businessId, @slug, @title, @offerMessage, @heroImage, @mode, @status, @startDate, @endDate, @baseAttempts, @referralDailyLimit, @candidateTimeoutMinutes, @terms, @shopUrl)`
  );
  const insertSlot = db.prepare(
    `INSERT INTO slots (id, campaign_id, date, start_time, end_time, timezone, branch_id, total_capacity, remaining_capacity, status)
     VALUES (@id, @campaignId, @date, @startTime, @endTime, @timezone, @branchId, @totalCapacity, @remainingCapacity, @status)`
  );
  const insertPool = db.prepare(
    `INSERT INTO pools (id, slot_id, benefit_type, benefit_value, display_label, total_quantity, remaining_quantity, probability_weight, expiry_type, expiry_value, minimum_spend, status, restriction)
     VALUES (@id, @slotId, @benefitType, @benefitValue, @displayLabel, @totalQuantity, @remainingQuantity, @probabilityWeight, @expiryType, @expiryValue, @minimumSpend, @status, @restriction)`
  );
  const run = db.transaction(() => {
    seedData.businesses.forEach((row) => insertBusiness.run(row));
    seedData.campaigns.forEach((row) => insertCampaign.run({ shopUrl: null, ...row }));
    seedData.slots.forEach((row) => insertSlot.run({ branchId: null, ...row }));
    seedData.pools.forEach((row) => insertPool.run({ minimumSpend: null, restriction: null, ...row }));
  });
  run();
}

/** Wipe every table and re-seed. Used by tests and local resets. */
export function resetDb() {
  const db = getDb();
  const wipe = db.transaction(() => {
    for (const table of [
      "analytics_events",
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
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  });
  wipe();
  seed(db);
}

// ---- Row mappers: SQLite snake_case rows -> typed camelCase domain objects ----

// better-sqlite3 returns rows as `unknown`; mappers narrow them to typed domain objects.
type Row = any;

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
  shopUrl: r.shop_url ?? undefined
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
  status: r.status,
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
