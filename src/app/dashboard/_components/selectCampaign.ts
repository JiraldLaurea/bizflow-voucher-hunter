import type { Campaign } from "@/types/voucher";

export function selectCampaign(campaigns: Campaign[], requested?: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.id === requested || campaign.slug === requested) ?? campaigns[0];
}
