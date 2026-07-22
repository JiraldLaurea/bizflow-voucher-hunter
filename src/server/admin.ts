import crypto from "node:crypto";
import type { InArgs } from "@libsql/client";
import { AppError } from "@/server/errors";
import { all, getDb, mapBusiness, mapCampaign, mapPool, mapSlot, one, run, type Exec } from "@/server/db";
import { hashStaffPin } from "@/server/staff-pin";
import type { Business, Campaign, CampaignSlot, VoucherPool } from "@/types/voucher";

const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

export type CreateBusinessInput = {
  name: string;
  logoText: string;
  industry: Business["industry"];
  staffPin: string;
};

export async function listBusinesses(): Promise<Business[]> {
  const db = await getDb();
  return (await all(db, "SELECT * FROM businesses ORDER BY name")).map(mapBusiness);
}

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const db = await getDb();
  if (!/^\d{4,6}$/.test(input.staffPin)) {
    throw new AppError("E-BUSINESS-PIN", "staffPin must be 4 to 6 digits", 422);
  }
  const business: Business = {
    id: id("biz"),
    name: input.name,
    logoText: input.logoText,
    industry: input.industry
  };
  await run(
    db,
    "INSERT INTO businesses (id, name, logo_text, industry, staff_pin) VALUES (@id, @name, @logoText, @industry, @staffPin)",
    { ...business, staffPin: hashStaffPin(input.staffPin) }
  );
  return business;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const db = await getDb();
  return (await all(db, "SELECT * FROM campaigns ORDER BY start_date DESC")).map(mapCampaign);
}

/**
 * Campaigns annotated with their owning business's industry. The industry is the
 * customer-facing category (drives the directory's colour/icon), which can
 * differ from a campaign's `mode` — e.g. a beauty clinic running an
 * appointment-based campaign in restaurant `mode`. The admin campaign selector
 * uses `industry` so it matches what customers see.
 */
export type CampaignWithIndustry = Campaign & { industry: string };

export async function listCampaignsWithIndustry(): Promise<CampaignWithIndustry[]> {
  const db = await getDb();
  const rows = await all(
    db,
    `SELECT c.*, b.industry AS business_industry
     FROM campaigns c JOIN businesses b ON b.id = c.business_id
     ORDER BY c.start_date DESC`,
  );
  return rows.map((row) => ({
    ...mapCampaign(row),
    industry: String(row.business_industry),
  }));
}

export type CreateCampaignInput = {
  businessId: string;
  slug: string;
  title: string;
  offerMessage: string;
  heroImage: string;
  mode: Campaign["mode"];
  location?: string;
  startDate: string;
  endDate: string;
  baseAttempts: number;
  referralDailyLimit: number;
  candidateTimeoutMinutes: number;
  terms: string;
  shopUrl?: string;
  status?: Campaign["status"];
  allowReschedule?: boolean;
};

export type CreateSlotInput = {
  date: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  branchId?: string;
  totalCapacity: number;
  status?: CampaignSlot["status"];
};

export type CreatePoolInput = {
  benefitType: VoucherPool["benefitType"];
  benefitValue: string;
  displayLabel: string;
  totalQuantity: number;
  probabilityWeight: number;
  expiryType: VoucherPool["expiryType"];
  expiryValue: number;
  minimumSpend?: number;
  restriction?: string;
  status?: VoucherPool["status"];
  /** Slots at which this benefit tier is offered (rarity-gated availability). */
  slotIds?: string[];
};

