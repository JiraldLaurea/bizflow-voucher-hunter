import type { Business, Campaign } from "@/types/voucher";

/**
 * A link back to a campaign-scoped list page that keeps the scope you were in.
 *
 * Without it, submitting a form on a dedicated route drops you on whichever
 * campaign sorts first rather than the one you were just working on.
 */
export function scopedHref(
  base: string,
  businessId: string | undefined,
  campaignSlug: string,
) {
  const params = new URLSearchParams();
  if (businessId) params.set("business", businessId);
  params.set("campaign", campaignSlug);
  return `${base}?${params.toString()}`;
}

export function selectCampaign(campaigns: Campaign[], requested?: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.id === requested || campaign.slug === requested) ?? campaigns[0];
}

/**
 * Resolves the business + campaign a campaign-scoped page is showing.
 *
 * The business narrows the campaign list, so a `?campaign=` belonging to a
 * different business is not silently honoured under the wrong heading — an
 * explicit campaign moves the business with it instead.
 *
 * `campaigns` is expected to be pre-filtered for the session, so staff only
 * ever resolve to their own business.
 */
export function selectScope<T extends Campaign>(
  businesses: Business[],
  campaigns: T[],
  requested: { business?: string; campaign?: string },
): { business?: Business; campaign?: T; campaigns: T[] } {
  const visibleBusinessIds = new Set(campaigns.map((campaign) => campaign.businessId));
  const selectable = businesses.filter((business) => visibleBusinessIds.has(business.id));

  // An explicit campaign wins over an explicit business: following a link to a
  // specific campaign should land on it, with the business following along.
  const requestedCampaign = requested.campaign
    ? campaigns.find(
        (campaign) =>
          campaign.slug === requested.campaign || campaign.id === requested.campaign,
      )
    : undefined;

  const business =
    (requestedCampaign
      ? selectable.find((item) => item.id === requestedCampaign.businessId)
      : undefined) ??
    selectable.find((item) => item.id === requested.business) ??
    selectable[0];

  const scoped = business
    ? campaigns.filter((campaign) => campaign.businessId === business.id)
    : campaigns;

  const campaign =
    (requestedCampaign && requestedCampaign.businessId === business?.id
      ? requestedCampaign
      : undefined) ?? scoped[0];

  return { business, campaign, campaigns: scoped };
}
