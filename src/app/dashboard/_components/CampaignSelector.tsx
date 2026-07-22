"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FiChevronDown } from "react-icons/fi";
import { campaignCategoryIcon } from "@/lib/campaign-category";
import type { Campaign } from "@/types/voucher";

// Accepts campaigns optionally annotated with their business industry (see
// listCampaignsWithIndustry). The icon/colour follow the industry — the
// customer-facing category — falling back to the campaign's own mode.
type SelectorCampaign = Campaign & { industry?: string };

/**
 * Per-page campaign scope selector, shown at the top-left of a page's content.
 * Writes the chosen campaign to the `?campaign=` query param — the same
 * mechanism the pages already read server-side — so switching re-renders the
 * page for that campaign. Hides itself when there is nothing to choose between.
 */
export function CampaignSelector({
  campaigns,
  selected,
}: {
  campaigns: SelectorCampaign[];
  selected?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (campaigns.length < 2) return null;

  const currentCampaign =
    campaigns.find((campaign) => campaign.slug === selected) ?? campaigns[0];
  const current = currentCampaign.slug;
  const category = currentCampaign.industry ?? currentCampaign.mode;

  function onSelect(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("campaign", slug);
    window.location.assign(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="campaign-page-selector">
      <span className={`campaign-page-selector-icon mode-${category}`}>
        {campaignCategoryIcon(category)}
      </span>
      <span className="campaign-page-selector-copy">
        <small>Campaign</small>
        <strong>{currentCampaign.title}</strong>
      </span>
      <FiChevronDown
        aria-hidden="true"
        className="campaign-page-selector-chevron"
      />
      <select
        aria-label="Viewing campaign"
        onChange={(event) => onSelect(event.target.value)}
        value={current}
      >
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.slug}>
            {campaign.title}
          </option>
        ))}
      </select>
    </label>
  );
}