export type PoolWithSlots = VoucherPool & { slotIds: string[] };

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const db = await getDb();
  if (new Date(input.endDate).getTime() < new Date(input.startDate).getTime()) {
    throw new AppError("E-CAMPAIGN-DATES", "Campaign end date must be on or after the start date", 422);
  }
  if (input.baseAttempts < 1) throw new AppError("E-CAMPAIGN-ATTEMPTS", "baseAttempts must be at least 1", 422);
  if (!(await one(db, "SELECT 1 FROM businesses WHERE id = ?", [input.businessId]))) {
    throw new AppError("E-BUSINESS-404", "Referenced business does not exist", 422);
  }
  if (await one(db, "SELECT 1 FROM campaigns WHERE slug = ?", [input.slug])) {
    throw new AppError("E-CAMPAIGN-SLUG", "Campaign slug is already in use", 409);
  }
  const campaign: Campaign = {
    id: id("camp"),
    businessId: input.businessId,
    slug: input.slug,
    title: input.title,
    offerMessage: input.offerMessage,
    heroImage: input.heroImage,
    mode: input.mode,
    location: input.location?.trim() || undefined,
    status: input.status ?? "active",
    startDate: input.startDate,
    endDate: input.endDate,
    baseAttempts: input.baseAttempts,
    referralDailyLimit: input.referralDailyLimit,
    candidateTimeoutMinutes: input.candidateTimeoutMinutes,
    terms: input.terms,
    shopUrl: input.shopUrl,
    allowReschedule: input.allowReschedule ?? false
  };
  await run(
    db,
    `INSERT INTO campaigns (id, business_id, slug, title, offer_message, hero_image, mode, location, status, start_date, end_date, base_attempts, referral_daily_limit, candidate_timeout_minutes, terms, shop_url, allow_reschedule)
     VALUES (@id, @businessId, @slug, @title, @offerMessage, @heroImage, @mode, @location, @status, @startDate, @endDate, @baseAttempts, @referralDailyLimit, @candidateTimeoutMinutes, @terms, @shopUrl, @allowReschedule)`,
    {
      id: campaign.id,
      businessId: campaign.businessId,
      slug: campaign.slug,
      title: campaign.title,
      offerMessage: campaign.offerMessage,
      heroImage: campaign.heroImage,
      mode: campaign.mode,
      location: campaign.location ?? null,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      baseAttempts: campaign.baseAttempts,
      referralDailyLimit: campaign.referralDailyLimit,
      candidateTimeoutMinutes: campaign.candidateTimeoutMinutes,
      terms: campaign.terms,
      shopUrl: campaign.shopUrl ?? null,
      allowReschedule: campaign.allowReschedule ? 1 : 0
    }
  );
  return campaign;
}

async function getCampaignFromDb(db: Exec, idOrSlug: string): Promise<Campaign> {
  const row = await one(db, "SELECT * FROM campaigns WHERE id = ? OR slug = ?", [idOrSlug, idOrSlug]);
  if (!row) throw new AppError("E-CAMPAIGN-404", "Campaign was not found", 404);
  return mapCampaign(row);
}

export async function getCampaign(idOrSlug: string): Promise<Campaign> {
  return getCampaignFromDb(await getDb(), idOrSlug);
}

const CAMPAIGN_PATCH_COLUMNS: Record<string, string> = {
  title: "title",
  offerMessage: "offer_message",
  heroImage: "hero_image",
  status: "status",
  startDate: "start_date",
  endDate: "end_date",
  baseAttempts: "base_attempts",
  referralDailyLimit: "referral_daily_limit",
  candidateTimeoutMinutes: "candidate_timeout_minutes",
  terms: "terms",
  shopUrl: "shop_url",
  allowReschedule: "allow_reschedule"
};

const CAMPAIGN_BOOLEAN_KEYS = new Set(["allowReschedule"]);

export async function updateCampaign(idOrSlug: string, patch: Partial<CreateCampaignInput>): Promise<Campaign> {
  const db = await getDb();
  const current = await getCampaign(idOrSlug);
  const startDate = patch.startDate ?? current.startDate;
  const endDate = patch.endDate ?? current.endDate;
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    throw new AppError("E-CAMPAIGN-DATES", "Campaign end date must be on or after the start date", 422);
  }
  if (patch.baseAttempts !== undefined && patch.baseAttempts < 1) {
    throw new AppError("E-CAMPAIGN-ATTEMPTS", "baseAttempts must be at least 1", 422);
  }
  const sets: string[] = [];
  const values: Array<string | number> = [];
  for (const [key, column] of Object.entries(CAMPAIGN_PATCH_COLUMNS)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      values.push(CAMPAIGN_BOOLEAN_KEYS.has(key) ? (value ? 1 : 0) : (value as string | number));
    }
  }
  if (sets.length === 0) return current;
  values.push(current.id);
  await run(db, `UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`, values as InArgs);
  return getCampaign(current.id);
}

export async function listSlots(campaignIdOrSlug: string): Promise<CampaignSlot[]> {
  const db = await getDb();
  const campaign = await getCampaign(campaignIdOrSlug);
  return (await all(db, "SELECT * FROM slots WHERE campaign_id = ? ORDER BY date, start_time", [campaign.id])).map(mapSlot);
}

