"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const business =
    businesses.find((item) => item.id === selectedBusinessId) ?? businesses[0];
  const scopedCampaigns = business
    ? campaigns.filter((campaign) => campaign.businessId === business.id)
    : campaigns;
  const campaign =
    scopedCampaigns.find((item) => item.slug === selectedCampaignSlug) ??
    scopedCampaigns[0];

  // Client-side navigation, not window.location.assign: changing scope only
  // needs the page's server components re-rendered with new search params, and
  // a full document load threw away the whole dashboard bundle each time.
  function navigate(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
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

  // A single option is shown but not made switchable. Hiding it outright left
  // the page silent about what it was scoped to — a campaign's slots looked
  // like the business's slots.
  const showBusinessScope = showBusiness && businesses.length > 0;
  const showCampaignScope = scopedCampaigns.length > 0;
  if (!showBusinessScope && !showCampaignScope) return null;

  const category = campaign?.industry ?? campaign?.mode ?? "other";

  return (
    <div className="scope-selector">
      {showBusinessScope ? (
        <ScopeTile
          category={business?.industry ?? "other"}
          icon={campaignCategoryIcon(business?.industry ?? "other")}
          label="Business"
          onChange={onBusinessChange}
          options={businesses.map((item) => ({
            key: item.id,
            value: item.id,
            label: item.name,
          }))}
          selectLabel="Viewing business"
          value={business?.id ?? ""}
          valueLabel={business?.name ?? "All businesses"}
        />
      ) : null}

      {showCampaignScope ? (
        // No icon: the category glyph belongs to the business, and repeating it
        // here produced two identical tiles for a shop running a shop campaign.
        <ScopeTile
          label="Campaign"
          onChange={onCampaignChange}
          options={scopedCampaigns.map((item) => ({
            key: item.id,
            value: item.slug,
            label: item.title,
          }))}
          selectLabel="Viewing campaign"
          value={campaign?.slug ?? ""}
          valueLabel={campaign?.title ?? "No campaigns"}
        />
      ) : null}
    </div>
  );
}

/**
 * One scope tile: always a picker, even when there is a single option today.
 * A tile that reads as inert gives no hint that the scope is switchable at all,
 * and the option list is how you find out what else exists.
 */
function ScopeTile({
  category,
  icon,
  label,
  onChange,
  options,
  selectLabel,
  value,
  valueLabel,
}: {
  category?: string;
  icon?: ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: { key: string; value: string; label: string }[];
  selectLabel?: string;
  value?: string;
  valueLabel: string;
}) {
  const face = (
    <>
      {icon ? (
        <span className={`campaign-page-selector-icon mode-${category ?? "other"}`}>
          {icon}
        </span>
      ) : null}
      <span className="campaign-page-selector-copy">
        <small>{label}</small>
        <strong>{valueLabel}</strong>
      </span>
    </>
  );
  const className = `campaign-page-selector${icon ? "" : " is-iconless"}`;

  return (
    <label className={className}>
      {face}
      <FiChevronDown
        aria-hidden="true"
        className="campaign-page-selector-chevron"
      />
      <select
        aria-label={selectLabel}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.key} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
