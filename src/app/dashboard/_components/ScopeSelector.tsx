"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FiChevronDown } from "react-icons/fi";
import { campaignCategoryIcon } from "@/lib/campaign-category";
import type { Business, Campaign } from "@/types/voucher";

type SelectorCampaign = Campaign & { industry?: string };

/**
 * The scope a campaign-bound page is showing: which business, and which of its
 * campaigns.
 *
 * Deliberately per-page rather than in the sidebar. Only Dashboard, Slots and
 * Vouchers are campaign-scoped; a persistent sidebar control would sit there
 * while you were on Businesses or Settings and imply those were scoped too.
 *
 * Staff see only the campaign half. Their session is bound to one business, so
 * a business picker would be a control with a single option.
 */
export function ScopeSelector({
  businesses,
  campaigns,
  selectedBusinessId,
  selectedCampaignSlug,
  showBusiness,
}: {
  businesses: Business[];
  campaigns: SelectorCampaign[];
  selectedBusinessId?: string;
  selectedCampaignSlug?: string;
  showBusiness: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const business =
    businesses.find((item) => item.id === selectedBusinessId) ?? businesses[0];
  const scopedCampaigns = business
    ? campaigns.filter((campaign) => campaign.businessId === business.id)
    : campaigns;
  const campaign =
    scopedCampaigns.find((item) => item.slug === selectedCampaignSlug) ??
    scopedCampaigns[0];

  function navigate(params: URLSearchParams) {
    window.location.assign(`${pathname}?${params.toString()}`);
  }

  function onBusinessChange(businessId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("business", businessId);
    // The previously selected campaign belongs to the previous business, so it
    // would resolve to nothing. Drop it and let the page pick that business's
    // first campaign.
    params.delete("campaign");
    navigate(params);
  }

  function onCampaignChange(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("campaign", slug);
    navigate(params);
  }

  const showBusinessPicker = showBusiness && businesses.length > 1;
  const showCampaignPicker = scopedCampaigns.length > 1;
  if (!showBusinessPicker && !showCampaignPicker) return null;

  const category = campaign?.industry ?? campaign?.mode ?? "other";

  return (
    <div className="scope-selector">
      {showBusinessPicker ? (
        <label className="campaign-page-selector">
          <span
            className={`campaign-page-selector-icon mode-${business?.industry ?? "other"}`}
          >
            {campaignCategoryIcon(business?.industry ?? "other")}
          </span>
          <span className="campaign-page-selector-copy">
            <small>Business</small>
            <strong>{business?.name ?? "All businesses"}</strong>
          </span>
          <FiChevronDown
            aria-hidden="true"
            className="campaign-page-selector-chevron"
          />
          <select
            aria-label="Viewing business"
            onChange={(event) => onBusinessChange(event.target.value)}
            value={business?.id ?? ""}
          >
            {businesses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showCampaignPicker ? (
        <label className="campaign-page-selector">
          <span className={`campaign-page-selector-icon mode-${category}`}>
            {campaignCategoryIcon(category)}
          </span>
          <span className="campaign-page-selector-copy">
            <small>Campaign</small>
            <strong>{campaign?.title ?? "No campaigns"}</strong>
          </span>
          <FiChevronDown
            aria-hidden="true"
            className="campaign-page-selector-chevron"
          />
          <select
            aria-label="Viewing campaign"
            onChange={(event) => onCampaignChange(event.target.value)}
            value={campaign?.slug ?? ""}
          >
            {scopedCampaigns.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
