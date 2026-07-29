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
