import * as SecureStore from "expo-secure-store";

import { apiRequest, type RoulettePreview } from "@/api/client";

/**
 * Development-only helpers behind the More tab's dev panel, mirroring the web's
 * `.dev-voucher-picker`. Everything here is gated on `__DEV__`, and the reset
 * endpoint refuses in production server-side as well.
 */
export const devToolsEnabled = __DEV__;

const DEV_POOL_KEY = "voucher_hunt_dev_pool_choices";

type PoolChoices = Record<string, string>;

/**
 * The forced pool is chosen on the global More tab but consumed by the roulette,
 * which is campaign-scoped and a separate navigator — so the choice is keyed by
 * slug and persisted rather than passed through navigation.
 *
 * SecureStore only stores strings, so the whole map is one JSON blob.
 */
async function readChoices(): Promise<PoolChoices> {
  try {
    const raw = await SecureStore.getItemAsync(DEV_POOL_KEY);
    return raw ? (JSON.parse(raw) as PoolChoices) : {};
  } catch {
    return {};
  }
}

export async function getDevPoolId(campaignSlug: string): Promise<string> {
  if (!devToolsEnabled) return "";
  const choices = await readChoices();
  return choices[campaignSlug] ?? "";
}

export async function setDevPoolId(campaignSlug: string, poolId: string) {
  const choices = await readChoices();
  if (poolId) {
    choices[campaignSlug] = poolId;
  } else {
    delete choices[campaignSlug];
  }
  await SecureStore.setItemAsync(DEV_POOL_KEY, JSON.stringify(choices));
}

export type HuntResetResult = {
  attemptsCleared: number;
  vouchersCleared: number;
};

/** Clears this phone's hunt for a campaign and returns the held stock to the pools. */
export function resetHunt(
  campaignSlug: string,
  token: string,
): Promise<HuntResetResult> {
  return apiRequest<HuntResetResult>("/api/public/hunt/reset", {
    method: "POST",
    body: { campaignSlug },
    token,
  });
}

export type DevPoolOption = RoulettePreview & { poolId: string };

/** Pools that can be forced. Entries without a `poolId` cannot be targeted. */
export function listDevPools(
  campaignSlug: string,
  token: string,
): Promise<DevPoolOption[]> {
  return apiRequest<RoulettePreview[]>(
    `/api/public/campaigns/${encodeURIComponent(campaignSlug)}/pools`,
    { token },
  ).then((pools) =>
    pools.filter((pool): pool is DevPoolOption => Boolean(pool.poolId)),
  );
}

export type DevLoyaltyGrant = {
  granted: string;
  balance: string;
};

/**
 * Tops the signed-in wallet up with LP. Earning it properly needs a partner to
 * scan a purchase, which is impractical when testing the storefront — the
 * cheapest demo item costs 150 LP and a day's app-use award is 10.
 *
 * Refused server-side outside development.
 */
export function grantLoyaltyPoints(
  amount: string,
  token: string,
): Promise<DevLoyaltyGrant> {
  return apiRequest<DevLoyaltyGrant>("/api/public/rewards/dev-credit", {
    method: "POST",
    body: { amount },
    token,
  });
}

export type DevPurchaseResult = {
  rewardAmount: string;
  balance: string;
  heldForReview: boolean;
};

/**
 * Stands in for a partner scanning the wallet QR at their till. Runs the real
 * earning path, so the partner is billed for the LP — which is what makes the
 * settlement side testable, unlike `grantLoyaltyPoints`.
 */
export function simulatePurchase(
  input: { businessId: string; purchaseAmount: string },
  token: string,
): Promise<DevPurchaseResult> {
  return apiRequest<DevPurchaseResult>("/api/public/rewards/dev-purchase", {
    method: "POST",
    body: input,
    token,
  });
}

export type DevCollectResult = {
  product?: { name: string; businessName: string };
  businessName: string;
  amount: string;
};

/** Stands in for partner staff scanning an item voucher at handover. */
export function simulateCollection(
  voucherCode: string,
  token: string,
): Promise<DevCollectResult> {
  return apiRequest<DevCollectResult>("/api/public/rewards/dev-collect", {
    method: "POST",
    body: { voucherCode },
    token,
  });
}

export type DevVoucherRefresh = {
  refreshed: Array<{ voucherCode: string; movedTo?: string; note?: string }>;
};

/**
 * Makes this number's issued vouchers usable again by moving past bookings to
 * the next slot with room and re-dating them. Expiry itself still applies —
 * see `devRefreshIssuedVouchers` for why it is not simply switched off in dev.
 */
export function refreshMyVouchers(token: string): Promise<DevVoucherRefresh> {
  return apiRequest<DevVoucherRefresh>(
    "/api/public/hunt/dev-refresh-vouchers",
    { method: "POST", body: {}, token },
  );
}
