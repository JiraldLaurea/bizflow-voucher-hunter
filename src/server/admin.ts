import crypto from "node:crypto";
import { AppError } from "@/server/errors";
import { getDb, mapCampaign, mapPool, mapSlot } from "@/server/db";
import type { Campaign, CampaignSlot, VoucherPool } from "@/types/voucher";

const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

export type CreateCampaignInput = {
  businessId: string;
  slug: string;
  title: string;
  offerMessage: string;
  heroImage: string;
  mode: Campaign["mode"];
  startDate: string;
  endDate: string;
  baseAttempts: number;
  referralDailyLimit: number;
  candidateTimeoutMinutes: number;
  terms: string;
  shopUrl?: string;
  status?: Campaign["status"];
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
};

export function createCampaign(input: CreateCampaignInput): Campaign {
  const db = getDb();
  if (new Date(input.endDate).getTime() < new Date(input.startDate).getTime()) {
    throw new AppError("E-CAMPAIGN-DATES", "Campaign end date must be on or after the start date", 422);
  }
  if (input.baseAttempts < 1) throw new AppError("E-CAMPAIGN-ATTEMPTS", "baseAttempts must be at least 1", 422);
  if (!db.prepare("SELECT 1 FROM businesses WHERE id = ?").get(input.businessId)) {
    throw new AppError("E-BUSINESS-404", "Referenced business does not exist", 422);
  }
  if (db.prepare("SELECT 1 FROM campaigns WHERE slug = ?").get(input.slug)) {
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
    status: input.status ?? "active",
    startDate: input.startDate,
    endDate: input.endDate,
    baseAttempts: input.baseAttempts,
    referralDailyLimit: input.referralDailyLimit,
    candidateTimeoutMinutes: input.candidateTimeoutMinutes,
    terms: input.terms,
    shopUrl: input.shopUrl
  };
  db.prepare(
    `INSERT INTO campaigns (id, business_id, slug, title, offer_message, hero_image, mode, status, start_date, end_date, base_attempts, referral_daily_limit, candidate_timeout_minutes, terms, shop_url)
     VALUES (@id, @businessId, @slug, @title, @offerMessage, @heroImage, @mode, @status, @startDate, @endDate, @baseAttempts, @referralDailyLimit, @candidateTimeoutMinutes, @terms, @shopUrl)`
  ).run({ ...campaign, shopUrl: campaign.shopUrl ?? null });
  return campaign;
}

export function getCampaign(idOrSlug: string): Campaign {
  const db = getDb();
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ? OR slug = ?").get(idOrSlug, idOrSlug);
  if (!row) throw new AppError("E-CAMPAIGN-404", "Campaign was not found", 404);
  return mapCampaign(row);
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
  shopUrl: "shop_url"
};

export function updateCampaign(idOrSlug: string, patch: Partial<CreateCampaignInput>): Campaign {
  const db = getDb();
  const current = getCampaign(idOrSlug);
  const startDate = patch.startDate ?? current.startDate;
  const endDate = patch.endDate ?? current.endDate;
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    throw new AppError("E-CAMPAIGN-DATES", "Campaign end date must be on or after the start date", 422);
  }
  if (patch.baseAttempts !== undefined && patch.baseAttempts < 1) {
    throw new AppError("E-CAMPAIGN-ATTEMPTS", "baseAttempts must be at least 1", 422);
  }
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(CAMPAIGN_PATCH_COLUMNS)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) return current;
  values.push(current.id);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getCampaign(current.id);
}

export function listSlots(campaignIdOrSlug: string): CampaignSlot[] {
  const db = getDb();
  const campaign = getCampaign(campaignIdOrSlug);
  return db.prepare("SELECT * FROM slots WHERE campaign_id = ? ORDER BY date, start_time").all(campaign.id).map(mapSlot);
}

export function createSlot(campaignIdOrSlug: string, input: CreateSlotInput): CampaignSlot {
  const db = getDb();
  const campaign = getCampaign(campaignIdOrSlug);
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
  db.prepare(
    `INSERT INTO slots (id, campaign_id, date, start_time, end_time, timezone, branch_id, total_capacity, remaining_capacity, status)
     VALUES (@id, @campaignId, @date, @startTime, @endTime, @timezone, @branchId, @totalCapacity, @remainingCapacity, @status)`
  ).run({ ...slot, branchId: slot.branchId ?? null });
  return slot;
}

export function listPools(slotId: string): VoucherPool[] {
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM slots WHERE id = ?").get(slotId)) {
    throw new AppError("E-SLOT-404", "Slot was not found", 404);
  }
  return db.prepare("SELECT * FROM pools WHERE slot_id = ?").all(slotId).map(mapPool);
}

export function createPool(slotId: string, input: CreatePoolInput): VoucherPool {
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM slots WHERE id = ?").get(slotId)) {
    throw new AppError("E-SLOT-404", "Slot was not found", 404);
  }
  if (input.totalQuantity < 1) throw new AppError("E-POOL-QUANTITY", "totalQuantity must be at least 1", 422);
  if (input.probabilityWeight < 1) throw new AppError("E-POOL-WEIGHT", "probabilityWeight must be at least 1", 422);
  if (input.expiryValue < 0) throw new AppError("E-POOL-EXPIRY", "expiryValue cannot be negative", 422);
  const pool: VoucherPool = {
    id: id("pool"),
    slotId,
    benefitType: input.benefitType,
    benefitValue: input.benefitValue,
    displayLabel: input.displayLabel,
    totalQuantity: input.totalQuantity,
    remainingQuantity: input.totalQuantity,
    probabilityWeight: input.probabilityWeight,
    expiryType: input.expiryType,
    expiryValue: input.expiryValue,
    minimumSpend: input.minimumSpend,
    status: input.status ?? "active",
    restriction: input.restriction
  };
  db.prepare(
    `INSERT INTO pools (id, slot_id, benefit_type, benefit_value, display_label, total_quantity, remaining_quantity, probability_weight, expiry_type, expiry_value, minimum_spend, status, restriction)
     VALUES (@id, @slotId, @benefitType, @benefitValue, @displayLabel, @totalQuantity, @remainingQuantity, @probabilityWeight, @expiryType, @expiryValue, @minimumSpend, @status, @restriction)`
  ).run({ ...pool, minimumSpend: pool.minimumSpend ?? null, restriction: pool.restriction ?? null });
  return pool;
}