export async function createSlot(campaignIdOrSlug: string, input: CreateSlotInput, executor?: Exec): Promise<CampaignSlot> {
  const db = executor ?? await getDb();
  const campaign = await getCampaignFromDb(db, campaignIdOrSlug);
  if (input.totalCapacity < 1) throw new AppError("E-SLOT-CAPACITY", "totalCapacity must be at least 1", 422);
  if (input.endTime <= input.startTime) {
    throw new AppError("E-SLOT-TIME", "Slot endTime must be after startTime", 422);
  }
  const slot: CampaignSlot = {
    id: id("slot"),
    campaignId: campaign.id,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone ?? "Asia/Manila",
    branchId: input.branchId,
    totalCapacity: input.totalCapacity,
    remainingCapacity: input.totalCapacity,
    status: input.status ?? "active"
  };
  await run(
    db,
    `INSERT INTO slots (id, campaign_id, date, start_time, end_time, timezone, branch_id, total_capacity, remaining_capacity, status)
     VALUES (@id, @campaignId, @date, @startTime, @endTime, @timezone, @branchId, @totalCapacity, @remainingCapacity, @status)`,
    { ...slot, branchId: slot.branchId ?? null }
  );
  return slot;
}

/** Lists a campaign's benefit tiers, each with the slot IDs it is offered at. */
export async function listPools(campaignIdOrSlug: string): Promise<PoolWithSlots[]> {
  const db = await getDb();
  const campaign = await getCampaign(campaignIdOrSlug);
  const pools = (await all(db, "SELECT * FROM pools WHERE campaign_id = ?", [campaign.id])).map(mapPool);
  const links = await all(db, "SELECT pool_id, slot_id FROM pool_slots", []);
  return pools.map((pool) => ({
    ...pool,
    slotIds: links.filter((l) => l.pool_id === pool.id).map((l) => l.slot_id as string)
  }));
}

export async function createPool(campaignIdOrSlug: string, input: CreatePoolInput, executor?: Exec): Promise<PoolWithSlots> {
  const db = executor ?? await getDb();
  const campaign = await getCampaignFromDb(db, campaignIdOrSlug);
  if (input.totalQuantity < 1) throw new AppError("E-POOL-QUANTITY", "totalQuantity must be at least 1", 422);
  if (input.probabilityWeight < 1) throw new AppError("E-POOL-WEIGHT", "probabilityWeight must be at least 1", 422);
  if (input.expiryValue < 0) throw new AppError("E-POOL-EXPIRY", "expiryValue cannot be negative", 422);

  const slotIds = input.slotIds ?? [];
  if (slotIds.length > 0) {
    const owned = await all(
      db,
      `SELECT id FROM slots WHERE campaign_id = ? AND id IN (${slotIds.map(() => "?").join(",")})`,
      [campaign.id, ...slotIds]
    );
    if (owned.length !== slotIds.length) {
      throw new AppError("E-POOL-SLOTS", "One or more assigned slots do not belong to this campaign", 422);
    }
  }

  const pool: VoucherPool = {
    id: id("pool"),
    campaignId: campaign.id,
    benefitType: input.benefitType,
    benefitValue: input.benefitValue,
    displayLabel: input.displayLabel,
    totalQuantity: input.totalQuantity,
    remainingQuantity: input.totalQuantity,
    probabilityWeight: input.probabilityWeight,
    expiryType: input.expiryType,
    expiryValue:
      input.expiryType === "selected_slot_only" ? 0 : input.expiryValue,
    minimumSpend: input.minimumSpend,
    status: input.status ?? "active",
    restriction: input.restriction
  };
  await run(
    db,
    `INSERT INTO pools (id, campaign_id, benefit_type, benefit_value, display_label, total_quantity, remaining_quantity, probability_weight, expiry_type, expiry_value, minimum_spend, status, restriction)
     VALUES (@id, @campaignId, @benefitType, @benefitValue, @displayLabel, @totalQuantity, @remainingQuantity, @probabilityWeight, @expiryType, @expiryValue, @minimumSpend, @status, @restriction)`,
    { ...pool, minimumSpend: pool.minimumSpend ?? null, restriction: pool.restriction ?? null }
  );
  for (const slotId of slotIds) {
    await run(db, "INSERT OR IGNORE INTO pool_slots (pool_id, slot_id) VALUES (?, ?)", [pool.id, slotId]);
  }
  return { ...pool, slotIds };
}
