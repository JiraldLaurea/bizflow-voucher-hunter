import { cache } from "react";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
  type AdminSession,
} from "@/lib/admin-session";
import {
  listBusinesses,
  listCampaigns,
  listCampaignsWithIndustry,
  type CampaignWithIndustry,
} from "@/server/admin";
import type { Business, Campaign } from "@/types/voucher";

/**
 * Request-scoped reads for the dashboard.
 *
 * A single navigation renders the layout and the page, and both need the
 * session and usually the same business/campaign lists. Unwrapped, that meant
 * verifying the session three times and re-reading the same two tables per
 * render — every one of them a network round trip against remote libSQL.
 *
 * `cache()` is per request, not per user and not across requests: two people
 * loading the dashboard at the same moment never share a result. The wrappers
 * live here rather than on the `admin.ts` functions themselves so API route
 * handlers, which may write and then read back within one request, keep reading
 * straight through to the database.
 */

/**
 * Verifies the session cookie once per request. Still verified on every
 * request — middleware and this both check it, so an expired or forged cookie
 * is rejected exactly as before; only the repeat work inside one render is gone.
 */
export const currentSession = cache(async (): Promise<AdminSession | null> =>
  verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value),
);

export const cachedBusinesses = cache(async (): Promise<Business[]> => listBusinesses());

export const cachedCampaigns = cache(async (): Promise<Campaign[]> => listCampaigns());

export const cachedCampaignsWithIndustry = cache(
  async (): Promise<CampaignWithIndustry[]> => listCampaignsWithIndustry(),
);
